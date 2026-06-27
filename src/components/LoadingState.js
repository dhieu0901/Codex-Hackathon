'use client';

import { Volume2 } from 'lucide-react';

/**
 * LoadingState Component
 *
 * Trạng thái chờ khi đang phân tích văn bản.
 * Dùng shimmer animation nhẹ nhàng, không gây hoang mang cho người già.
 *
 * @param {Object} props
 * @param {string} [props.message="Đang đọc giúp bạn..."] - Thông báo hiển thị
 */
export default function LoadingState({ message = "Đang đọc giúp bạn..." }) {
  return (
    <div className="loading-state fade-in" role="status" aria-live="polite">
      <div className="loading-visual">
        <div className="loading-icon-wrapper breathe">
          <Volume2 className="loading-icon" size={48} strokeWidth={1.9} aria-hidden="true" />
        </div>
        <p className="loading-message">{message}</p>
        <div className="loading-dots" aria-hidden="true">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>

      {/* Shimmer skeleton — giả lập nội dung đang load */}
      <div className="loading-skeleton">
        <div className="skeleton-badge shimmer"></div>
        <div className="skeleton-card">
          <div className="shimmer shimmer-line"></div>
          <div className="shimmer shimmer-line"></div>
          <div className="shimmer shimmer-line" style={{ width: '75%' }}></div>
        </div>
        <div className="skeleton-points">
          <div className="shimmer shimmer-line"></div>
          <div className="shimmer shimmer-line"></div>
          <div className="shimmer shimmer-line" style={{ width: '60%' }}></div>
        </div>
      </div>

      <style jsx>{`
        .loading-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-xl);
          padding: var(--space-xl) 0;
        }

        .loading-visual {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-md);
        }

        .loading-icon-wrapper {
          width: 100px;
          height: 100px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--color-primary-muted);
          border-radius: var(--radius-full);
          border: 2px solid rgba(37, 99, 235, 0.2);
        }

        .loading-icon {
          color: var(--color-primary);
          filter: drop-shadow(0 4px 12px rgba(37, 99, 235, 0.14));
        }

        .loading-message {
          font-size: 22px;
          font-weight: 600;
          color: var(--color-text);
          text-align: center;
        }

        /* ── Shimmer Skeleton ── */
        .loading-skeleton {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: var(--space-md);
          opacity: 0.5;
        }

        .skeleton-badge {
          width: 100px;
          height: 36px;
          border-radius: var(--radius-full);
        }

        .skeleton-card {
          padding: var(--space-lg);
          background: var(--color-surface);
          border-radius: var(--radius-lg);
          display: flex;
          flex-direction: column;
          gap: var(--space-sm);
        }

        .skeleton-points {
          padding: var(--space-md);
          display: flex;
          flex-direction: column;
          gap: var(--space-sm);
        }
      `}</style>
    </div>
  );
}
