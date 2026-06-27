# Person B UI Contracts

File này là hợp đồng tích hợp giữa UI components và phần glue logic của Person C.

## CameraCapture

```jsx
<CameraCapture onCapture={handleCapture} disabled={isLoading} />
```

`onCapture(file)` nhận một `File` ảnh gốc từ camera/file picker. `src/app/page.js` hiện dùng `src/lib/imageUtils.js` để resize/compress/convert file này thành data URL trước khi gọi:

```js
await fetch("/api/understand", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ image }),
});
```

## ResultDisplay

```jsx
<ResultDisplay
  rawText={result.raw_text}
  type={result.type}
  explanation={result.explanation}
  keyPoints={result.key_points}
  onListenAgain={handleListenAgain}
  onNewCapture={handleNewCapture}
/>
```

Component nhận prop camelCase. `src/app/page.js` map API snake_case sang UI props trước khi render.

## VoiceChat

```jsx
<VoiceChat
  messages={messages}
  isProcessing={isAsking || isListening}
  onSendMessage={handleAskText}
  onMicPress={handleMicPress}
/>
```

`onSendMessage(text)` chỉ dùng cho câu hỏi dạng text. `onMicPress()` là điểm nối riêng cho `speech.startListening()`; UI không gửi sentinel string vào chat.
