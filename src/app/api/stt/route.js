// src/app/api/stt/route.js
import { randomUUID } from "crypto";
import OpenAI, { toFile } from "openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MODEL = process.env.OPENAI_STT_MODEL?.trim() || "gpt-4o-transcribe";
const LANGUAGE = "vi";
const OPENAI_TIMEOUT_MS = readBoundedIntEnv("STT_OPENAI_TIMEOUT_MS", 18_000, 1_000, 25_000);
const MAX_OPENAI_ATTEMPTS = readBoundedIntEnv("STT_OPENAI_MAX_ATTEMPTS", 2, 1, 3);
// Vercel Functions reject payloads above 4.5 MB before route code runs.
const MAX_AUDIO_BYTES = readBoundedIntEnv("STT_MAX_AUDIO_BYTES", 4_000_000, 1_024, 4_300_000);
const MAX_BODY_BYTES = readBoundedIntEnv("STT_MAX_BODY_BYTES", 4_200_000, 1_024, 4_400_000);
const MAX_TRANSCRIPT_CHARS = readBoundedIntEnv("STT_MAX_TRANSCRIPT_CHARS", 2_000, 50, 10_000);
const RATE_LIMIT_WINDOW_MS = readBoundedIntEnv("STT_RATE_LIMIT_WINDOW_MS", 60_000, 1_000, 3_600_000);
const RATE_LIMIT_MAX_REQUESTS = readBoundedIntEnv("STT_RATE_LIMIT_MAX", 15, 1, 1_000);
const RATE_LIMIT_MAX_ENTRIES = 5_000;
const JSON_CONTENT_TYPE = "application/json; charset=utf-8";
const AUDIO_FIELD = "audio";
const TRANSCRIPTION_PROMPT =
  "Đây là một câu hỏi ngắn bằng tiếng Việt của người dùng lớn tuổi. Hãy chép lại chính xác lời nói, giữ tiếng Việt tự nhiên.";

const MIME_TO_EXTENSION = new Map([
  ["audio/webm", "webm"],
  ["video/webm", "webm"],
  ["audio/mp4", "mp4"],
  ["video/mp4", "mp4"],
  ["audio/mpeg", "mp3"],
  ["audio/mp3", "mp3"],
  ["audio/mpga", "mpga"],
  ["audio/m4a", "m4a"],
  ["audio/x-m4a", "m4a"],
  ["audio/wav", "wav"],
  ["audio/wave", "wav"],
  ["audio/x-wav", "wav"],
  ["audio/flac", "flac"],
  ["audio/x-flac", "flac"],
  ["audio/ogg", "ogg"],
  ["audio/oga", "oga"],
]);

const EXTENSION_TO_MIME = new Map([
  ["webm", "audio/webm"],
  ["mp4", "audio/mp4"],
  ["mp3", "audio/mpeg"],
  ["mpeg", "audio/mpeg"],
  ["mpga", "audio/mpga"],
  ["m4a", "audio/m4a"],
  ["wav", "audio/wav"],
  ["flac", "audio/flac"],
  ["ogg", "audio/ogg"],
  ["oga", "audio/oga"],
]);

