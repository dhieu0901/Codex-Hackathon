// src/app/api/understand/route.js
import { randomUUID } from "crypto";
import OpenAI from "openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MODEL = process.env.OPENAI_MODEL?.trim() || "gpt-4o";
const TEMPERATURE = 0.2;
const MAX_RESPONSE_TOKENS = readBoundedIntEnv("UNDERSTAND_MAX_RESPONSE_TOKENS", 1_500, 300, 3_000);
const OPENAI_TIMEOUT_MS = readBoundedIntEnv("UNDERSTAND_OPENAI_TIMEOUT_MS", 20_000, 1_000, 25_000);
const MAX_OPENAI_ATTEMPTS = readBoundedIntEnv("UNDERSTAND_OPENAI_MAX_ATTEMPTS", 2, 1, 3);
// Vercel Functions reject payloads above 4.5 MB before route code runs.
const MAX_IMAGE_BASE64_CHARS = readBoundedIntEnv("UNDERSTAND_MAX_IMAGE_BASE64_CHARS", 4_000_000, 1_024, 4_300_000);
const MAX_BODY_BYTES = readBoundedIntEnv("UNDERSTAND_MAX_BODY_BYTES", 4_200_000, 1_024, 4_400_000);
const RATE_LIMIT_WINDOW_MS = readBoundedIntEnv("UNDERSTAND_RATE_LIMIT_WINDOW_MS", 60_000, 1_000, 3_600_000);
const RATE_LIMIT_MAX_REQUESTS = readBoundedIntEnv("UNDERSTAND_RATE_LIMIT_MAX", 8, 1, 1_000);
const RATE_LIMIT_MAX_ENTRIES = 5_000;
const JSON_CONTENT_TYPE = "application/json; charset=utf-8";
const VALID_TYPES = ["thuốc", "hóa đơn", "công văn", "biểu mẫu", "khác"];
const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const RETRYABLE_RESPONSE_ERROR_CODES = new Set([
  "empty_content",
  "invalid_json_response",
  "missing_contract_fields",
]);

const ERROR_MESSAGES = {
  INVALID_JSON: "Dữ liệu gửi lên không phải JSON hợp lệ.",
  INVALID_BODY: "Dữ liệu gửi lên không đúng định dạng.",
  BODY_TOO_LARGE: "Dữ liệu gửi lên quá lớn. Vui lòng chụp ảnh nhỏ hơn hoặc rõ phần cần đọc.",
  IMAGE_REQUIRED: "Chưa có ảnh. Bạn hãy chụp lại giúp tôi nhé.",
  IMAGE_WRONG_TYPE: "Ảnh gửi lên phải là dạng chữ base64.",
  IMAGE_TOO_LARGE: "Ảnh quá lớn, bạn thử chụp lại nhỏ hơn nhé.",
  IMAGE_INVALID: "Ảnh gửi lên không hợp lệ. Bạn hãy chụp lại giúp tôi nhé.",
  IMAGE_UNSUPPORTED: "Định dạng ảnh chưa được hỗ trợ. Bạn hãy dùng ảnh JPEG, PNG hoặc WebP nhé.",
  API_KEY_MISSING: "Hệ thống chưa được cấu hình khóa OpenAI. Vui lòng báo người quản trị.",
  TIMEOUT: "Dịch vụ AI phản hồi quá lâu. Bạn thử lại sau ít phút nhé.",
  RATE_LIMIT: "Hệ thống đang có nhiều lượt đọc. Bạn chờ một chút rồi thử lại nhé.",
  LOCAL_RATE_LIMIT: "Bạn đang gửi ảnh hơi nhanh. Vui lòng chờ một chút rồi thử lại nhé.",
  AUTH_ERROR: "Hệ thống đang gặp lỗi xác thực với dịch vụ AI. Vui lòng báo người quản trị.",
  UPSTREAM_UNAVAILABLE: "Dịch vụ AI đang tạm thời không sẵn sàng. Bạn thử lại sau ít phút nhé.",
  UPSTREAM_BAD_RESPONSE: "Dịch vụ AI trả về dữ liệu chưa đúng. Bạn thử chụp lại rõ hơn giúp tôi nhé.",
  NETWORK_ERROR: "Không kết nối được tới dịch vụ AI. Bạn thử lại sau ít phút nhé.",
  INTERNAL_ERROR: "Có lỗi xảy ra. Bạn thử lại sau ít phút nhé.",
  METHOD_NOT_ALLOWED: "Phương thức này không được hỗ trợ. Vui lòng dùng POST.",
};

