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

export function scoreOCRQuality(text, imageDimensions) {
  // Edge case: no text extracted at all
  if (!text || text.trim().length === 0) {
    return {
      score: 10,
      shouldFallback: true,
      signals: { japaneseRatio: 0, junkRatio: 1, fragmentationRatio: 1, charDensityScore: 1 },
      contributingPoints: { japaneseRatio: 3, junkRatio: 2, fragmentation: 2, charDensity: 1 },
    };
  }

  const nonWhitespace = text.replace(/\s/g, '');
  const totalChars = nonWhitespace.length;

  // Signal 1: Japanese character ratio
  const jaChars = (nonWhitespace.match(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\u3400-\u4DBF]/g) ?? []).length;
  const japaneseRatio = totalChars > 0 ? jaChars / totalChars : 0;
  const japanesePoints = japaneseRatio < 0.4 ? 3 : 0;

  // Signal 2: Junk/symbol ratio
  // Junk = not ASCII printable, not Japanese/CJK, not full-width, not whitespace
  const junkChars = (nonWhitespace.match(/[^\u0020-\u007E\u3000-\u9FFF\uFF00-\uFFEF\u30A0-\u30FF\u3040-\u309F]/g) ?? []).length;
  const junkRatio = totalChars > 0 ? junkChars / totalChars : 0;
  const junkPoints = junkRatio > 0.15 ? 2 : 0;

  // Signal 3: Line fragmentation (lines with 1-2 chars)
  const lines = text.split('\n').filter((l) => l.trim().length > 0);
  const shortLines = lines.filter((l) => l.trim().length <= 2).length;
  const fragmentationRatio = lines.length > 0 ? shortLines / lines.length : 0;
  const fragmentationPoints = fragmentationRatio > 0.35 ? 2 : 0;

  // Signal 4: Low char density (size-adjusted)
  let charDensityScore = 0;
  let charDensityPoints = 0;
  if (imageDimensions) {
    const pixelArea = imageDimensions.width * imageDimensions.height;
    if (pixelArea > 200000 && totalChars < 80) {
      charDensityScore = 1;
      charDensityPoints = 1;
    } else if (pixelArea > 50000 && totalChars < 80) {
      charDensityScore = 0.5;
      charDensityPoints = 0.5;
    }
  }

  const score =
    japanesePoints + junkPoints + fragmentationPoints + charDensityPoints;

  return {
    score,
    shouldFallback: score >= 4,
    signals: {
      japaneseRatio,
      junkRatio,
      fragmentationRatio,
      charDensityScore,
    },
    contributingPoints: {
      japaneseRatio: japanesePoints,
      junkRatio: junkPoints,
      fragmentation: fragmentationPoints,
      charDensity: charDensityPoints,
    },
  };
}
