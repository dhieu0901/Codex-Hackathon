// src/app/api/ask/route.js
// Q&A grounded on the text extracted from the user's document.
import OpenAI from 'openai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const MODEL = 'gpt-4o';
const MAX_RAW_TEXT_LEN = 12_000;

function jsonResponse(body, status = 200) {
  return Response.json(body, { status });
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Dữ liệu gửi lên không hợp lệ.' }, 400);
  }

  const question = normalizeText(body?.question);
  const rawText = normalizeText(body?.rawText || body?.raw_text);

  if (!question) {
    return jsonResponse({ error: 'Bạn hãy nhập câu hỏi trước nhé.' }, 400);
  }

  if (!rawText) {
    return jsonResponse({ error: 'Tôi chưa có nội dung tờ giấy để trả lời. Bạn hãy chụp ảnh trước nhé.' }, 400);
  }

  if (!process.env.OPENAI_API_KEY) {
    return jsonResponse({ error: 'Hệ thống chưa được cấu hình. Vui lòng báo người quản trị.' }, 503);
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 25_000,
    maxRetries: 1,
  });

  try {
    const completion = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0.2,
      max_tokens: 500,
      messages: [
        {
          role: 'system',
          content:
            'Bạn là trợ lý cho người cao tuổi Việt Nam, giúp họ hiểu tờ giấy vừa chụp (thường là nhãn thuốc, hóa đơn, giấy tờ). ' +
            'Ưu tiên trả lời dựa trên VĂN BẢN GỐC. Nhưng nếu người dùng hỏi thêm kiến thức chung mà văn bản không có ' +
            '(ví dụ "thuốc này là thuốc gì", "thuốc chữa bệnh gì", "tác dụng phụ ra sao"), hãy dùng kiến thức của bạn để giải thích ngắn gọn, dễ hiểu. ' +
            'Luôn dùng tiếng Việt đơn giản, câu ngắn, lễ phép (dạ, ạ). ' +
            'Với thông tin về thuốc và sức khỏe: chỉ giải thích chung, KHÔNG chẩn đoán hay kê liều riêng cho người dùng, ' +
            'và nhắc họ hỏi bác sĩ hoặc dược sĩ nếu cần chắc chắn. Nếu thật sự không biết thì nói thật là chưa rõ.',
        },
        {
          role: 'user',
          content: `VĂN BẢN GỐC:\n${rawText.slice(0, MAX_RAW_TEXT_LEN)}\n\nCÂU HỎI:\n${question}`,
        },
      ],
    });

    const answer = completion?.choices?.[0]?.message?.content?.trim();
    return jsonResponse({
      answer: answer || 'Tôi chưa trả lời được câu hỏi này. Bạn hỏi lại ngắn hơn nhé.',
    });
  } catch (err) {
    const status = err?.status;
    if (status === 401) {
      return jsonResponse({ error: 'Hệ thống chưa được cấu hình đúng. Vui lòng báo người quản trị.' }, 503);
    }
    if (status === 429) {
      return jsonResponse({ error: 'Hệ thống đang bận, bạn chờ một chút rồi thử lại nhé.' }, 429);
    }
    if (err?.name === 'APIUserAbortError' || /timeout/i.test(err?.message || '')) {
      return jsonResponse({ error: 'Mạng hơi chậm, bạn thử lại giúp tôi nhé.' }, 504);
    }

    console.error('[ask] OpenAI error:', err);
    return jsonResponse({ error: 'Có lỗi khi trả lời. Bạn thử lại sau ít phút nhé.' }, 502);
  }
}