const SYSTEM_PROMPT = `Bạn giúp người cao tuổi Việt Nam đọc và HIỂU văn bản họ chụp.

Trả về DUY NHẤT một JSON hợp lệ, không markdown, không giải thích thêm, đúng dạng:
{
  "raw_text": "chép nguyên văn tiếng Việt trong ảnh, giữ đúng dấu, xuống dòng bằng \\n",
  "type": "một trong: thuốc | hóa đơn | công văn | biểu mẫu | khác",
  "explanation": "giải thích lại bằng lời nói hằng ngày, NGẮN, như đang nói chuyện với ông bà",
  "key_points": ["2-4 ý quan trọng nhất, mỗi ý 1 câu ngắn"]
}

Quy tắc:
- Dùng từ đơn giản, câu ngắn, KHÔNG thuật ngữ.
- Nếu chữ mờ không chắc, nói rõ trong explanation: "chỗ này tôi đọc chưa rõ".
- Nếu là thuốc: nói rõ liều lượng, số lần/ngày, uống lúc nào (trước/sau ăn).
- Nếu là hóa đơn: tóm tắt tổng tiền và hạn thanh toán.
- Nếu là giấy tờ/công văn: ai gửi, nội dung chính, mình cần làm gì.
- Nếu ảnh KHÔNG có chữ đọc được: raw_text = "", type = "khác", explanation báo nhẹ nhàng để chụp lại rõ hơn, key_points = [].`;

class HttpError extends Error {
  constructor(status, message, code, headers) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    this.headers = headers;
  }
}

class UpstreamResponseError extends Error {
  constructor(code) {
    super(code);
    this.name = "UpstreamResponseError";
    this.code = code;
  }
}

let openaiClient;
const rateLimitStore = new Map();

function readBoundedIntEnv(name, fallback, min, max) {
  const raw = process.env[name];
  if (!raw) return fallback;

  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value)) return fallback;

  return Math.min(Math.max(value, min), max);
}

function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new HttpError(500, ERROR_MESSAGES.API_KEY_MISSING, "missing_api_key");
  }

  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      maxRetries: 0,
    });
  }

  return openaiClient;
}

function makeLogContext() {
  return {
    requestId: randomUUID(),
    startedAt: Date.now(),
    imageLength: 0,
    imageMimeType: "",
    openaiAttempts: 0,
  };
}

function logRequest(ctx, status, extra = {}) {
  console.info("[understand]", {
    request_id: ctx.requestId,
    status,
    duration_ms: Date.now() - ctx.startedAt,
    image_length: ctx.imageLength,
    image_mime_type: ctx.imageMimeType,
    openai_attempts: ctx.openaiAttempts,
    ...extra,
  });
}

function jsonResponse(ctx, status, body, init = {}) {
  logRequest(ctx, status, init.log);
  const headers = new Headers(init.headers);
  headers.set("X-Request-Id", ctx.requestId);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", JSON_CONTENT_TYPE);
  }

  return Response.json(body, {
    status,
    headers,
  });
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function utf8ByteLength(value) {
  return new TextEncoder().encode(value).length;
}

