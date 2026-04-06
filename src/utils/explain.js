import { apiFetch } from './apiClient';

const cache = new Map();

export async function explainWord(word, reading, sentence) {
  const key = `${word}||${sentence}`;
  if (cache.has(key)) return cache.get(key);

  const res = await apiFetch('/api/explain', {
    method: 'POST',
    body:   JSON.stringify({ word, reading, sentence }),
  });

  if (!res.ok) return null;

  const { explanation } = await res.json();
  cache.set(key, explanation);
  return explanation;
}
