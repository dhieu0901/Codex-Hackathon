"use client";

export default function Home() {
  return (
    <div className="app-container">
      <main className="main-content">
        <div className="hero">
          <h1 className="app-title">📖 Đọc Giúp</h1>
          <p className="app-subtitle">
            Chụp văn bản — Nghe giải thích đơn giản
          </p>
        </div>

        <button className="btn btn-primary btn-capture" id="btn-capture">
          📷 CHỤP CHỮ
        </button>

        <p className="hint-text">
          Bấm nút trên để chụp nhãn thuốc, hóa đơn, hoặc giấy tờ
        </p>
      </main>
    </div>
  );
}