function getClientIp(req) {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

function pruneRateLimitStore(now) {
  if (rateLimitStore.size <= RATE_LIMIT_MAX_ENTRIES) return;

  for (const [key, value] of rateLimitStore) {
    if (value.resetAt <= now) {
      rateLimitStore.delete(key);
    }
  }

  while (rateLimitStore.size > RATE_LIMIT_MAX_ENTRIES) {
    const oldestKey = rateLimitStore.keys().next().value;
    if (!oldestKey) break;
    rateLimitStore.delete(oldestKey);
  }
}

function enforceRateLimit(req) {
  const now = Date.now();
  const key = getClientIp(req);
  const current = rateLimitStore.get(key);

  pruneRateLimitStore(now);

  if (!current || current.resetAt <= now) {
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });
    return;
  }

  current.count += 1;
  if (current.count <= RATE_LIMIT_MAX_REQUESTS) {
    return;
  }

  const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
  throw new HttpError(429, ERROR_MESSAGES.LOCAL_RATE_LIMIT, "local_rate_limit", {
    "Retry-After": String(retryAfterSeconds),
  });
}

async function readJsonBody(req) {
  const contentLengthHeader = req.headers.get("content-length");
  const contentLength = Number(contentLengthHeader);

  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    throw new HttpError(413, ERROR_MESSAGES.BODY_TOO_LARGE, "body_too_large");
  }

  let rawBody;
  try {
    rawBody = await req.text();
  } catch {
    throw new HttpError(400, ERROR_MESSAGES.INVALID_JSON, "body_unreadable");
  }

  if (utf8ByteLength(rawBody) > MAX_BODY_BYTES) {
    throw new HttpError(413, ERROR_MESSAGES.BODY_TOO_LARGE, "body_too_large");
  }

  try {
    return JSON.parse(rawBody);
  } catch {
    throw new HttpError(400, ERROR_MESSAGES.INVALID_JSON, "invalid_json");
  }
}

function parseImageInput(image) {
  if (typeof image !== "string") {
    throw new HttpError(400, ERROR_MESSAGES.IMAGE_WRONG_TYPE, "image_wrong_type");
  }

  const trimmed = image.trim();
  if (!trimmed) {
    throw new HttpError(400, ERROR_MESSAGES.IMAGE_REQUIRED, "image_required");
  }

  const dataUrlMatch = trimmed.match(/^data:([^;,]+);base64,(.+)$/is);
  const mimeType = dataUrlMatch?.[1]?.toLowerCase() || "image/jpeg";
  const rawBase64 = dataUrlMatch ? dataUrlMatch[2] : trimmed;

  if (mimeType === "image/jpg") {
    return normalizeImageDataUrl("image/jpeg", rawBase64);
  }

  return normalizeImageDataUrl(mimeType, rawBase64);
}

function normalizeImageDataUrl(mimeType, rawBase64) {
  if (!ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) {
    throw new HttpError(400, ERROR_MESSAGES.IMAGE_UNSUPPORTED, "image_unsupported_type");
  }

  const base64 = rawBase64.replace(/\s/g, "");
  if (!base64 || base64.length > MAX_IMAGE_BASE64_CHARS) {
    throw new HttpError(413, ERROR_MESSAGES.IMAGE_TOO_LARGE, "image_too_large");
  }
  if (!isStrictBase64(base64)) {
    throw new HttpError(400, ERROR_MESSAGES.IMAGE_INVALID, "image_invalid_base64");
  }

  const buffer = Buffer.from(base64, "base64");
  if (!hasExpectedImageSignature(buffer, mimeType)) {
    throw new HttpError(400, ERROR_MESSAGES.IMAGE_INVALID, "image_invalid_signature");
  }

  return {
    mimeType,
    base64,
    dataUrl: `data:${mimeType};base64,${base64}`,
  };
}

function isStrictBase64(value) {
  if (value.length % 4 !== 0) return false;
  return /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value);
}

function hasExpectedImageSignature(buffer, mimeType) {
  if (mimeType === "image/jpeg") {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }

  if (mimeType === "image/png") {
    return (
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    );
  }

  if (mimeType === "image/webp") {
    return (
      buffer.length >= 12 &&
      buffer.toString("ascii", 0, 4) === "RIFF" &&
      buffer.toString("ascii", 8, 12) === "WEBP"
    );
  }

  return false;
}

