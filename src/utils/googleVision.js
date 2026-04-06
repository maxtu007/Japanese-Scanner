import { apiFetch } from './apiClient';

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result.split(',')[1]);
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });
}

export async function extractTextWithGoogle(file) {
  const base64 = await fileToBase64(file);

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
