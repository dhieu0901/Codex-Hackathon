// src/lib/imageUtils.js
// DG-C03 — Nén ảnh chụp trước khi gửi API: giảm dung lượng để upload nhanh,
// nhưng giữ đủ nét cho OCR, và xoay đúng hướng (ảnh iOS hay bị xoay theo EXIF).
//
// Hợp đồng: compressImage(file, maxWidth=1280, quality=0.85) -> Promise<string> (data URL JPEG)

const DEFAULT_MAX_WIDTH = 1280;
const DEFAULT_QUALITY = 0.85;
const QUALITY_FLOOR = 0.6; // không nén thấp hơn để chữ không vỡ, OCR còn đọc được
const TARGET_BYTES = 900_000; // ngưỡng mềm cho độ dài data URL (~900KB)
const MIN_WIDTH = 800; // không thu nhỏ quá mức này (giữ độ nét chữ)
const MAX_PASSES = 6;

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

function renderJpeg(src, width, height, quality) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, width);
  canvas.height = Math.max(1, height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Trình duyệt không hỗ trợ xử lý ảnh.");
  ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", quality);
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
    let dataUrl = renderJpeg(source, w * scale, h * scale, q);

    // Nếu còn quá to: giảm chất lượng tới sàn trước, rồi mới thu nhỏ kích thước.
    for (let pass = 0; pass < MAX_PASSES && dataUrl.length > TARGET_BYTES; pass++) {
      if (q > QUALITY_FLOOR) {
        q = Math.max(QUALITY_FLOOR, q - 0.1);
      } else if (w * scale > MIN_WIDTH) {
        scale *= 0.8;
      } else {
        break; // đã ở mức nhỏ nhất chấp nhận được
      }
      dataUrl = renderJpeg(source, w * scale, h * scale, q);
    }

    return dataUrl;
  } finally {
    if (typeof source.close === "function") source.close(); // giải phóng ImageBitmap
  }
}
