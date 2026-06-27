'use client';

import { useState, useRef, useEffect } from 'react';

/**
 * VoiceChat Component
 * 
 * Giao diện hỏi đáp bằng giọng nói / text.
 * Chat bubbles: user bên phải (accent), assistant bên trái (surface).
 * Nút mic cực to với pulse animation khi đang xử lý.
 * 
 * @param {Object} props
 * @param {Array<{role: string, text: string}>} props.messages - Danh sách tin nhắn
 * @param {boolean} props.isProcessing - Đang ghi âm/xử lý
 * @param {function} props.onSendMessage - Callback gửi tin nhắn (text)
 * @param {function} props.onMicPress - Callback khi người dùng bấm nút micro
 */
export default function VoiceChat({
  messages = [],
  isProcessing = false,
  onSendMessage,
  onMicPress,
}) {
  const [inputText, setInputText] = useState('');
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto scroll xuống cuối khi có tin nhắn mới
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    const text = inputText.trim();
    if (!text) return;

    if (onSendMessage) {
      onSendMessage(text);
    } else {
      console.log('[VoiceChat] 💬 User gửi:', text);
    }
    setInputText('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleMicPress = () => {
    if (onMicPress) {
      onMicPress();
    } else {
      console.log('[VoiceChat] 🎤 Mic pressed — waiting for speech wiring');
    }
  };

  return (
    <div className="voice-chat fade-in-up">
      <h3 className="voice-chat-title">💬 Hỏi thêm về thông tin</h3>

      {/* ═══ Chat Messages ═══ */}
      {messages.length > 0 && (
        <div className="message-list chat-messages" role="log" aria-label="Cuộc hội thoại">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`chat-bubble ${
                msg.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-assistant'
              }`}
            >
              {msg.text}
            </div>
          ))}

          {/* Đang xử lý — hiện loading trong chat */}
          {isProcessing && (
            <div className="chat-bubble chat-bubble-assistant">
              <span className="chat-thinking">
                Đang trả lời
                <span className="loading-dots" aria-hidden="true">
                  <span></span>
                  <span></span>
                  <span></span>
                </span>
              </span>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>
      )}

      {/* ═══ Input Area ═══ */}
      <div className="chat-input-container">
        <input
          ref={inputRef}
          type="text"
          className="input voice-chat-input"
          placeholder="Hoặc gõ câu hỏi ở đây..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isProcessing}
          id="input-question"
          aria-label="Gõ câu hỏi"
        />

        <button
          className={`btn btn-icon btn-mic ${isProcessing ? 'pulse recording' : ''}`}
          onClick={handleMicPress}
          disabled={isProcessing}
          id="btn-mic"
          aria-label={isProcessing ? 'Đang ghi âm...' : 'Nhấn để hỏi bằng giọng nói'}
        >
          {isProcessing ? '⏹️' : '🎤'}
        </button>

        <button
          className="btn btn-primary btn-send"
          onClick={handleSend}
          disabled={!inputText.trim() || isProcessing}
          id="btn-send"
          aria-label="Gửi câu hỏi"
        >
          📨
        </button>
      </div>

      <style jsx>{`
        .voice-chat {
          display: flex;
          flex-direction: column;
          gap: var(--space-md);
          border-top: 1px solid #e2e8f0;
          padding-top: var(--space-lg);
          margin: 0 calc(var(--space-md) * -1);
        }

        .voice-chat-title {
          font-size: var(--font-size-body);
          font-weight: 700;
          color: var(--color-text);
        }

        /* ── Chat Messages ── */
        .chat-messages {
          display: flex;
          flex-direction: column;
          gap: var(--space-sm);
          max-height: 360px;
          overflow-y: auto;
          padding: var(--space-sm) var(--space-md) 80px;
          scroll-behavior: smooth;
        }

        .chat-bubble {
          padding: 16px 20px;
          font-size: var(--font-size-body);
          line-height: 1.5;
        }

        .chat-thinking {
          display: flex;
          align-items: center;
          gap: var(--space-xs);
          font-size: var(--font-size-small);
          color: var(--color-text-muted);
        }

        .message-list {
          padding-bottom: 80px;
        }

        /* ── Input Area ── */
        .chat-input-container {
          position: sticky;
          bottom: 0;
          z-index: 10;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          background: var(--color-surface);
          border-top: 1px solid #e2e8f0;
        }

        .chat-input-container .btn {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        /* ── Mic Button ── */
        .btn-mic {
          width: 52px;
          height: 52px;
          min-width: 52px;
          min-height: 52px;
          flex-shrink: 0;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--color-primary), #1d4ed8);
          color: #fff;
          border: 3px solid rgba(37, 99, 235, 0.22);
          box-shadow: 0 8px 20px rgba(37, 99, 235, 0.18);
          font-size: 24px;
          transition: all var(--transition-fast);
        }

        .btn-mic:hover:not(:disabled) {
          box-shadow: 0 10px 24px rgba(37, 99, 235, 0.24);
        }

        .btn-mic.recording {
          background: linear-gradient(135deg, var(--color-accent), #c2410c);
          border-color: rgba(234, 88, 12, 0.32);
        }

        .voice-chat-input {
          flex: 1;
          height: 52px;
          min-height: 52px;
          padding: 0 20px;
          border: 1px solid #cbd5e1;
          border-radius: 26px;
        }

        .voice-chat-input::placeholder {
          color: #94a3b8;
          opacity: 1;
        }

        .btn-send {
          width: 52px;
          height: 52px;
          min-width: 52px;
          min-height: 52px;
          flex-shrink: 0;
          padding: 0;
          border-radius: 50%;
          font-size: 24px;
        }
      `}</style>
    </div>
  );
}
