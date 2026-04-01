export function getImageDimensions(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to read image dimensions'));
    };
    img.src = url;
  });
}

// Threshold at which we trigger the slow Claude Opus fallback.
// Requires a combination of MULTIPLE severe failures — a single moderate signal is not enough.
const FALLBACK_THRESHOLD = 6;

// If the OCR returned at least this many Japanese characters, the text is usable.
// cleanOCRText (Haiku) handles messy formatting downstream — we don't need perfect output here.
const EARLY_ACCEPT_JA_CHARS = 15;

export function scoreOCRQuality(text, imageDimensions) {
  // imageDimensions is accepted for API compatibility but no longer used for scoring.
  void imageDimensions;

  // Edge case: no text extracted at all
  if (!text || text.trim().length === 0) {
    const result = {
      score: 10,
      shouldFallback: true,
      signals: { japaneseRatio: 0, junkRatio: 1, fragmentationRatio: 1, charDensityScore: 0 },
      contributingPoints: { japaneseRatio: 4, junkRatio: 2, fragmentation: 2, charDensity: 0 },
      debug: { jaChars: 0, totalChars: 0, earlyAccept: false },
    };
    console.log('[ocrQuality] empty text → fallback', result.signals);
    return result;
  }

  const nonWhitespace = text.replace(/\s/g, '');
  const totalChars = nonWhitespace.length;

  // Count actual Japanese characters (hiragana, katakana, kanji)
  const jaChars = (nonWhitespace.match(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\u3400-\u4DBF]/g) ?? []).length;
  const japaneseRatio = totalChars > 0 ? jaChars / totalChars : 0;

  // --- Early accept ---
  // If we extracted enough real Japanese content, skip penalty scoring entirely.
  // The downstream cleanup layer (cleanOCRText) handles imperfect formatting.
  if (jaChars >= EARLY_ACCEPT_JA_CHARS) {
    const result = {
      score: 0,
      shouldFallback: false,
      signals: { japaneseRatio, junkRatio: 0, fragmentationRatio: 0, charDensityScore: 0 },
      contributingPoints: { japaneseRatio: 0, junkRatio: 0, fragmentation: 0, charDensity: 0 },
      debug: { jaChars, totalChars, earlyAccept: true },
    };
    console.log(`[ocrQuality] earlyAccept jaChars=${jaChars} ratio=${japaneseRatio.toFixed(2)} → fast path`);
    return result;
  }

  // --- Signal 1: Japanese character ratio (tiered) ---
  // Low ratio alone is NOT decisive — mixed content images legitimately have phone numbers,
  // URLs, chapter numbers, etc. Only penalize severely when there is almost no Japanese at all.
  //   < 0.10 → 4 pts  (critical: OCR got the wrong content or language entirely)
  //   < 0.25 → 2 pts  (very low, but may be mixed-content — usually fixable)
  //   < 0.40 → 1 pt   (borderline, mild flag only)
  //   >= 0.40 → 0 pts
  const japanesePoints =
    japaneseRatio < 0.10 ? 4 :
    japaneseRatio < 0.25 ? 2 :
    japaneseRatio < 0.40 ? 1 : 0;

  // --- Signal 2: Junk/symbol ratio ---
  // Raised threshold from 0.15 → 0.30. OCR artifacts and special punctuation are common;
  // 15% was triggering on images that were clearly readable.
  // Junk = not ASCII printable, not Japanese/CJK/full-width, not whitespace
  const junkChars = (nonWhitespace.match(/[^\u0020-\u007E\u3000-\u9FFF\uFF00-\uFFEF\u30A0-\u30FF\u3040-\u309F]/g) ?? []).length;
  const junkRatio = totalChars > 0 ? junkChars / totalChars : 0;
  const junkPoints = junkRatio > 0.30 ? 2 : 0;

  // Signal 3 (fragmentation) removed.
  // Layout reconstruction (layoutReconstructor.js) handles fragmented block structures
  // structurally before text reaches this scoring step.  Penalising fragmentation here
  // was causing false fallbacks on images with many small speech bubbles or vertical text.

  // Signal 4 (char density) removed — replaced by the early-accept check above.

  const score = japanesePoints + junkPoints;
  const shouldFallback = score >= FALLBACK_THRESHOLD;

  const result = {
    score,
    shouldFallback,
    signals: { japaneseRatio, junkRatio, fragmentationRatio: 0, charDensityScore: 0 },
    contributingPoints: { japaneseRatio: japanesePoints, junkRatio: junkPoints, fragmentation: 0, charDensity: 0 },
    debug: { jaChars, totalChars, earlyAccept: false },
  };

  console.log(
    `[ocrQuality] score=${score}/${FALLBACK_THRESHOLD} shouldFallback=${shouldFallback}` +
    ` | jaChars=${jaChars} japaneseRatio=${japaneseRatio.toFixed(3)}(${japanesePoints}pts)` +
    ` | junkRatio=${junkRatio.toFixed(3)}(${junkPoints}pts)`
  );

  return result;
}
