'use client';

import { useState } from 'react';

const DEFAULT_RESULT_DATA = {
  rawText: "",
  type: "khác",
  explanation: "Tôi chưa có nội dung để hiển thị.",
  keyPoints: []
};

/**
 * Type → Badge config mapping
 */
const TYPE_CONFIG = {
  'thuốc':    { emoji: '💊', label: 'Thuốc',    className: 'badge-medicine' },
  'hóa đơn':  { emoji: '🧾', label: 'Hóa đơn',  className: 'badge-bill' },
  'công văn':  { emoji: '📄', label: 'Công văn',  className: 'badge-document' },
  'biểu mẫu':  { emoji: '📋', label: 'Biểu mẫu', className: 'badge-form' },
  'khác':     { emoji: '📝', label: 'Khác',     className: 'badge-other' },
};

/**
 * ResultDisplay Component
 * 
 * Hiển thị kết quả phân tích văn bản với chữ to, rõ ràng.
 * 
 * @param {Object} props
 * @param {string} props.rawText - Văn bản gốc. Person C map từ API raw_text.
 * @param {string} props.type - Loại văn bản (thuốc/hóa đơn/công văn/biểu mẫu/khác)
 * @param {string} props.explanation - Giải thích đơn giản
 * @param {string[]} props.keyPoints - Các ý chính. Person C map từ API key_points.
 * @param {function} props.onListenAgain - Callback khi bấm "Nghe lại"
 * @param {function} props.onNewCapture - Callback khi bấm "Chụp mới"
 */
export default function ResultDisplay({
  rawText = DEFAULT_RESULT_DATA.rawText,
  type = DEFAULT_RESULT_DATA.type,
  explanation = DEFAULT_RESULT_DATA.explanation,
  keyPoints = DEFAULT_RESULT_DATA.keyPoints,
  onListenAgain,
  onNewCapture,
}) {
  const [isRawTextOpen, setIsRawTextOpen] = useState(false);
  const typeConfig = TYPE_CONFIG[type] || TYPE_CONFIG['khác'];
  const visibleKeyPoints = Array.isArray(keyPoints)
    ? keyPoints
        .map((point) => (typeof point === 'string' ? point.trim() : String(point || '').trim()))
        .filter(Boolean)
    : [];

  const handleListenAgain = () => {
    if (onListenAgain) {
      onListenAgain();
    } else {
      console.log('[ResultDisplay] 🔊 NGHE LẠI — explanation:', explanation);
    }
  };

  const handleNewCapture = () => {
    if (onNewCapture) {
      onNewCapture();
    } else {
      console.log('[ResultDisplay] 📷 CHỤP MỚI');
    }
  };

  return (
    <div className="result-display fade-in-up">
      {/* ═══ Badge loại văn bản ═══ */}
      <div className="result-header">
        <span className={`badge ${typeConfig.className}`}>
          <span aria-hidden="true">{typeConfig.emoji}</span>
          {typeConfig.label}
        </span>
      </div>

      {/* ═══ Giải thích đơn giản — text cực to ═══ */}
      <div className="card-gradient result-explanation-card">
        <h2 className="result-explanation-label">💡 Nội dung chính</h2>
        <p className="result-explanation-text">
          {explanation}
        </p>
      </div>

      {/* ═══ Key Points — bullet points rõ ràng ═══ */}
      {keyPoints && keyPoints.length > 0 && visibleKeyPoints.length > 0 && (
        <div className="result-keypoints section-gap">
          <h3 className="result-section-title">📌 Ý quan trọng</h3>
          <ul className="key-points">
            {visibleKeyPoints.map((point, index) => (
              <li key={index} className="key-point-item">
                <span className="key-point-icon" aria-hidden="true">✅</span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ═══ Disclaimer thuốc ═══ */}
      {type === 'thuốc' && (
        <div className="disclaimer fade-in">
          <span className="disclaimer-icon" aria-hidden="true">⚕️</span>
          <span>Nếu chưa chắc, hãy hỏi lại bác sĩ hoặc dược sĩ nhé.</span>
        </div>
      )}

      {/* ═══ Accordion: Xem văn bản gốc ═══ */}
      <div className="accordion section-gap">
        <button
          className="accordion-trigger"
          onClick={() => setIsRawTextOpen(!isRawTextOpen)}
          aria-expanded={isRawTextOpen}
          aria-controls="raw-text-content"
          id="btn-toggle-raw"
        >
          <span>📝 Xem văn bản gốc</span>
          <span className="accordion-icon" aria-hidden="true">
            {isRawTextOpen ? '▲' : '▼'}
          </span>
        </button>
        <div
          id="raw-text-content"
          className={`accordion-content ${isRawTextOpen ? 'open' : ''}`}
          role="region"
          aria-labelledby="btn-toggle-raw"
        >
          <div className="accordion-body">
            {rawText}
          </div>
        </div>
      </div>

      {/* ═══ Action Buttons ═══ */}
      <div className="button-group section-gap">
        <button
          className="btn btn-blue btn-lg"
          onClick={handleListenAgain}
          id="btn-listen-again"
          aria-label="Nghe lại nội dung"
        >
          <span className="btn-emoji" aria-hidden="true">🔊</span>
          NGHE LẠI
        </button>

        <button
          className="btn btn-secondary"
          onClick={handleNewCapture}
          id="btn-new-capture"
          aria-label="Chụp ảnh mới"
        >
          <span className="btn-emoji" aria-hidden="true">📷</span>
          CHỤP MỚI
        </button>
      </div>

      <style jsx>{`
        .result-display {
          display: flex;
          flex-direction: column;
          gap: var(--space-md);
          padding-bottom: 96px;
        }

        .result-header {
          display: flex;
          align-items: center;
          gap: var(--space-sm);
        }

        .result-explanation-card {
          margin-top: var(--space-xs);
        }

        .result-explanation-label {
          font-size: var(--font-size-body);
          font-weight: 600;
          color: var(--color-text-muted);
          margin-bottom: var(--space-sm);
        }

        .result-explanation-text {
          font-size: var(--font-size-result);
          font-weight: 600;
          color: var(--color-text);
          line-height: 1.5;
        }

        .result-section-title {
          font-size: var(--font-size-body);
          font-weight: 700;
          color: var(--color-text);
          margin-bottom: var(--space-sm);
        }

        .key-points {
          list-style-type: none;
          padding-left: 0;
          margin: 0;
          gap: var(--space-md);
        }

        .key-point-item {
          margin: 0 0 12px;
          border: 1px solid #bae6fd;
          color: #0f172a;
          font-weight: 500;
          opacity: 1;
        }

        .key-point-item:last-child {
          margin-bottom: 0;
        }

        .disclaimer {
          background: var(--color-warning-muted);
          color: #9a3412;
          border-color: rgba(234, 88, 12, 0.32);
          font-size: var(--font-size-body);
          line-height: 1.6;
        }

        .accordion-body {
          font-size: var(--font-size-body);
          color: var(--color-text-secondary);
          line-height: 1.6;
        }
      `}</style>
    </div>
  );
}
