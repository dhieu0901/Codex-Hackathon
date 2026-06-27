'use client';

import { useState, useEffect, useRef } from 'react';
import CameraCapture from '../components/CameraCapture';
import ResultDisplay from '../components/ResultDisplay';
import LoadingState from '../components/LoadingState';
import ErrorMessage from '../components/ErrorMessage';
import VoiceChat from '../components/VoiceChat';
import { compressImage } from '../lib/imageUtils';
import { analyzeImage, askQuestion } from '../lib/api';
import { speak, stopSpeaking, startListening, prepareSpeechPlayback } from '../lib/speech';

const INITIAL_ERROR_MESSAGE = 'Xin lỗi, tôi chưa đọc được ảnh này. Bạn thử chụp lại rõ hơn nhé?';

export default function Home() {
  const [screen, setScreen] = useState('camera');
  const [lastFile, setLastFile] = useState(null);
  const [result, setResult] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [errorMessage, setErrorMessage] = useState(INITIAL_ERROR_MESSAGE);
  const [isAsking, setIsAsking] = useState(false);
  const [isListening, setIsListening] = useState(false);

  // Tránh đọc 2 câu chồng nhau & giữ tham chiếu trả lời mới nhất.
  const askingRef = useRef(false);

  // Dừng đọc khi rời trang.
  useEffect(() => () => stopSpeaking(), []);

  // Chụp ảnh, nén, gọi GPT-4o Vision, hiện kết quả rồi tự đọc to (C01)
  const understandFile = async (file) => {
    if (!file) {
      setErrorMessage('Bạn hãy chụp hoặc chọn một ảnh trước nhé.');
      setScreen('error');
      return;
    }

    setLastFile(file);
    setScreen('loading');
    setChatMessages([]);
    stopSpeaking();

    try {
      const base64 = await compressImage(file);
      const data = await analyzeImage(base64); // { rawText, type, explanation, keyPoints }
      setResult(data);
      setScreen('result');
      speak(data.explanation); // C01: tự đọc giải thích ngay
    } catch (error) {
      setErrorMessage(error?.message || INITIAL_ERROR_MESSAGE);
      setScreen('error');
    }
  };

  const handleCapture = (file) => {
    prepareSpeechPlayback();
    void understandFile(file);
  };

  const handleNewCapture = () => {
    stopSpeaking();
    setScreen('camera');
    setLastFile(null);
    setResult(null);
    setChatMessages([]);
    setErrorMessage(INITIAL_ERROR_MESSAGE);
  };

  const handleRetry = () => {
    prepareSpeechPlayback();
    void understandFile(lastFile);
  };

  // C01: bấm "Nghe lại" sẽ đọc lại phần giải thích.
  const handleListenAgain = () => {
    if (result?.explanation) {
      prepareSpeechPlayback();
      stopSpeaking();
      speak(result.explanation);
    }
  };

  // Hỏi đáp grounded rồi đọc to câu trả lời (voice-first).
  const sendQuestion = async (rawQuestion) => {
    const question = (rawQuestion || '').trim();
    if (!question || askingRef.current) return;

    askingRef.current = true;
    setChatMessages((prev) => [...prev, { role: 'user', text: question }]);
    setIsAsking(true);
    stopSpeaking();

    try {
      const { answer } = await askQuestion(question, result?.rawText || '');
      const text = answer || 'Tôi chưa trả lời được câu hỏi này. Bạn hỏi lại ngắn hơn nhé.';
      setChatMessages((prev) => [...prev, { role: 'assistant', text }]);
      speak(text);
    } catch (error) {
      const text = error?.message || 'Có lỗi khi trả lời. Bạn thử hỏi lại giúp tôi nhé.';
      setChatMessages((prev) => [...prev, { role: 'assistant', text }]);
      speak(text);
    } finally {
      askingRef.current = false;
      setIsAsking(false);
    }
  };

  const handleSendMessage = (text) => {
    prepareSpeechPlayback();
    void sendQuestion(text);
  };

  // C02: bấm mic để nghe câu hỏi tiếng Việt rồi gửi đi. Lỗi thì đọc to để người già nghe.
  const handleMicPress = async () => {
    if (isAsking || isListening) return;

    prepareSpeechPlayback();
    stopSpeaking();
    setIsListening(true);
    try {
      const text = await startListening();
      setIsListening(false);
      if (text) await sendQuestion(text);
    } catch (error) {
      setIsListening(false);
      speak(error?.message || 'Tôi chưa nghe rõ, bạn thử lại nhé.');
    }
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
            isProcessing={isAsking || isListening}
            onSendMessage={handleSendMessage}
            onMicPress={handleMicPress}
          />
        </>
      )}
    </>
  );
}
