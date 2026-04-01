const apiKey = import.meta.env.VITE_GOOGLE_VISION_API_KEY;

if (!apiKey) {
  console.warn(
    'VITE_GOOGLE_VISION_API_KEY is not set. Google Vision OCR will not be available.'
  );
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });
}

export async function extractTextWithGoogle(file) {
  if (!apiKey) {
    throw new Error(
      'Google Vision API key not configured. Add VITE_GOOGLE_VISION_API_KEY to .env.'
    );
  }

  const base64 = await fileToBase64(file);

  const payload = {
    requests: [
      {
        image: { content: base64 },
        features: [{ type: 'DOCUMENT_TEXT_DETECTION', maxResults: 1 }],
        imageContext: { languageHints: ['ja'] },
      },
    ],
  };

  const res = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );

  if (!res.ok) {
    throw new Error(`Google Vision API error: ${res.status} ${res.statusText}`);
  }

  const json = await res.json();
  const result = json.responses?.[0];

  if (!result?.fullTextAnnotation) {
    return { fullText: '', blocks: [], locale: '', confidence: null };
  }

  const fta = result.fullTextAnnotation;
  const page = fta.pages?.[0];

  const blocks = (page?.blocks ?? []).map((block) => {
    // Preserve paragraph boundaries as \n so layout reconstruction and
    // tokenization can treat them as sentence separators within a block.
    const paragraphTexts = (block.paragraphs ?? []).map(
      (p) =>
        (p.words ?? [])
          .flatMap((w) => (w.symbols ?? []).map((s) => s.text))
          .join('')
    ).filter((t) => t.length > 0);

    return {
      text: paragraphTexts.join('\n'),
      boundingBox: block.boundingBox ?? null,
      confidence: block.confidence ?? null,
      paragraphs: block.paragraphs ?? [],
    };
  });

  const confidenceValues = blocks
    .map((b) => b.confidence)
    .filter((c) => c !== null);
  const avgConfidence = confidenceValues.length
    ? confidenceValues.reduce((a, b) => a + b, 0) / confidenceValues.length
    : null;

  return {
    fullText: fta.text ?? '',
    blocks,
    pageWidth:  page?.width  ?? null,
    pageHeight: page?.height ?? null,
    locale: result.textAnnotations?.[0]?.locale ?? '',
    confidence: avgConfidence,
  };
}
