'use client';

import { useState } from 'react';
import CameraCapture from '../components/CameraCapture';
import ResultDisplay from '../components/ResultDisplay';
import LoadingState from '../components/LoadingState';
import ErrorMessage from '../components/ErrorMessage';
import VoiceChat from '../components/VoiceChat';
import { fileToDataUrl } from '../lib/imageUtils';

const INITIAL_ERROR_MESSAGE = 'Xin lỗi, tôi chưa đọc được ảnh này. Bạn thử chụp lại rõ hơn nhé?';

function normalizeUnderstandResult(data) {
  return {
    rawText: typeof data?.raw_text === 'string' ? data.raw_text : '',
    type: typeof data?.type === 'string' ? data.type : 'khác',
    explanation:
      typeof data?.explanation === 'string' && data.explanation.trim()
        ? data.explanation
        : 'Tôi chưa đọc rõ nội dung trong ảnh. Bạn thử chụp lại gần và sáng hơn nhé.',
    keyPoints: Array.isArray(data?.key_points) ? data.key_points : [],
  };
}

async function readErrorMessage(response, fallbackMessage) {
  try {
    const data = await response.json();
    return data?.error || fallbackMessage;
  } catch {
    return fallbackMessage;
  }
}

export default function Home() {
  const [screen, setScreen] = useState('camera');
  const [lastFile, setLastFile] = useState(null);
  const [result, setResult] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [errorMessage, setErrorMessage] = useState(INITIAL_ERROR_MESSAGE);
  const [isAsking, setIsAsking] = useState(false);

  const understandFile = async (file) => {
    if (!file) {
      setErrorMessage('Bạn hãy chụp hoặc chọn một ảnh trước nhé.');
      setScreen('error');
      return;
    }

    setLastFile(file);
    setScreen('loading');
    setErrorMessage(INITIAL_ERROR_MESSAGE);
    setChatMessages([]);

    try {
      const image = await fileToDataUrl(file);
      const response = await fetch('/api/understand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image }),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response, INITIAL_ERROR_MESSAGE));
      }

      const data = await response.json();
      setResult(normalizeUnderstandResult(data));
      setScreen('result');
    } catch (error) {
      setErrorMessage(error?.message || INITIAL_ERROR_MESSAGE);
      setScreen('error');
    }
  };

  const handleCapture = (file) => {
    void understandFile(file);
  };

  const handleNewCapture = () => {
    setScreen('camera');
    setLastFile(null);
    setResult(null);
    setChatMessages([]);
    setErrorMessage(INITIAL_ERROR_MESSAGE);
  };

  const handleRetry = () => {
    void understandFile(lastFile);
  };

  const handleListenAgain = () => {
    console.log('[Page] Listen again:', result?.explanation || '');
  };

  const handleSendMessage = async (text) => {
    const question = text.trim();
    if (!question || isAsking) return;

    setChatMessages((prev) => [...prev, { role: 'user', text: question }]);
    setIsAsking(true);

    try {
      const response = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          rawText: result?.rawText || '',
        }),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response, 'Tôi chưa trả lời được câu hỏi này.'));
      }

      const data = await response.json();
      setChatMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: data?.answer || 'Tôi chưa trả lời được câu hỏi này. Bạn hỏi lại ngắn hơn nhé.',
        },
      ]);
    } catch (error) {
      setChatMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: error?.message || 'Có lỗi khi trả lời. Bạn thử hỏi lại giúp tôi nhé.',
        },
      ]);
    } finally {
      setIsAsking(false);
    }
  };

  const handleMicPress = () => {
    console.log('[Page] Mic pressed - Person C will wire speech.startListening() here');
  };

  return (
    <>
      {screen === 'camera' && <CameraCapture onCapture={handleCapture} />}

      {screen === 'loading' && <LoadingState message="Đang đọc ảnh bằng AI..." />}

      {screen === 'error' && (
        <ErrorMessage
          message={errorMessage}
          onRetry={handleRetry}
          onNewCapture={handleNewCapture}
        />
      )}

      {screen === 'result' && result && (
        <>
          <ResultDisplay
            rawText={result.rawText}
            type={result.type}
            explanation={result.explanation}
            keyPoints={result.keyPoints}
            onListenAgain={handleListenAgain}
            onNewCapture={handleNewCapture}
          />
          <VoiceChat
            messages={chatMessages}
            isProcessing={isAsking}
            onSendMessage={handleSendMessage}
            onMicPress={handleMicPress}
          />
        </>
      )}
    </>
  );
}
