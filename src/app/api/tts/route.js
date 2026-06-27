// src/app/api/tts/route.js
import { randomUUID } from "crypto";
import OpenAI from "openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MODEL = process.env.OPENAI_TTS_MODEL?.trim() || "gpt-4o-mini-tts";
const DEFAULT_VOICE = "coral";
const DEFAULT_RESPONSE_FORMAT = "mp3";
const OPENAI_TIMEOUT_MS = readBoundedIntEnv("TTS_OPENAI_TIMEOUT_MS", 18_000, 1_000, 25_000);
const MAX_TEXT_CHARS = readBoundedIntEnv("TTS_MAX_TEXT_CHARS", 2_000, 1, 4_000);
const MAX_BODY_BYTES = readBoundedIntEnv("TTS_MAX_BODY_BYTES", 64_000, 1_024, 256_000);
const MAX_AUDIO_BYTES = readBoundedIntEnv("TTS_MAX_AUDIO_BYTES", 5_000_000, 1_024, 10_000_000);
const RATE_LIMIT_WINDOW_MS = readBoundedIntEnv("TTS_RATE_LIMIT_WINDOW_MS", 60_000, 1_000, 3_600_000);
const RATE_LIMIT_MAX_REQUESTS = readBoundedIntEnv("TTS_RATE_LIMIT_MAX", 30, 1, 1_000);
const RATE_LIMIT_MAX_ENTRIES = 5_000;
const JSON_CONTENT_TYPE = "application/json; charset=utf-8";
const AUDIO_CONTENT_TYPE = "audio/mpeg";
const CACHE_CONTROL = "no-store";

const ALLOWED_VOICES = new Set([
  "alloy",
  "ash",
  "ballad",
  "coral",
  "echo",
  "fable",
  "nova",
  "onyx",
  "sage",
  "shimmer",
]);

const TTS_INSTRUCTIONS =
  "Đọc bằng tiếng Việt, giọng nữ ấm áp, rõ ràng, chậm rãi và thân thiện như đang nói chuyện với ông bà lớn tuổi.";

const ERROR_MESSAGES = {
  INVALID_JSON: "Dữ liệu gửi lên không phải JSON hợp lệ.",
  INVALID_BODY: "Dữ liệu gửi lên không đúng định dạng.",
  BODY_TOO_LARGE: "Nội dung gửi lên quá lớn. Bạn thử đọc đoạn ngắn hơn nhé.",
  TEXT_REQUIRED: "Không có nội dung để đọc.",
  TEXT_WRONG_TYPE: "Nội dung cần đọc phải là dạng chữ.",
  TEXT_TOO_LONG: "Nội dung quá dài. Bạn thử đọc đoạn ngắn hơn nhé.",
  VOICE_WRONG_TYPE: "Giọng đọc không hợp lệ.",
  VOICE_UNSUPPORTED: "Giọng đọc này chưa được hỗ trợ.",
  API_KEY_MISSING: "Hệ thống chưa được cấu hình khóa OpenAI. Vui lòng báo người quản trị.",
  TIMEOUT: "Dịch vụ đọc giọng nói phản hồi quá lâu. Bạn thử lại sau ít phút nhé.",
  RATE_LIMIT: "Hệ thống đang có nhiều lượt đọc. Bạn chờ một chút rồi thử lại nhé.",
  LOCAL_RATE_LIMIT: "Bạn đang yêu cầu đọc hơi nhanh. Vui lòng chờ một chút rồi thử lại nhé.",
  AUTH_ERROR: "Hệ thống đang gặp lỗi xác thực với dịch vụ AI. Vui lòng báo người quản trị.",
  UPSTREAM_UNAVAILABLE: "Dịch vụ đọc giọng nói đang tạm thời không sẵn sàng. Bạn thử lại sau ít phút nhé.",
  UPSTREAM_BAD_RESPONSE: "Dịch vụ đọc giọng nói trả về dữ liệu chưa đúng. Bạn thử lại giúp tôi nhé.",
  NETWORK_ERROR: "Không kết nối được tới dịch vụ đọc giọng nói. Bạn thử lại sau ít phút nhé.",
  INTERNAL_ERROR: "Có lỗi xảy ra. Bạn thử lại sau ít phút nhé.",
  METHOD_NOT_ALLOWED: "Phương thức này không được hỗ trợ. Vui lòng dùng POST.",
};

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
    textLength: 0,
    voice: "",
    audioBytes: 0,
  };
}

