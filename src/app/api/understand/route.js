// src/app/api/understand/route.js
// DG-A02 — Đọc ảnh văn bản bằng GPT-4o Vision: trả về text gốc + giải thích đơn giản.
import OpenAI from "openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30; // Vercel: cho phép chạy tới 30s

const MODEL = "gpt-4o";
const MAX_BASE64_LEN = 7_000_000; // ~5MB ảnh sau khi encode base64
const VALID_TYPES = ["thuốc", "hóa đơn", "công văn", "biểu mẫu", "khác"];

const SYSTEM_PROMPT = `Bạn giúp người cao tuổi Việt Nam đọc và HIỂU văn bản họ chụp.

Trả về DUY NHẤT một JSON hợp lệ (không markdown, không giải thích thêm) đúng dạng:
{
  "raw_text": "chép nguyên văn tiếng Việt trong ảnh, giữ đúng dấu, xuống dòng bằng \\n",
  "type": "một trong: thuốc | hóa đơn | công văn | biểu mẫu | khác",
  "explanation": "giải thích lại bằng lời nói hằng ngày, NGẮN, như đang nói chuyện với ông bà. Ví dụ 'uống 2 viên x 3 lần/ngày sau ăn' -> 'Mỗi ngày uống 3 lần, mỗi lần 2 viên, uống sau khi ăn cơm xong.'",
  "key_points": ["2-4 ý quan trọng nhất, mỗi ý 1 câu ngắn"]
}

Quy tắc:
- Dùng từ đơn giản, câu ngắn, KHÔNG thuật ngữ.
- Nếu chữ mờ không chắc, nói rõ trong explanation: "chỗ này tôi đọc chưa rõ".
- Nếu là thuốc: nói rõ liều lượng, số lần/ngày, uống lúc nào (trước/sau ăn).
- Nếu là hóa đơn: tóm tắt tổng tiền và hạn thanh toán.
- Nếu là giấy tờ/công văn: ai gửi, nội dung chính, mình cần làm gì.
- Nếu ảnh KHÔNG có chữ đọc được: raw_text = "", type = "khác", explanation báo nhẹ nhàng để chụp lại rõ hơn, key_points = [].`;

function errorResponse(message, status) {
  return Response.json({ error: message }, { status });
}

// Chuẩn hoá input thành data URL mà OpenAI Vision yêu cầu.
function toDataUrl(image) {
  if (typeof image !== "string") return null;
  const trimmed = image.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("data:image/")) return trimmed;
  return `data:image/jpeg;base64,${trimmed}`;
}

// Bảo đảm payload luôn đúng contract dù model trả thiếu/sai field.
function normalize(parsed) {
  const type = VALID_TYPES.includes(parsed?.type) ? parsed.type : "khác";
  const keyPoints = Array.isArray(parsed?.key_points)
    ? parsed.key_points.filter((p) => typeof p === "string" && p.trim()).slice(0, 4)
    : [];
  return {
    raw_text: typeof parsed?.raw_text === "string" ? parsed.raw_text : "",
    type,
    explanation:
      typeof parsed?.explanation === "string" && parsed.explanation.trim()
        ? parsed.explanation
        : "Xin lỗi, tôi đọc chưa rõ tờ này. Bạn thử chụp lại gần và rõ hơn nhé.",
    key_points: keyPoints,
  };
}

export async function POST(req) {
  // 1) Đọc & validate input
  let body;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Dữ liệu gửi lên không hợp lệ.", 400);
  }

  const dataUrl = toDataUrl(body?.image);
  if (!dataUrl) {
    return errorResponse("Chưa có ảnh. Bạn hãy chụp lại giúp tôi nhé.", 400);
  }
  if (dataUrl.length > MAX_BASE64_LEN) {
    return errorResponse("Ảnh quá lớn, bạn thử chụp lại nhỏ hơn nhé.", 413);
  }

  // 2) Kiểm tra cấu hình
  if (!process.env.OPENAI_API_KEY) {
    return errorResponse("Hệ thống chưa được cấu hình. Vui lòng báo người quản trị.", 503);
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 25_000,
    maxRetries: 1,
  });

  // 3) Gọi GPT-4o Vision
  let completion;
  try {
    completion = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0.2,
      max_tokens: 1500,
      response_format: { type: "json_object" },
      messages: [
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
      ],
    });
  } catch (err) {
    const status = err?.status;
    if (status === 401) {
      return errorResponse("Hệ thống chưa được cấu hình đúng. Vui lòng báo người quản trị.", 503);
    }
    if (status === 429) {
      return errorResponse("Hệ thống đang bận, bạn chờ một chút rồi thử lại nhé.", 429);
    }
    if (err?.name === "APIUserAbortError" || /timeout/i.test(err?.message || "")) {
      return errorResponse("Mạng hơi chậm, bạn thử lại giúp tôi nhé.", 504);
    }
    console.error("[understand] OpenAI error:", err);
    return errorResponse("Có lỗi xảy ra, bạn thử lại sau ít phút nhé.", 502);
  }

  // 4) Parse JSON an toàn
  const content = completion?.choices?.[0]?.message?.content || "";
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    console.error("[understand] JSON parse fail:", content.slice(0, 300));
    return errorResponse("Tôi đọc chưa rõ tờ này. Bạn thử chụp lại giúp tôi nhé.", 502);
  }

  return Response.json(normalize(parsed));
}
