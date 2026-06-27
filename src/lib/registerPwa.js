// src/lib/registerPwa.js
// DG-C07 — Kích hoạt PWA: đảm bảo có link manifest + đăng ký service worker.
// Gọi một lần từ page.js (DG-C05), ví dụ trong useEffect. Không đụng layout.js của B.

/** Bật PWA: thêm <link rel="manifest"> nếu thiếu và đăng ký service worker. */
export function registerServiceWorker() {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  ensureManifestLink();

  if (!("serviceWorker" in navigator)) return;
  // Service worker chỉ chạy trên HTTPS hoặc localhost.
  if (!window.isSecureContext) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.warn("[pwa] Đăng ký service worker thất bại:", err);
    });
  });
}

// Idempotent: nếu B đã thêm link manifest trong layout thì bỏ qua.
function ensureManifestLink() {
  if (document.querySelector('link[rel="manifest"]')) return;
  const link = document.createElement("link");
  link.rel = "manifest";
  link.href = "/manifest.json";
  document.head.appendChild(link);
}
