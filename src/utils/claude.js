import { apiFetch } from './apiClient';

export function preprocessOCRText(text) {
  if (!text) return '';

  const lines   = text.split('\n');
  const cleaned = [];
  let blankCount = 0;

  for (const line of lines) {
    const trimmed = line.trimEnd();

    if (trimmed.trim() === '') {
      blankCount++;
      if (blankCount <= 1) cleaned.push('');
      continue;
    }
    blankCount = 0;

    const hasJapanese     = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(trimmed);
    const hasLatinOrDigit = /[a-zA-Z0-9]/.test(trimmed);
    if (!hasJapanese && !hasLatinOrDigit && trimmed.length <= 2) continue;

    cleaned.push(trimmed);
  }

  return cleaned.join('\n').trim();
}

export async function cleanAndTranslate(rawText) {
  if (!rawText?.trim()) return { sentences: [], translations: [], translation: '' };

  const res = await apiFetch('/api/translate', {
    method: 'POST',
    body:   JSON.stringify({ rawText }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Translate failed: ${res.status}`);
  }

  return res.json();
  // Returns: { sentences, translations, translation }
}
