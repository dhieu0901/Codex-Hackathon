'use client';

import { useState } from 'react';
import CameraCapture from '../components/CameraCapture';
import ResultDisplay from '../components/ResultDisplay';
import LoadingState from '../components/LoadingState';
import ErrorMessage from '../components/ErrorMessage';
import VoiceChat from '../components/VoiceChat';

/**
 * Demo Page — Person B preview tất cả component
 * Person C sẽ thay thế bằng page.js thật có state machine + API wiring
 */

const mockResultData = {
  rawText: "Paracetamol 500mg. Uống 2 viên × 3 lần/ngày sau ăn.",
  type: "thuốc",
  explanation: "Mỗi ngày uống 3 lần, mỗi lần 2 viên. Uống sau khi ăn cơm xong.",
  keyPoints: ["Mỗi lần uống 2 viên", "Ngày uống 3 lần", "Uống sau bữa ăn"]
};

const mockChatMessages = [
  { role: "user", text: "Thuốc này uống lúc bụng đói được không?" },
  { role: "assistant", text: "Dạ không ạ. Tờ giấy ghi là phải uống sau khi ăn. Bác nhớ ăn no rồi mới uống nhé." }
];

export default function Home() {
  // Simulated screens: 'camera' | 'loading' | 'result' | 'error'
  const [screen, setScreen] = useState('camera');
  const [chatMessages, setChatMessages] = useState(mockChatMessages);

  const handleCapture = (file) => {
    console.log('[Page] 📸 File captured:', file.name);
    setScreen('loading');
    // Giả lập API call
    setTimeout(() => setScreen('result'), 2000);
  };

  const handleNewCapture = () => {
    setScreen('camera');
    setChatMessages([]);
  };

  const handleRetry = () => {
    setScreen('loading');
    setTimeout(() => setScreen('result'), 2000);
  };

  const handleListenAgain = () => {
    console.log('[Page] 🔊 Đọc lại explanation');
  };

  const handleSendMessage = (text) => {
    console.log('[Page] 💬 Question:', text);
    setChatMessages(prev => [...prev, { role: 'user', text }]);
    // Giả lập response
    setTimeout(() => {
      setChatMessages(prev => [
        ...prev,
        { role: 'assistant', text: 'Dạ, theo tờ giấy thì bác nên uống sau bữa ăn ạ.' }
      ]);
    }, 1500);
  };

  return (
    <>
      {screen === 'camera' && (
        <CameraCapture onCapture={handleCapture} />
      )}

      {screen === 'loading' && (
        <LoadingState />
      )}

      {screen === 'error' && (
        <ErrorMessage
          message="Xin lỗi, tôi không đọc được. Bạn thử chụp lại rõ hơn nhé?"
          onRetry={handleRetry}
          onNewCapture={handleNewCapture}
        />
      )}

      {screen === 'result' && (
        <>
          <ResultDisplay
            rawText={mockResultData.rawText}
            type={mockResultData.type}
            explanation={mockResultData.explanation}
            keyPoints={mockResultData.keyPoints}
            onListenAgain={handleListenAgain}
            onNewCapture={handleNewCapture}
          />
          <VoiceChat
            messages={chatMessages}
            isProcessing={false}
            onSendMessage={handleSendMessage}
          />
        </>
      )}

      {/* ── Debug Navigation (Person B preview) ── */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        display: 'flex',
        gap: '4px',
        padding: '8px',
        background: 'rgba(0,0,0,0.8)',
        backdropFilter: 'blur(8px)',
        zIndex: 1000,
        justifyContent: 'center',
      }}>
        {['camera', 'loading', 'result', 'error'].map(s => (
          <button
            key={s}
            onClick={() => setScreen(s)}
            style={{
              padding: '8px 12px',
              fontSize: '14px',
              background: screen === s ? '#60a5fa' : '#333',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            {s}
          </button>
        ))}
      </div>
    </>
  );
}
