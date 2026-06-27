/* eslint-env serviceworker */
// public/sw.js — DG-C07 — Service worker tối giản & AN TOÀN cho "Soi Thuốc".
// Nguyên tắc: KHÔNG cache API (dữ liệu động/cá nhân), network-first cho trang
// (không bao giờ phục vụ app cũ kỹ), cache-first cho asset tĩnh, dọn cache cũ.

const VERSION = "soi-thuoc-v1";
const APP_SHELL = [
  "/",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(APP_SHELL).catch(() => {}))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return; // bỏ qua POST, để API gọi thẳng mạng
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // chỉ xử lý same-origin
  if (url.pathname.startsWith("/api/")) return; // KHÔNG cache API

  // Trang (navigation): luôn ưu tiên bản mới, offline thì mới dùng cache.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match(request).then((r) => r || caches.match("/")))
    );
    return;
  }

  // Asset tĩnh: cache-first, lấy mạng nếu chưa có rồi lưu lại.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(VERSION).then((cache) => cache.put(request, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => cached);
    })
  );
});
