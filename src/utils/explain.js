const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

const cache = new Map();

export async function explainWord(word, reading, sentence) {
  const key = `${word}||${sentence}`;
  if (cache.has(key)) return cache.get(key);

  const res = await fetch(`${API_BASE}/api/explain`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ word, reading, sentence }),
  });

  if (!res.ok) return null;

  const { explanation } = await res.json();
  cache.set(key, explanation);
  return explanation;
}