const ERROR_MESSAGES = {
  INVALID_FORM: "Dữ liệu âm thanh gửi lên không hợp lệ.",
  BODY_TOO_LARGE: "File ghi âm quá lớn. Bạn nói ngắn hơn rồi thử lại nhé.",
  AUDIO_REQUIRED: "Chưa có file ghi âm. Bạn bấm micro rồi nói lại giúp tôi nhé.",
  AUDIO_WRONG_TYPE: "File ghi âm gửi lên không đúng định dạng.",
  AUDIO_EMPTY: "File ghi âm đang rỗng. Bạn bấm micro rồi nói lại giúp tôi nhé.",
  AUDIO_TOO_LARGE: "File ghi âm quá lớn. Bạn nói ngắn hơn rồi thử lại nhé.",
  AUDIO_UNSUPPORTED: "Định dạng ghi âm chưa được hỗ trợ. Bạn thử ghi âm lại giúp tôi nhé.",
  TRANSCRIPT_EMPTY: "Tôi chưa nghe rõ, bạn bấm micro rồi nói lại giúp nhé.",
  TRANSCRIPT_TOO_LONG: "Câu nói hơi dài. Bạn hỏi ngắn hơn giúp tôi nhé.",
  API_KEY_MISSING: "Hệ thống chưa được cấu hình khóa OpenAI. Vui lòng báo người quản trị.",
  TIMEOUT: "Dịch vụ nghe giọng nói phản hồi quá lâu. Bạn thử lại sau ít phút nhé.",
  RATE_LIMIT: "Hệ thống đang có nhiều lượt nghe. Bạn chờ một chút rồi thử lại nhé.",
  LOCAL_RATE_LIMIT: "Bạn đang gửi ghi âm hơi nhanh. Vui lòng chờ một chút rồi thử lại nhé.",
  AUTH_ERROR: "Hệ thống đang gặp lỗi xác thực với dịch vụ AI. Vui lòng báo người quản trị.",
  UPSTREAM_UNAVAILABLE: "Dịch vụ nghe giọng nói đang tạm thời không sẵn sàng. Bạn thử lại sau ít phút nhé.",
  UPSTREAM_BAD_RESPONSE: "Dịch vụ nghe giọng nói trả về dữ liệu chưa đúng. Bạn thử lại giúp tôi nhé.",
  NETWORK_ERROR: "Không kết nối được tới dịch vụ nghe giọng nói. Bạn thử lại sau ít phút nhé.",
  INTERNAL_ERROR: "Có lỗi xảy ra. Bạn thử lại sau ít phút nhé.",
  METHOD_NOT_ALLOWED: "Phương thức này không được hỗ trợ. Vui lòng dùng POST.",
};

const RETRYABLE_RESPONSE_ERROR_CODES = new Set([
  "missing_text",
]);

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
    audioSize: 0,
    audioMimeType: "",
    audioExtension: "",
    transcriptLength: 0,
    openaiAttempts: 0,
  };
}

