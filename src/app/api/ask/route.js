// src/app/api/ask/route.js
export async function POST(req) {
  await new Promise(r => setTimeout(r, 1000));
  const { question } = await req.json();

  return Response.json({
    answer: `Dạ, về câu hỏi "${question}" — đây là câu trả lời mẫu từ mock API. Khi real API xong sẽ thay thế.`
  });
}
