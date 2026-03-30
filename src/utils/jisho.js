export async function lookupWord(word) {
  try {
    const res = await fetch(
      `https://jisho.org/api/v1/search/words?keyword=${encodeURIComponent(word)}`
    );
    if (!res.ok) return null;

    const { data } = await res.json();
    if (!data?.length) return null;

    const entry = data[0];
    const jp = entry.japanese?.[0] ?? {};
    const sense = entry.senses?.[0] ?? {};

    return {
      word: jp.word || word,
      reading: jp.reading || '',
      meanings: (sense.english_definitions || []).slice(0, 3),
      pos: (sense.parts_of_speech || []).slice(0, 2),
    };
  } catch {
    return null;
  }
}
