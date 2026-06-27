'use client';

import { useState, useRef, useEffect } from 'react';

/**
 * Mock data — dùng test giao diện ngay
 */
const mockChatMessages = [
  { role: "user", text: "Thuốc này uống lúc bụng đói được không?" },
  { role: "assistant", text: "Dạ không ạ. Tờ giấy ghi là phải uống sau khi ăn. Bác nhớ ăn no rồi mới uống nhé." }
];

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
 */
export default function VoiceChat({
  messages = mockChatMessages,
  isProcessing = false,
  onSendMessage,
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
    if (onSendMessage) {
      // Person C sẽ hook startListening() vào đây
      console.log('[VoiceChat] 🎤 Mic pressed — Person C sẽ wire speech.startListening()');
      onSendMessage('__MIC_PRESSED__');
    } else {
      console.log('[VoiceChat] 🎤 Mic pressed (mock)');
    }
  };

  return (
    <div className="voice-chat fade-in-up">
      <h3 className="voice-chat-title">💬 Hỏi thêm về tờ giấy</h3>

      {/* ═══ Chat Messages ═══ */}
      {messages.length > 0 && (
        <div className="chat-messages" role="log" aria-label="Cuộc hội thoại">
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
      <div className="voice-chat-input-area">
        {/* Nút Mic — cực to */}
        <button
          className={`btn btn-icon btn-mic ${isProcessing ? 'pulse recording' : ''}`}
          onClick={handleMicPress}
          disabled={isProcessing}
          id="btn-mic"
          aria-label={isProcessing ? 'Đang ghi âm...' : 'Nhấn để hỏi bằng giọng nói'}
        >
          {isProcessing ? '⏹️' : '🎤'}
        </button>

        {/* Text input fallback */}
        <div className="text-input-row">
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
            className="btn btn-primary btn-send"
            onClick={handleSend}
            disabled={!inputText.trim() || isProcessing}
            id="btn-send"
            aria-label="Gửi câu hỏi"
          >
            📨
          </button>
        </div>
      </div>

      <style jsx>{`
        .voice-chat {
          display: flex;
          flex-direction: column;
          gap: var(--space-md);
          border-top: 1px solid var(--color-border-strong);
          padding-top: var(--space-lg);
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
          padding: var(--space-sm) 0;
          scroll-behavior: smooth;
        }

        .chat-thinking {
          display: flex;
          align-items: center;
          gap: var(--space-xs);
          font-size: var(--font-size-small);
          color: var(--color-text-muted);
        }

        /* ── Input Area ── */
        .voice-chat-input-area {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-md);
          padding-top: var(--space-sm);
        }

        /* ── Mic Button ── */
        .btn-mic {
          background: linear-gradient(135deg, var(--color-error), #dc2626);
          color: #fff;
          border: 3px solid rgba(248, 113, 113, 0.3);
          box-shadow: 0 0 20px rgba(248, 113, 113, 0.2);
          font-size: 36px;
          transition: all var(--transition-fast);
        }

        .btn-mic:hover:not(:disabled) {
          box-shadow: 0 0 30px rgba(248, 113, 113, 0.4);
        }

        .btn-mic.recording {
          background: linear-gradient(135deg, #dc2626, #991b1b);
          border-color: var(--color-error);
        }

        /* ── Text Input Row ── */
        .text-input-row {
          display: flex;
          gap: var(--space-xs);
          width: 100%;
        }

        .voice-chat-input {
          flex: 1;
          min-height: 48px;
        }

        .btn-send {
          width: 56px;
          min-height: 48px;
          padding: 0;
          font-size: 24px;
          flex-shrink: 0;
        }
      `}</style>
    </div>
  );
}
