'use client';

import { useEffect, useState, useRef } from 'react';

/**
 * CameraCapture Component
 * 
 * Giao diện chụp ảnh văn bản dành cho người cao tuổi.
 * Sử dụng <input type="file" capture="environment"> để mở camera native.
 * 
 * @param {Object} props
 * @param {function} props.onCapture - Callback nhận File khi user bấm "Đọc Giúp Tôi".
 * Person C sẽ convert File thành data URL/base64 rồi gửi API body { image }.
 * @param {boolean} [props.disabled=false] - Disable interactions
 */
export default function CameraCapture({ onCapture, disabled = false }) {
  const [previewUrl, setPreviewUrl] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const cameraInputRef = useRef(null);
  const albumInputRef = useRef(null);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);

    // Tạo preview URL
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    e.target.value = '';
  };

  const handleCaptureTrigger = () => {
    cameraInputRef.current?.click();
  };

  const handleAlbumTrigger = () => {
    albumInputRef.current?.click();
  };

  const handleReadRequest = () => {
    if (selectedFile && onCapture) {
      console.log('[CameraCapture] 📖 User bấm ĐỌC GIÚP TÔI — gửi file:', selectedFile.name, `(${(selectedFile.size / 1024).toFixed(0)}KB)`);
      onCapture(selectedFile);
    }
  };

  const handleRetake = () => {
    setPreviewUrl(null);
    setSelectedFile(null);
    // Reset input value để có thể chọn lại cùng file
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    if (albumInputRef.current) albumInputRef.current.value = '';
  };

  return (
    <div className="camera-capture fade-in">
      {/* Hidden file input — camera native */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="sr-only"
        id="camera-input"
        aria-label="Chụp ảnh văn bản"
        disabled={disabled}
      />
      <input
        ref={albumInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="sr-only"
        id="album-input"
        aria-label="Chọn ảnh từ album"
        disabled={disabled}
      />

      {!previewUrl ? (
        /* ═══ Trạng thái 1: Chưa chụp ═══ */
        <div className="camera-idle">
          <div className="camera-illustration">
            <div className="camera-icon-wrapper breathe">
              <span className="camera-icon" role="img" aria-hidden="true">📷</span>
            </div>
            <p className="camera-hint">
              Chụp ảnh tờ giấy bạn muốn đọc
            </p>
            <p className="camera-hint-sub">
              Nhãn thuốc · Hóa đơn · Giấy tờ
            </p>
          </div>

          <div className="camera-actions">
            <button
              className="btn btn-primary btn-lg camera-capture-btn scale-in"
              onClick={handleCaptureTrigger}
              disabled={disabled}
              id="btn-capture"
              aria-label="Chụp ảnh văn bản"
            >
              <span className="btn-emoji" aria-hidden="true">📷</span>
              CHỤP CHỮ
            </button>

            <button
              className="btn btn-secondary btn-lg camera-album-btn"
              onClick={handleAlbumTrigger}
              disabled={disabled}
              id="btn-album"
              aria-label="Chọn ảnh từ album"
            >
              <span className="btn-emoji" aria-hidden="true">🖼️</span>
              CHỌN ẢNH
            </button>
          </div>
        </div>
      ) : (
        /* ═══ Trạng thái 2: Đã chụp — Preview ═══ */
        <div className="camera-preview fade-in-up">
          <div className="preview-image-container">
            <img
              src={previewUrl}
              alt="Ảnh đã chụp"
              className="image-preview"
            />
            <div className="preview-overlay">
              <span className="preview-check">✅</span>
            </div>
          </div>

          <p className="preview-prompt">
            Bạn muốn tôi đọc giúp tờ giấy này không?
          </p>

          <div className="button-group">
            <button
              className="btn btn-primary btn-lg"
              onClick={handleReadRequest}
              disabled={disabled}
              id="btn-read"
              aria-label="Đọc giúp tôi"
            >
              <span className="btn-emoji" aria-hidden="true">📖</span>
              ĐỌC GIÚP TÔI
            </button>

            <button
              className="btn btn-secondary"
              onClick={handleRetake}
              disabled={disabled}
              id="btn-retake"
              aria-label="Đổi ảnh"
            >
              <span className="btn-emoji" aria-hidden="true">🔄</span>
              ĐỔI ẢNH
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        .camera-capture {
          display: flex;
          flex-direction: column;
          flex: 1;
        }

        /* ── Idle State ── */
        .camera-idle {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: var(--space-xl);
        }

        .camera-illustration {
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-md);
        }

        .camera-icon-wrapper {
          width: 120px;
          height: 120px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--color-primary-muted);
          border-radius: var(--radius-full);
          border: 2px solid rgba(96, 165, 250, 0.2);
        }

        .camera-icon {
          font-size: 56px;
          line-height: 1;
        }

        .camera-hint {
          font-size: var(--font-size-result);
          font-weight: 600;
          color: var(--color-text);
          text-align: center;
        }

        .camera-hint-sub {
          font-size: var(--font-size-small);
          color: var(--color-text-muted);
          text-align: center;
        }

        .camera-actions {
          display: flex;
          flex-direction: column;
          gap: var(--space-sm);
          margin-top: auto;
        }

        .camera-capture-btn {
          margin-top: 0;
        }

        /* ── Preview State ── */
        .camera-preview {
          display: flex;
          flex-direction: column;
          gap: var(--space-lg);
        }

        .preview-image-container {
          position: relative;
          border-radius: var(--radius-lg);
          overflow: hidden;
        }

        .preview-overlay {
          position: absolute;
          top: var(--space-sm);
          right: var(--space-sm);
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(8px);
          border-radius: var(--radius-full);
        }

        .preview-check {
          font-size: 22px;
        }

        .preview-prompt {
          font-size: var(--font-size-body);
          font-weight: 600;
          color: var(--color-text);
          text-align: center;
        }
      `}</style>
    </div>
  );
}
