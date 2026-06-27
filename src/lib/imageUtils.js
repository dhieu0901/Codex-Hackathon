// src/lib/imageUtils.js
// DG-C03 — Nén ảnh chụp trước khi gửi API: giảm dung lượng để upload nhanh,
// nhưng giữ đủ nét cho OCR, và xoay đúng hướng (ảnh iOS hay bị xoay theo EXIF).
//
// Hợp đồng: compressImage(file, maxWidth=1120, quality=0.78) -> Promise<string> (data URL JPEG)

const DEFAULT_MAX_WIDTH = 1120;
const DEFAULT_QUALITY = 0.78;
const QUALITY_FLOOR = 0.58; // không nén thấp hơn để chữ không vỡ, OCR còn đọc được
const TARGET_BYTES = 520_000; // ngưỡng mềm cho dung lượng JPEG trước khi encode base64
const MIN_WIDTH = 880; // không thu nhỏ quá mức này (giữ độ nét chữ)
const MAX_PASSES = 7;

function assertBrowser() {
  if (typeof document === "undefined" || typeof window === "undefined") {
    throw new Error("Chức năng này chỉ chạy trên trình duyệt.");
  }
}

// Giải mã ảnh và áp đúng hướng EXIF. Ưu tiên createImageBitmap (tự xử lý orientation).
async function decodeImage(file) {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      // Trình duyệt không hỗ trợ option -> rơi xuống fallback bên dưới.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Không đọc được ảnh. Bạn thử chụp lại nhé."));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function sourceSize(src) {
  return {
    w: src.naturalWidth || src.width,
    h: src.naturalHeight || src.height,
  };
}

function renderCanvas(src, width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Trình duyệt không hỗ trợ xử lý ảnh.");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function dataUrlToBlob(dataUrl) {
  const [header, payload] = String(dataUrl || "").split(",");
  const mime = /data:([^;]+)/.exec(header || "")?.[1] || "image/jpeg";
  const binary = atob(payload || "");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

function canvasToBlob(canvas, quality) {
  if (!canvas.toBlob) {
    return Promise.resolve(dataUrlToBlob(canvas.toDataURL("image/jpeg", quality)));
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Không nén được ảnh. Bạn thử chụp lại nhé."));
      },
      "image/jpeg",
      quality
    );
  });
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Không đọc được ảnh đã nén."));
    reader.readAsDataURL(blob);
  });
}

function renderJpegBlob(src, width, height, quality) {
  return canvasToBlob(renderCanvas(src, width, height), quality);
}

/**
 * Nén ảnh từ camera thành data URL JPEG gọn nhẹ, giữ đúng hướng & tỉ lệ.
 * @param {File|Blob} file - ảnh từ <input capture> hoặc camera
 * @param {number} [maxWidth=1280] - bề ngang tối đa (chỉ thu nhỏ, không phóng to)
 * @param {number} [quality=0.85] - chất lượng JPEG khởi điểm (0..1)
 * @returns {Promise<string>} "data:image/jpeg;base64,..."
 */
export async function compressImage(file, maxWidth = DEFAULT_MAX_WIDTH, quality = DEFAULT_QUALITY) {
  assertBrowser();

  if (!(file instanceof Blob)) {
    throw new Error("Chưa có ảnh hợp lệ. Bạn thử chụp lại nhé.");
  }
  if (file.type && !file.type.startsWith("image/")) {
    throw new Error("Tệp này không phải ảnh. Bạn chụp lại giúp tôi nhé.");
  }

  const source = await decodeImage(file);
  try {
    const { w, h } = sourceSize(source);
    if (!w || !h) throw new Error("Ảnh bị lỗi, bạn thử chụp lại nhé.");

    let scale = Math.min(1, maxWidth / w); // chỉ thu nhỏ
    let q = quality;
    let blob = await renderJpegBlob(source, w * scale, h * scale, q);

    // Nếu còn quá to: giảm chất lượng tới sàn trước, rồi mới thu nhỏ kích thước.
    for (let pass = 0; pass < MAX_PASSES && blob.size > TARGET_BYTES; pass++) {
      if (q > QUALITY_FLOOR) {
        q = Math.max(QUALITY_FLOOR, q - 0.1);
      } else if (w * scale > MIN_WIDTH) {
        scale *= 0.85;
      } else {
        break; // đã ở mức nhỏ nhất chấp nhận được
      }
      blob = await renderJpegBlob(source, w * scale, h * scale, q);
    }

    return blobToDataUrl(blob);
  } finally {
    if (typeof source.close === "function") source.close(); // giải phóng ImageBitmap
  }
}
