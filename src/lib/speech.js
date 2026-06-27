// src/lib/speech.js
// DG-C01 — TTS đọc to tiếng Việt bằng Web Speech API (ưu tiên giọng vi-VN bản địa).
// Contract: speak(text): Promise<void> | stopSpeaking(): void | hasVietnameseVoice(): boolean
// (DG-C02 sẽ bổ sung STT: startListening / stopListening / hasSpeechRecognition vào cùng file.)

const TTS_RATE = 0.85; // đọc chậm hơn cho người lớn tuổi dễ nghe
const TTS_PITCH = 1;
const MAX_CHUNK = 180; // tách câu để tránh bug Chrome cắt ngang khi đọc đoạn dài

function isSupported() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

// ---- Quản lý danh sách giọng (getVoices có thể load bất đồng bộ) ----
let _voices = [];

function refreshVoices() {
  if (!isSupported()) return [];
  _voices = window.speechSynthesis.getVoices() || [];
  return _voices;
}

// Đảm bảo đã có voices: một số trình duyệt trả [] ở lần gọi đầu.
function ensureVoices() {
  if (!isSupported()) return Promise.resolve([]);
  const now = refreshVoices();
  if (now.length) return Promise.resolve(now);
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve(refreshVoices());
    };
    window.speechSynthesis.addEventListener("voiceschanged", finish, { once: true });
    setTimeout(finish, 1000); // fallback: vài trình duyệt không bắn 'voiceschanged'
  });
}

if (isSupported()) {
  refreshVoices();
  window.speechSynthesis.onvoiceschanged = refreshVoices;
}

// Ưu tiên giọng tiếng Việt, và trong đó ưu tiên giọng NỮ nghe tự nhiên
// (Google tiếng Việt trên Android, hoặc HoaiMy của Windows đều là giọng nữ).
const FEMALE_HINT = /(hoaimy|hoai my|female|\bnu\b|nữ|linh|\bmai\b|google)/i;
const MALE_HINT = /(namminh|nam minh|\bnam\b|\bmale\b)/i;

function pickVietnameseVoice(voices) {
  if (!voices || !voices.length) return null;
  const vi = voices.filter((v) => (v.lang || "").toLowerCase().startsWith("vi"));
  const pool = vi.length ? vi : voices.filter((v) => /viet/i.test(v.name || ""));
  if (!pool.length) return null;
  return (
    pool.find((v) => FEMALE_HINT.test(v.name || "")) ||
    pool.find((v) => !MALE_HINT.test(v.name || "")) ||
    pool[0]
  );
}

/** Thiết bị có sẵn giọng tiếng Việt trong Web Speech không? (để quyết định fallback). */
export function hasVietnameseVoice() {
  if (!isSupported()) return false;
  return !!pickVietnameseVoice(_voices.length ? _voices : refreshVoices());
}

// Tách văn bản thành các câu ngắn (~180 ký tự) để đọc ổn định, không bị ngắt giữa chừng.
function chunkText(text) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const sentences = clean.match(/[^.!?…\n]+[.!?…]*/g) || [clean];
  const chunks = [];
  let buf = "";
  for (const s of sentences) {
    const next = (buf ? buf + " " : "") + s.trim();
    if (next.length > MAX_CHUNK && buf) {
      chunks.push(buf.trim());
      buf = s.trim();
    } else {
      buf = next;
    }
  }
  if (buf.trim()) chunks.push(buf.trim());
  return chunks;
}

let currentAudio = null; // phần tử Audio đang phát giọng OpenAI

/** Dừng ngay mọi thứ đang đọc (cả giọng OpenAI lẫn Web Speech). */
export function stopSpeaking() {
  if (currentAudio) {
    try {
      currentAudio.pause();
    } catch {
      /* noop */
    }
    currentAudio = null;
  }
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

// Giọng "xịn": gọi /api/tts (OpenAI gpt-4o-mini-tts) rồi phát mp3.
// Trả về true nếu phát xong, false nếu cần fallback sang Web Speech.
function speakWithOpenAI(text) {
  return fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  })
    .then((res) => {
      if (!res.ok) return false;
      return res.blob().then((blob) => {
        const url = URL.createObjectURL(blob);
        return new Promise((resolve) => {
          const audio = new Audio(url);
          currentAudio = audio;
          const finish = (ok) => {
            URL.revokeObjectURL(url);
            if (currentAudio === audio) currentAudio = null;
            resolve(ok);
          };
          audio.onended = () => finish(true);
          audio.onerror = () => finish(false);
          audio.play().catch(() => finish(false));
        });
      });
    })
    .catch(() => false);
}

