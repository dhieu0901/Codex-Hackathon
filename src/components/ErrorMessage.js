'use client';

import { Camera, RotateCcw, TriangleAlert } from 'lucide-react';

/**
 * ErrorMessage Component
 *
 * Thông báo lỗi thân thiện bằng tiếng Việt cho người cao tuổi.
 * Icon to, chữ to, nút "Thử lại" rõ ràng.
 *
 * @param {Object} props
 * @param {string} [props.message] - Thông báo lỗi tiếng Việt
 * @param {function} props.onRetry - Callback khi bấm "Thử lại"
 * @param {function} props.onNewCapture - Callback khi bấm "Chụp lại"
 */
export default function ErrorMessage({
  message = "Xin lỗi, tôi không đọc được. Bạn thử chụp lại rõ hơn nhé?",
  onRetry,
  onNewCapture,
}) {
  const handleRetry = () => {
    if (onRetry) {
      onRetry();
    } else {
      console.log('[ErrorMessage] User bấm THỬ LẠI');
    }
  };

  const handleNewCapture = () => {
    if (onNewCapture) {
      onNewCapture();
    } else {
      console.log('[ErrorMessage] User bấm CHỤP LẠI');
    }
  };

  return (
    <div className="error-state fade-in" role="alert">
      <div className="error-visual">
        <div className="error-icon-wrapper">
          <TriangleAlert className="error-icon" size={48} strokeWidth={1.9} aria-hidden="true" />
        </div>
        <p className="error-message">{message}</p>
      </div>

      <div className="button-group">
        <button
          className="btn btn-primary btn-lg"
          onClick={handleRetry}
          id="btn-retry"
          aria-label="Thử lại"
          type="button"
        >
          <RotateCcw className="button-icon button-icon-primary" size={24} strokeWidth={2.3} aria-hidden="true" />
          THỬ LẠI
        </button>

        <button
          className="btn btn-secondary"
          onClick={handleNewCapture}
          id="btn-error-new-capture"
          aria-label="Chụp lại ảnh"
          type="button"
        >
          <Camera className="button-icon" size={22} strokeWidth={2.3} aria-hidden="true" />
          CHỤP LẠI
        </button>
      </div>

      <style jsx>{`
        .error-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-xl);
          padding: var(--space-xl) 0;
        }

        .error-visual {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-lg);
          text-align: center;
        }

        .error-icon-wrapper {
          width: 100px;
          height: 100px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--color-error-muted);
          border-radius: var(--radius-full);
          border: 2px solid rgba(185, 28, 28, 0.2);
        }

        .error-icon {
          color: var(--color-error);
          filter: drop-shadow(0 4px 12px rgba(185, 28, 28, 0.12));
        }

        .button-icon {
          flex-shrink: 0;
          color: currentColor;
        }

        .button-icon-primary {
          color: #fff;
        }

        .error-message {
          font-size: var(--font-size-result);
          font-weight: 600;
          color: var(--color-text);
          line-height: 1.5;
          max-width: 320px;
        }
      `}</style>
    </div>
  );
}