function validateInput(body, ctx) {
  if (!isPlainObject(body)) {
    throw new HttpError(400, ERROR_MESSAGES.INVALID_BODY, "invalid_body");
  }
  if (!hasOwn(body, "image")) {
    throw new HttpError(400, ERROR_MESSAGES.IMAGE_REQUIRED, "image_required");
  }

  const image = parseImageInput(body.image);
  ctx.imageLength = image.base64.length;
  ctx.imageMimeType = image.mimeType;

  return image;
}

function buildMessages(dataUrl) {
  return [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: [
        {
          type: "text",
          text: "Đọc và giải thích giúp tôi tờ này bằng tiếng Việt đơn giản.",
        },
        { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
      ],
    },
  ];
}

function isTimeoutError(error) {
  return (
    error?.name === "AbortError" ||
    error?.name === "APIUserAbortError" ||
    error?.name === "APIConnectionTimeoutError" ||
    error?.code === "ETIMEDOUT" ||
    /timeout|abort/i.test(error?.message || "")
  );
}

function mapOpenAIError(error) {
  const upstreamStatus = error?.status;
  const upstreamCode = error?.code || error?.error?.code;

  if (isTimeoutError(error) || upstreamStatus === 408) {
    return { status: 504, message: ERROR_MESSAGES.TIMEOUT, code: "openai_timeout" };
  }

  if (upstreamStatus === 401 || upstreamStatus === 403 || error?.name === "AuthenticationError") {
    return { status: 503, message: ERROR_MESSAGES.AUTH_ERROR, code: "openai_auth_error" };
  }

  if (upstreamStatus === 429) {
    if (upstreamCode === "insufficient_quota") {
      return { status: 503, message: ERROR_MESSAGES.UPSTREAM_UNAVAILABLE, code: "openai_quota" };
    }
    return { status: 429, message: ERROR_MESSAGES.RATE_LIMIT, code: "openai_rate_limit" };
  }

  if (upstreamStatus >= 500) {
    return { status: 503, message: ERROR_MESSAGES.UPSTREAM_UNAVAILABLE, code: "openai_unavailable" };
  }

  if (upstreamStatus >= 400) {
    return { status: 502, message: ERROR_MESSAGES.UPSTREAM_BAD_RESPONSE, code: "openai_bad_request" };
  }

  if (error?.name === "APIConnectionError" || error?.code === "ECONNRESET" || error?.code === "ENOTFOUND") {
    return { status: 502, message: ERROR_MESSAGES.NETWORK_ERROR, code: "openai_network_error" };
  }

  if (typeof error?.name === "string" && error.name.startsWith("API")) {
    return { status: 502, message: ERROR_MESSAGES.UPSTREAM_BAD_RESPONSE, code: "openai_api_error" };
  }

  return null;
}

async function createUnderstanding(dataUrl) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);

  try {
    return await getOpenAIClient().chat.completions.create(
      {
        model: MODEL,
        temperature: TEMPERATURE,
        max_tokens: MAX_RESPONSE_TOKENS,
        response_format: { type: "json_object" },
        messages: buildMessages(dataUrl),
      },
      { signal: controller.signal }
    );
  } finally {
    clearTimeout(timer);
  }
}

function shouldRetryResponseError(error) {
  return error instanceof UpstreamResponseError && RETRYABLE_RESPONSE_ERROR_CODES.has(error.code);
}

async function createUnderstandingWithRetry(dataUrl, ctx) {
  let lastError;

  for (let attempt = 1; attempt <= MAX_OPENAI_ATTEMPTS; attempt += 1) {
    ctx.openaiAttempts = attempt;

    const completion = await createUnderstanding(dataUrl);
    try {
      return extractUnderstanding(completion);
    } catch (error) {
      lastError = error;

      if (attempt >= MAX_OPENAI_ATTEMPTS || !shouldRetryResponseError(error)) {
        throw error;
      }

      console.warn("[understand] retrying_bad_upstream_response", {
        request_id: ctx.requestId,
        attempt,
        duration_ms: Date.now() - ctx.startedAt,
        image_length: ctx.imageLength,
        image_mime_type: ctx.imageMimeType,
        error_code: error.code,
      });
    }
  }

  throw lastError;
}