// Giọng dự phòng: Web Speech vi-VN, xếp các câu liền mạch để không bị lên xuống.
function speakWithWebSpeech(text) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return Promise.resolve();
  const chunks = chunkText(text);
  if (!chunks.length) return Promise.resolve();

  const synth = window.speechSynthesis;
  synth.cancel();

  return ensureVoices().then((voices) => {
    const voice = pickVietnameseVoice(voices);
    return new Promise((resolve) => {
      let remaining = chunks.length;
      let finished = false;
      const finishOne = () => {
        remaining -= 1;
        if (remaining <= 0 && !finished) {
          finished = true;
          resolve();
        }
      };
      chunks.forEach((chunk) => {
        const u = new SpeechSynthesisUtterance(chunk);
        u.lang = "vi-VN";
        if (voice) u.voice = voice;
        u.rate = TTS_RATE;
        u.pitch = TTS_PITCH;
        u.volume = 1;
        u.onend = finishOne;
        u.onerror = (e) => {
          if (e.error && e.error !== "canceled" && e.error !== "interrupted") {
            console.warn("[speech] TTS error:", e.error);
          }
          finishOne();
        };
        synth.speak(u);
      });
    });
  });
}

/**
 * Đọc to văn bản tiếng Việt bằng giọng tự nhiên (OpenAI), tự fallback Web Speech.
 * Phải gọi trong một user gesture (vd. onClick) để trình duyệt cho phép phát tiếng.
 */
export function speak(text) {
  if (typeof window === "undefined") return Promise.resolve();
  const clean = String(text || "").trim();
  if (!clean) return Promise.resolve();
  stopSpeaking();
  return speakWithOpenAI(clean).then((ok) => (ok ? undefined : speakWithWebSpeech(clean)));
}

// ===== DG-C02: STT — nhận giọng nói tiếng Việt (Web Speech Recognition) =====

const STT_TIMEOUT_MS = 10_000; // tự dừng nếu im lặng 10s

function getRecognitionCtor() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

/** Trình duyệt có nhận giọng nói không? (iOS Safari thường KHÔNG, UI dùng ô gõ chữ). */
export function hasSpeechRecognition() {
  return !!getRecognitionCtor();
}

let _recognition = null;

/** Dừng nhận giọng nói đang chạy (nếu có). */
export function stopListening() {
  const rec = _recognition;
  if (rec) {
    try {
      rec.abort();
    } catch {
      /* noop */
    }
    _recognition = null;
  }
}

/**
 * Nghe một câu hỏi tiếng Việt, trả về text. Tự dừng sau 10s nếu không nghe được.
 * Phải gọi trong user gesture (bấm nút mic). Người dùng bấm dừng thì resolve "".
 * @returns {Promise<string>}
 */
export function startListening() {
  const Ctor = getRecognitionCtor();
  if (!Ctor) {
    return Promise.reject(new Error("Thiết bị không hỗ trợ nói. Bạn gõ câu hỏi giúp tôi nhé."));
  }

  stopSpeaking(); // tránh micro thu lại giọng đọc của app
  stopListening(); // chỉ một phiên nghe tại một thời điểm

  return new Promise((resolve, reject) => {
    const rec = new Ctor();
    _recognition = rec;
    rec.lang = "vi-VN";
    rec.continuous = false;
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    let settled = false;
    const cleanup = () => {
      clearTimeout(timer);
      rec.onresult = rec.onerror = rec.onend = null;
      if (_recognition === rec) _recognition = null;
    };
    const done = (text) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(text);
    };
    const fail = (msg) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(msg));
    };

    const timer = setTimeout(() => {
      try {
        rec.stop();
      } catch {
        /* noop */
      }
      fail("Tôi chưa nghe rõ, bạn bấm rồi nói lại giúp nhé.");
    }, STT_TIMEOUT_MS);

    rec.onresult = (e) => {
      const transcript = (e.results && e.results[0] && e.results[0][0] && e.results[0][0].transcript) || "";
      const text = transcript.trim();
      if (text) done(text);
      else fail("Tôi chưa nghe rõ, bạn nói lại giúp nhé.");
    };

    rec.onerror = (e) => {
      if (e.error === "aborted") return done(""); // user chủ động dừng, không phải lỗi
      const messages = {
        "not-allowed": "Bạn cần cho phép dùng micro để hỏi bằng giọng nói.",
        "service-not-allowed": "Bạn cần cho phép dùng micro để hỏi bằng giọng nói.",
        "no-speech": "Tôi chưa nghe thấy gì, bạn bấm rồi nói lại nhé.",
        "audio-capture": "Không tìm thấy micro trên thiết bị này.",
        network: "Mạng yếu nên chưa nghe được, bạn thử lại nhé.",
      };
      fail(messages[e.error] || "Chưa nghe được, bạn thử lại nhé.");
    };

    rec.onend = () => {
      if (!settled) fail("Tôi chưa nghe rõ, bạn nói lại giúp nhé.");
    };

    try {
      rec.start();
    } catch {
      fail("Không bật được micro, bạn thử lại nhé.");
    }
  });
}
