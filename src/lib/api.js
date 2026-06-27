// src/lib/api.js
// DG-C04 — Client gọi API backend của "Soi Thuốc".
// Nhiệm vụ: gọi /api/understand & /api/ask, chuyển snake_case (API) <-> camelCase (UI),
// timeout + hủy được + retry lỗi mạng tạm thời, và luôn ném ra thông báo lỗi tiếng Việt.
//
// Hợp đồng (Interface Contracts):
//   analyzeImage(base64)        -> Promise<{ rawText, type, explanation, keyPoints }>
//   askQuestion(question, raw)  -> Promise<{ answer }>

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_RETRIES = 1; // chỉ retry lỗi mạng/429/503, KHÔNG retry để tránh gọi lại GPT-4o
const RETRYABLE_STATUS = new Set([429, 503]);

/** Lỗi có kèm HTTP status, message luôn là tiếng Việt thân thiện để hiển thị thẳng cho user. */
export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

function messageForStatus(status) {
  if (status === 413) return "Ảnh quá lớn, bạn thử chụp lại nhỏ hơn nhé.";
  if (status === 429) return "Hệ thống đang bận, bạn chờ một chút rồi thử lại nhé.";
  if (status === 503) return "Hệ thống đang bận, bạn chờ một chút rồi thử lại nhé.";
  if (status >= 500) return "Hệ thống đang trục trặc, bạn thử lại sau nhé.";
  return "Có lỗi xảy ra, bạn thử lại sau nhé.";
}

async function readJson(res) {
  try {
    return await res.json();
  } catch {
    return null; // body rỗng hoặc không phải JSON
  }
}

// Gắn external signal (nút "Hủy") vào AbortController nội bộ, trả hàm dọn listener.
function linkSignal(external, controller) {
  if (!external) return () => {};
  if (external.aborted) {
    controller.abort(external.reason);
    return () => {};
  }
  const onAbort = () => controller.abort(external.reason);
  external.addEventListener("abort", onAbort, { once: true });
  return () => external.removeEventListener("abort", onAbort);
}

/**
 * POST JSON với timeout, hủy được và retry lỗi tạm thời.
 * @returns {Promise<object>} body JSON khi 2xx
 * @throws {ApiError|Error} message tiếng Việt
 */
async function postJson(url, body, options = {}) {
  const {
    signal: externalSignal,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retries = DEFAULT_RETRIES,
  } = options;

  let attempt = 0;
  for (;;) {
    attempt += 1;
    const controller = new AbortController();
    const unlink = linkSignal(externalSignal, controller);
    const timer = setTimeout(
      () => controller.abort(new DOMException("Hết thời gian chờ", "TimeoutError")),
      timeoutMs
    );

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      const data = await readJson(res);
      if (res.ok) return data ?? {};

      // Lỗi phía server: ưu tiên message tiếng Việt do backend trả về.
      const msg = (data && data.error) || messageForStatus(res.status);
      if (RETRYABLE_STATUS.has(res.status) && attempt <= retries) {
        await delay(300 * attempt);
        continue;
      }
      throw new ApiError(msg, res.status);
    } catch (err) {
      if (err instanceof ApiError) throw err;

      // Người dùng chủ động hủy.
      if (externalSignal && externalSignal.aborted) {
        throw new ApiError("Đã hủy yêu cầu.", 0);
      }
      // Quá thời gian chờ.
      if (err && (err.name === "TimeoutError" || err.name === "AbortError")) {
        throw new ApiError("Mạng hơi chậm, bạn thử lại giúp tôi nhé.", 0);
      }
      // Lỗi mạng (fetch ném TypeError) — thử lại một lần.
      if (err instanceof TypeError) {
        if (attempt <= retries) {
          await delay(300 * attempt);
          continue;
        }
        throw new ApiError("Không kết nối được. Bạn kiểm tra mạng rồi thử lại nhé.", 0);
      }
      throw new ApiError("Có lỗi xảy ra, bạn thử lại sau nhé.", 0);
    } finally {
      clearTimeout(timer);
      unlink();
    }
  }
}

/**
 * Gửi ảnh (base64) tới GPT-4o Vision, nhận text gốc và giải thích đơn giản.
 * @param {string} base64 - ảnh JPEG đã nén (có/không tiền tố data URL đều được)
 * @param {{signal?: AbortSignal, timeoutMs?: number}} [options]
 * @returns {Promise<{rawText: string, type: string, explanation: string, keyPoints: string[]}>}
 */
export async function analyzeImage(base64, options) {
  if (typeof base64 !== "string" || !base64.trim()) {
    throw new ApiError("Chưa có ảnh. Bạn hãy chụp lại giúp tôi nhé.", 400);
  }
  const data = await postJson("/api/understand", { image: base64 }, options);
  return {
    rawText: typeof data.raw_text === "string" ? data.raw_text : "",
    type: typeof data.type === "string" ? data.type : "khác",
    explanation: typeof data.explanation === "string" ? data.explanation : "",
    keyPoints: Array.isArray(data.key_points)
      ? data.key_points.filter((p) => typeof p === "string")
      : [],
  };
}

/**
 * Hỏi follow-up; câu trả lời grounded trong văn bản đã chụp.
 * @param {string} question
 * @param {string} rawText - văn bản gốc đã chụp (context)
 * @param {{signal?: AbortSignal, timeoutMs?: number}} [options]
 * @returns {Promise<{answer: string}>}
 */
export async function askQuestion(question, rawText, options) {
  if (typeof question !== "string" || !question.trim()) {
    throw new ApiError("Bạn chưa nói câu hỏi.", 400);
  }
  const data = await postJson(
    "/api/ask",
    { question: question.trim(), raw_text: typeof rawText === "string" ? rawText : "" },
    options
  );
  return { answer: typeof data.answer === "string" ? data.answer : "" };
}
