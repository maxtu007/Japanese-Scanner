import { apiFetch } from './apiClient';

export async function lookupWord(lemma, surface) {
  const params = new URLSearchParams();
  if (lemma)   params.set('lemma',   lemma);
  if (surface) params.set('surface', surface);

  const res = await apiFetch(`/api/lookup?${params}`);
  if (!res.ok) throw new Error(`Lookup server error: ${res.status}`);
  return res.json();
}
