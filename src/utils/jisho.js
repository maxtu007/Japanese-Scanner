/**
 * Dictionary lookup via our own backend API route (/api/lookup).
 * The server fetches Jisho server-side, avoiding browser CORS restrictions.
 *
 * @param {string} lemma   - dictionary form (lookupTarget from chunkResolver)
 * @param {string} surface - surface form (fallback if lemma is absent)
 * @returns {Promise<{found, word, dictionaryForm, reading, meanings, pos}>}
 * @throws  on network or server errors (caller must catch)
 */
export async function lookupWord(lemma, surface) {
  const params = new URLSearchParams();
  if (lemma)   params.set('lemma',   lemma);
  if (surface) params.set('surface', surface);

  const res = await fetch(`/api/lookup?${params}`);
  if (!res.ok) throw new Error(`Lookup server error: ${res.status}`);
  return res.json();
}
