import { apiFetch } from './apiClient';

// Resize + JPEG-compress before upload so iPhone camera photos (10-20MB raw)
// don't blow past the server's JSON limit or time out over cellular.
// Google Vision OCR is excellent at 1500px — no quality loss for OCR purposes.
function compressImageForOCR(file) {
  return new Promise((resolve, reject) => {
    const MAX_DIM = 1500;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > MAX_DIM || height > MAX_DIM) {
        if (width >= height) {
          height = Math.round((height / width) * MAX_DIM);
          width  = MAX_DIM;
        } else {
          width  = Math.round((width / height) * MAX_DIM);
          height = MAX_DIM;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width  = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      // Strip the "data:image/jpeg;base64," prefix
      resolve(canvas.toDataURL('image/jpeg', 0.85).split(',')[1]);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image for compression'));
    };
    img.src = url;
  });
}

export async function extractTextWithGoogle(file) {
  const base64 = await compressImageForOCR(file);

  const res = await apiFetch('/api/ocr', {
    method: 'POST',
    body:   JSON.stringify({ imageData: base64 }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `OCR failed: ${res.status}`);
  }

  return res.json();
  // Returns: { fullText, blocks, pageWidth, pageHeight, locale, confidence }
}
