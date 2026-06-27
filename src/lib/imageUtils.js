'use client';

const DEFAULT_MAX_DIMENSION = 1600;
const DEFAULT_QUALITY = 0.85;

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Không đọc được ảnh. Bạn thử chọn ảnh khác nhé.'));
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Ảnh này không mở được. Bạn thử chụp lại rõ hơn nhé.'));
    image.src = dataUrl;
  });
}

export async function fileToDataUrl(file, options = {}) {
  if (!file || !file.type?.startsWith('image/')) {
    throw new Error('Vui lòng chọn một ảnh hợp lệ.');
  }

  const maxDimension = options.maxDimension || DEFAULT_MAX_DIMENSION;
  const quality = options.quality || DEFAULT_QUALITY;
  const sourceDataUrl = await readFileAsDataUrl(file);

  if (typeof document === 'undefined' || file.type === 'image/svg+xml' || file.type === 'image/gif') {
    return sourceDataUrl;
  }

  const image = await loadImage(sourceDataUrl);
  const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));

  if (scale === 1 && file.size < 1_000_000) {
    return sourceDataUrl;
  }

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return sourceDataUrl;
  }

  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', quality);
}
