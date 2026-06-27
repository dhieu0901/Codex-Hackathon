'use client';

import {
  Camera,
  ChevronDown,
  ChevronUp,
  CircleCheck,
  ClipboardList,
  FilePenLine,
  FileText,
  Lightbulb,
  ListChecks,
  Pill,
  ReceiptText,
  Stethoscope,
  Volume2,
} from 'lucide-react';
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
  'thuốc':     { Icon: Pill,          label: 'Thuốc',     className: 'badge-medicine' },
  'hóa đơn':   { Icon: ReceiptText,   label: 'Hóa đơn',   className: 'badge-bill' },
  'công văn':  { Icon: FileText,      label: 'Công văn',  className: 'badge-document' },
  'biểu mẫu':  { Icon: ClipboardList, label: 'Biểu mẫu',  className: 'badge-form' },
  'khác':      { Icon: FilePenLine,   label: 'Khác',      className: 'badge-other' },
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
  const TypeIcon = typeConfig.Icon;
  const visibleKeyPoints = Array.isArray(keyPoints)
    ? keyPoints
        .map((point) => (typeof point === 'string' ? point.trim() : String(point || '').trim()))
        .filter(Boolean)
    : [];

  const handleListenAgain = () => {
    if (onListenAgain) {
      onListenAgain();
    } else {
      console.log('[ResultDisplay] NGHE LẠI — explanation:', explanation);
    }
  };

  const handleNewCapture = () => {
    if (onNewCapture) {
      onNewCapture();
    } else {
      console.log('[ResultDisplay] CHỤP MỚI');
    }
  };

  return (
    <div className="result-display fade-in-up">
      {/* ═══ Badge loại văn bản ═══ */}
      <div className="result-header">
        <span className={`badge ${typeConfig.className}`}>
          <TypeIcon className="type-icon" size={22} strokeWidth={2.2} aria-hidden="true" />
          {typeConfig.label}
        </span>
      </div>

      {/* ═══ Giải thích đơn giản — text cực to ═══ */}
      <div className="card-gradient result-explanation-card">
        <h2 className="result-explanation-label">
          <Lightbulb className="section-icon section-icon-accent" size={22} strokeWidth={2.2} aria-hidden="true" />
          Nội dung chính
        </h2>
        <p className="result-explanation-text">
          {explanation}
        </p>
      </div>

      {/* ═══ Key Points — bullet points rõ ràng ═══ */}
      {keyPoints && keyPoints.length > 0 && visibleKeyPoints.length > 0 && (
        <div className="result-keypoints section-gap">
          <h3 className="result-section-title">
            <ListChecks className="section-icon" size={23} strokeWidth={2.3} aria-hidden="true" />
            Ý quan trọng
          </h3>
          <ul className="key-points">
            {visibleKeyPoints.map((point, index) => (
              <li key={index} className="key-point-item">
                <CircleCheck className="key-point-icon" size={23} strokeWidth={2.4} aria-hidden="true" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ═══ Disclaimer thuốc ═══ */}
      {type === 'thuốc' && (
        <div className="disclaimer fade-in">
          <Stethoscope className="disclaimer-icon" size={24} strokeWidth={2.2} aria-hidden="true" />
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
          type="button"
        >
          <span className="accordion-label">
            <FileText className="accordion-label-icon" size={22} strokeWidth={2.1} aria-hidden="true" />
            Xem văn bản gốc
          </span>
          <span className="accordion-icon" aria-hidden="true">
            {isRawTextOpen
              ? <ChevronUp size={24} strokeWidth={2.4} />
              : <ChevronDown size={24} strokeWidth={2.4} />}
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
          type="button"
        >
          <Volume2 className="button-icon button-icon-primary" size={25} strokeWidth={2.3} aria-hidden="true" />
          NGHE LẠI
        </button>

        <button
          className="btn btn-secondary"
          onClick={handleNewCapture}
          id="btn-new-capture"
          aria-label="Chụp ảnh mới"
          type="button"
        >
          <Camera className="button-icon" size={22} strokeWidth={2.3} aria-hidden="true" />
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

        .type-icon,
        .section-icon,
        .accordion-label-icon,
        .button-icon {
          flex-shrink: 0;
          color: currentColor;
        }

        .result-explanation-card {
          margin-top: var(--space-xs);
        }

        .result-explanation-label {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: var(--font-size-body);
          font-weight: 600;
          color: var(--color-text-muted);
          margin-bottom: var(--space-sm);
        }

        .section-icon-accent {
          color: var(--color-accent);
        }

        .result-explanation-text {
          font-size: var(--font-size-result);
          font-weight: 600;
          color: var(--color-text);
          line-height: 1.5;
        }

        .result-section-title {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: var(--font-size-body);
          font-weight: 700;
          color: var(--color-text);
          margin-bottom: var(--space-sm);
        }

        .result-section-title .section-icon {
          color: var(--color-primary);
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

        .key-point-icon {
          flex-shrink: 0;
          margin-top: 1px;
          color: #15803d;
        }

        .disclaimer {
          background: var(--color-warning-muted);
          color: #9a3412;
          border-color: rgba(234, 88, 12, 0.32);
          font-size: var(--font-size-body);
          line-height: 1.6;
        }

        .disclaimer-icon {
          flex-shrink: 0;
          margin-top: 2px;
          color: #ea580c;
        }

        .accordion-label {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }

        .accordion-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: var(--color-text-secondary);
        }

        .accordion-body {
          font-size: var(--font-size-body);
          color: var(--color-text-secondary);
          line-height: 1.6;
        }

        .button-icon-primary {
          color: #fff;
        }
      `}</style>
    </div>
  );
}
