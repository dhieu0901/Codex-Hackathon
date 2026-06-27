// src/app/api/understand/route.js
export async function POST(req) {
  // Giả lập delay như real API
  await new Promise(r => setTimeout(r, 1500));

  return Response.json({
    raw_text: "Paracetamol 500mg. Uống 2 viên × 3 lần/ngày sau ăn. Không dùng quá 8 viên/ngày.",
    type: "thuốc",
    explanation: "Mỗi ngày uống 3 lần, mỗi lần 2 viên. Nhớ uống sau khi ăn cơm xong. Một ngày không được uống quá 8 viên.",
    key_points: [
      "Mỗi lần uống 2 viên",
      "Ngày uống 3 lần",
      "Uống sau bữa ăn",
      "Tối đa 8 viên mỗi ngày"
    ]
  });
}