function extractUnderstanding(completion) {
  const choice = completion?.choices?.[0];
  const content = choice?.message?.content;

  if (choice?.finish_reason === "length") {
    throw new UpstreamResponseError("response_truncated");
  }
  if (typeof content !== "string" || !content.trim()) {
    throw new UpstreamResponseError("empty_content");
  }

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new UpstreamResponseError("invalid_json_response");
  }

  if (!hasMinimumContract(parsed)) {
    throw new UpstreamResponseError("missing_contract_fields");
  }

  return normalize(parsed);
}

function hasMinimumContract(value) {
  return (
    isPlainObject(value) &&
    typeof value.raw_text === "string" &&
    typeof value.type === "string" &&
    typeof value.explanation === "string" &&
    Array.isArray(value.key_points)
  );
}

function normalize(parsed) {
  const type = VALID_TYPES.includes(parsed?.type) ? parsed.type : "khác";
  const keyPoints = Array.isArray(parsed?.key_points)
    ? parsed.key_points.filter((point) => typeof point === "string" && point.trim()).map((point) => point.trim()).slice(0, 4)
    : [];

  return {
    raw_text: typeof parsed?.raw_text === "string" ? parsed.raw_text.trim() : "",
    type,
    explanation:
      typeof parsed?.explanation === "string" && parsed.explanation.trim()
        ? parsed.explanation.trim()
        : "Xin lỗi, tôi đọc chưa rõ tờ này. Bạn thử chụp lại gần và rõ hơn nhé.",
    key_points: keyPoints,
  };
}

function logSafeOpenAIError(ctx, mapped, error) {
  console.warn("[understand] openai_error", {
    request_id: ctx.requestId,
    status: mapped.status,
    duration_ms: Date.now() - ctx.startedAt,
    image_length: ctx.imageLength,
    image_mime_type: ctx.imageMimeType,
    openai_attempts: ctx.openaiAttempts,
    upstream_status: error?.status,
    upstream_code: error?.code || error?.error?.code,
    error_name: error?.name,
    error_code: mapped.code,
  });
}

export async function POST(req) {
  const ctx = makeLogContext();

  try {
    enforceRateLimit(req);
    const body = await readJsonBody(req);
    const image = validateInput(body, ctx);
    const result = await createUnderstandingWithRetry(image.dataUrl, ctx);

    return jsonResponse(ctx, 200, result);
  } catch (error) {
    if (error instanceof HttpError) {
      return jsonResponse(ctx, error.status, { error: error.message }, { headers: error.headers, log: { error_code: error.code } });
    }

    if (error instanceof UpstreamResponseError) {
      return jsonResponse(ctx, 502, { error: ERROR_MESSAGES.UPSTREAM_BAD_RESPONSE }, { log: { error_code: error.code } });
    }

    const mapped = mapOpenAIError(error);
    if (mapped) {
      logSafeOpenAIError(ctx, mapped, error);
      return jsonResponse(ctx, mapped.status, { error: mapped.message }, { log: { error_code: mapped.code } });
    }

    console.error("[understand] unexpected_error", {
      request_id: ctx.requestId,
      duration_ms: Date.now() - ctx.startedAt,
      image_length: ctx.imageLength,
      image_mime_type: ctx.imageMimeType,
      openai_attempts: ctx.openaiAttempts,
      error_name: error?.name,
    });
    return jsonResponse(ctx, 500, { error: ERROR_MESSAGES.INTERNAL_ERROR }, { log: { error_code: "unexpected_error" } });
  }
}

function methodNotAllowed() {
  const ctx = makeLogContext();
  return jsonResponse(
    ctx,
    405,
    { error: ERROR_MESSAGES.METHOD_NOT_ALLOWED },
    { headers: { Allow: "POST" }, log: { error_code: "method_not_allowed" } }
  );
}

export const GET = methodNotAllowed;
export const HEAD = methodNotAllowed;
export const OPTIONS = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
