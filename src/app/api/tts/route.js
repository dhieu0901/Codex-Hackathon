// src/app/api/tts/route.js
// Giọng đọc tự nhiên bằng OpenAI TTS (gpt-4o-mini-tts) — giọng nữ, ấm, dễ nghe.
import OpenAI from 'openai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const MODEL = 'gpt-4o-mini-tts';
const DEFAULT_VOICE = 'coral'; // giọng nữ ấm áp
const MAX_TEXT_LEN = 2000;

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Dữ liệu gửi lên không hợp lệ.' }, { status: 400 });
  }

  const text = typeof body?.text === 'string' ? body.text.trim() : '';
  if (!text) {
    return Response.json({ error: 'Không có nội dung để đọc.' }, { status: 400 });
  }
  if (!process.env.OPENAI_API_KEY) {
    return Response.json({ error: 'Hệ thống chưa được cấu hình. Vui lòng báo người quản trị.' }, { status: 503 });
  }

  const voice = typeof body?.voice === 'string' && body.voice ? body.voice : DEFAULT_VOICE;
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 25_000, maxRetries: 1 });

  try {
    const speech = await openai.audio.speech.create({
      model: MODEL,
      voice,
      input: text.slice(0, MAX_TEXT_LEN),
      response_format: 'mp3',
      instructions:
        'Đọc bằng tiếng Việt, giọng nữ ấm áp, rõ ràng, chậm rãi và thân thiện như đang nói chuyện với ông bà lớn tuổi.',
    });

    const buffer = Buffer.from(await speech.arrayBuffer());
    return new Response(buffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    const status = err?.status;
    if (status === 401) {
      return Response.json({ error: 'Hệ thống chưa được cấu hình đúng. Vui lòng báo người quản trị.' }, { status: 503 });
    }
    if (status === 429) {
      return Response.json({ error: 'Hệ thống đang bận, bạn chờ một chút rồi thử lại nhé.' }, { status: 429 });
    }
    console.error('[tts] OpenAI error:', err);
    return Response.json({ error: 'Không đọc được, bạn thử lại nhé.' }, { status: 502 });
  }
}