function logRequest(ctx, status, extra = {}) {
  console.info("[stt]", {
    request_id: ctx.requestId,
    status,
    duration_ms: Date.now() - ctx.startedAt,
    audio_size: ctx.audioSize,
    audio_mime_type: ctx.audioMimeType,
    audio_extension: ctx.audioExtension,
    transcript_length: ctx.transcriptLength,
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

async function readFormData(req) {
  const contentType = req.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("multipart/form-data")) {
    throw new HttpError(400, ERROR_MESSAGES.INVALID_FORM, "invalid_content_type");
  }

  const contentLengthHeader = req.headers.get("content-length");
  const contentLength = Number(contentLengthHeader);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    throw new HttpError(413, ERROR_MESSAGES.BODY_TOO_LARGE, "body_too_large");
  }

  try {
    return await req.formData();
  } catch {
    throw new HttpError(400, ERROR_MESSAGES.INVALID_FORM, "invalid_form_data");
  }
}

function isFileLike(value) {
  return (
    value &&
    typeof value === "object" &&
    typeof value.arrayBuffer === "function" &&
    typeof value.size === "number"
  );
}

function normalizeMimeType(type) {
  return String(type || "").split(";")[0].trim().toLowerCase();
}

function extensionFromName(name) {
  const match = String(name || "").toLowerCase().match(/\.([a-z0-9]+)$/);
  return match ? match[1] : "";
}

function inferAudioType(file) {
  const mimeType = normalizeMimeType(file.type);
  const extensionFromMime = MIME_TO_EXTENSION.get(mimeType);
  if (extensionFromMime) {
    return { mimeType, extension: extensionFromMime };
  }

  const extension = extensionFromName(file.name);
  const mimeFromExtension = EXTENSION_TO_MIME.get(extension);
  if (mimeFromExtension && (!mimeType || mimeType === "application/octet-stream")) {
    return { mimeType: mimeFromExtension, extension };
  }

  throw new HttpError(400, ERROR_MESSAGES.AUDIO_UNSUPPORTED, "audio_unsupported_type");
}

async function validateAudioFile(formData, ctx) {
  const audio = formData.get(AUDIO_FIELD);
  if (!audio) {
    throw new HttpError(400, ERROR_MESSAGES.AUDIO_REQUIRED, "audio_required");
  }
  if (!isFileLike(audio)) {
    throw new HttpError(400, ERROR_MESSAGES.AUDIO_WRONG_TYPE, "audio_wrong_type");
  }
  if (audio.size <= 0) {
    throw new HttpError(400, ERROR_MESSAGES.AUDIO_EMPTY, "audio_empty");
  }
  if (audio.size > MAX_AUDIO_BYTES) {
    throw new HttpError(413, ERROR_MESSAGES.AUDIO_TOO_LARGE, "audio_too_large");
  }

  const audioType = inferAudioType(audio);
  ctx.audioSize = audio.size;
  ctx.audioMimeType = audioType.mimeType;
  ctx.audioExtension = audioType.extension;

  const buffer = Buffer.from(await audio.arrayBuffer());
  return toFile(buffer, `speech.${audioType.extension}`, { type: audioType.mimeType });
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

async function createTranscription(file) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);

  try {
    return await getOpenAIClient().audio.transcriptions.create(
      {
        file,
        model: MODEL,
        language: LANGUAGE,
        prompt: TRANSCRIPTION_PROMPT,
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

async function transcribeWithRetry(file, ctx) {
  let lastError;

  for (let attempt = 1; attempt <= MAX_OPENAI_ATTEMPTS; attempt += 1) {
    ctx.openaiAttempts = attempt;

    const transcription = await createTranscription(file);
    try {
      return extractTranscript(transcription, ctx);
    } catch (error) {
      lastError = error;

      if (attempt >= MAX_OPENAI_ATTEMPTS || !shouldRetryResponseError(error)) {
        throw error;
      }

      console.warn("[stt] retrying_bad_upstream_response", {
        request_id: ctx.requestId,
        attempt,
        duration_ms: Date.now() - ctx.startedAt,
        audio_size: ctx.audioSize,
        audio_mime_type: ctx.audioMimeType,
        audio_extension: ctx.audioExtension,
        error_code: error.code,
      });
    }
  }

  throw lastError;
}

function extractTranscript(transcription, ctx) {
  if (typeof transcription?.text !== "string") {
    throw new UpstreamResponseError("missing_text");
  }

  const text = transcription.text.trim();
  ctx.transcriptLength = text.length;

  if (!text) {
    throw new HttpError(422, ERROR_MESSAGES.TRANSCRIPT_EMPTY, "empty_transcript");
  }
  if (text.length > MAX_TRANSCRIPT_CHARS) {
    throw new HttpError(422, ERROR_MESSAGES.TRANSCRIPT_TOO_LONG, "transcript_too_long");
  }

  return text;
}

function logSafeOpenAIError(ctx, mapped, error) {
  console.warn("[stt] openai_error", {
    request_id: ctx.requestId,
    status: mapped.status,
    duration_ms: Date.now() - ctx.startedAt,
    audio_size: ctx.audioSize,
    audio_mime_type: ctx.audioMimeType,
    audio_extension: ctx.audioExtension,
    transcript_length: ctx.transcriptLength,
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
    const formData = await readFormData(req);
    const file = await validateAudioFile(formData, ctx);
    const text = await transcribeWithRetry(file, ctx);

    return jsonResponse(ctx, 200, { text });
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

    console.error("[stt] unexpected_error", {
      request_id: ctx.requestId,
      duration_ms: Date.now() - ctx.startedAt,
      audio_size: ctx.audioSize,
      audio_mime_type: ctx.audioMimeType,
      audio_extension: ctx.audioExtension,
      transcript_length: ctx.transcriptLength,
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
