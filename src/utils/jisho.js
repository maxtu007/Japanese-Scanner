/**
 * Fetch a structured dictionary entry from the Jisho public API.
 *
 * Returns the first result's word, reading, up to 4 English meanings (collected
 * across up to 3 senses), and up to 2 deduplicated parts-of-speech labels.
 *
 * @param {string} word - lemma / grammar label to look up
 * @returns {Promise<{word, reading, meanings, pos} | null>}
 */
export async function lookupWord(word) {
  try {
    const res = await fetch(
      `https://jisho.org/api/v1/search/words?keyword=${encodeURIComponent(word)}`
    );
    if (!res.ok) return null;

    const { data } = await res.json();
    if (!data?.length) return null;

    const entry = data[0];
    const jp    = entry.japanese?.[0] ?? {};

    // Collect top 2 meanings (1 per sense, 2 senses max) and deduplicate POS.
    const meanings = [];
    const posSet   = new Set();
    for (const sense of (entry.senses ?? []).slice(0, 2)) {
      const def = (sense.english_definitions ?? [])[0];
      if (def) meanings.push(def);
      const firstPos = sense.parts_of_speech?.[0];
      if (firstPos) posSet.add(firstPos);
    }

    return {
      word:     jp.word    || word,
      reading:  jp.reading || '',
      meanings: meanings.slice(0, 2),
      pos:      [...posSet].slice(0, 2),
    };
  } catch {
    return null;
  }
}