function logRequest(ctx, status, extra = {}) {
  console.info("[tts]", {
    request_id: ctx.requestId,
    status,
    duration_ms: Date.now() - ctx.startedAt,
    text_length: ctx.textLength,
    voice: ctx.voice,
    audio_bytes: ctx.audioBytes,
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

function audioResponse(ctx, buffer) {
  ctx.audioBytes = buffer.byteLength;
  logRequest(ctx, 200);
  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": AUDIO_CONTENT_TYPE,
      "Cache-Control": CACHE_CONTROL,
      "X-Request-Id": ctx.requestId,
    },
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

function validateInput(body, ctx) {
  if (!isPlainObject(body)) {
    throw new HttpError(400, ERROR_MESSAGES.INVALID_BODY, "invalid_body");
  }
  if (!hasOwn(body, "text")) {
    throw new HttpError(400, ERROR_MESSAGES.TEXT_REQUIRED, "text_required");
  }

  const rawText = body.text;
  ctx.textLength = typeof rawText === "string" ? rawText.trim().length : 0;

  if (typeof rawText !== "string") {
    throw new HttpError(400, ERROR_MESSAGES.TEXT_WRONG_TYPE, "text_wrong_type");
  }

  const text = rawText.replace(/\s+/g, " ").trim();
  if (!text) {
    throw new HttpError(400, ERROR_MESSAGES.TEXT_REQUIRED, "text_required");
  }
  if (text.length > MAX_TEXT_CHARS) {
    throw new HttpError(413, ERROR_MESSAGES.TEXT_TOO_LONG, "text_too_long");
  }

  const voice = validateVoice(body.voice);
  ctx.textLength = text.length;
  ctx.voice = voice;

  return { text, voice };
}

function validateVoice(rawVoice) {
  if (rawVoice == null || rawVoice === "") {
    return DEFAULT_VOICE;
  }
  if (typeof rawVoice !== "string") {
    throw new HttpError(400, ERROR_MESSAGES.VOICE_WRONG_TYPE, "voice_wrong_type");
  }

  const voice = rawVoice.trim().toLowerCase();
  if (!voice) {
    return DEFAULT_VOICE;
  }
  if (!ALLOWED_VOICES.has(voice)) {
    throw new HttpError(400, ERROR_MESSAGES.VOICE_UNSUPPORTED, "voice_unsupported");
  }

  return voice;
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

async function createSpeech({ text, voice }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);

  try {
    return await getOpenAIClient().audio.speech.create(
      {
        model: MODEL,
        voice,
        input: text,
        response_format: DEFAULT_RESPONSE_FORMAT,
        instructions: TTS_INSTRUCTIONS,
      },
      { signal: controller.signal }
    );
  } finally {
    clearTimeout(timer);
  }
}

async function speechToBuffer(speech) {
  if (!speech || typeof speech.arrayBuffer !== "function") {
    throw new UpstreamResponseError("missing_audio");
  }

  const buffer = Buffer.from(await speech.arrayBuffer());
  if (!buffer.byteLength || buffer.byteLength > MAX_AUDIO_BYTES) {
    throw new UpstreamResponseError("invalid_audio_size");
  }

  return buffer;
}

function logSafeOpenAIError(ctx, mapped, error) {
  console.warn("[tts] openai_error", {
    request_id: ctx.requestId,
    status: mapped.status,
    duration_ms: Date.now() - ctx.startedAt,
    text_length: ctx.textLength,
    voice: ctx.voice,
    audio_bytes: ctx.audioBytes,
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
    const input = validateInput(body, ctx);
    const speech = await createSpeech(input);
    const buffer = await speechToBuffer(speech);

    return audioResponse(ctx, buffer);
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

    console.error("[tts] unexpected_error", {
      request_id: ctx.requestId,
      duration_ms: Date.now() - ctx.startedAt,
      text_length: ctx.textLength,
      voice: ctx.voice,
      audio_bytes: ctx.audioBytes,
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
