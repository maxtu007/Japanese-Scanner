import Anthropic from '@anthropic-ai/sdk';

const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;

if (!apiKey) {
  console.warn(
    'VITE_ANTHROPIC_API_KEY is not set. Create a .env file with your Anthropic API key.'
  );
}

const client = new Anthropic({
  apiKey: apiKey || '',
  dangerouslyAllowBrowser: true,
});

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });
}

export async function extractTextFromImage(file) {
  if (!apiKey) {
    throw new Error(
      'API key not configured. Create a .env file with VITE_ANTHROPIC_API_KEY=your-key.'
    );
  }

  const base64 = await fileToBase64(file);
  const mediaType = file.type;

  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: base64 },
          },
          {
            type: 'text',
            text: `Extract all Japanese text from this image exactly as written, preserving line breaks. Then translate it to natural English.

Respond ONLY with valid JSON — no markdown, no explanation:
{"japanese":"extracted text here with \\n for line breaks","translation":"english translation here"}

If no Japanese text is found: {"japanese":"","translation":""}`,
          },
        ],
      },
    ],
  });

  const raw = response.content[0].text.trim();
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Unexpected response from Claude');

  const result = JSON.parse(match[0]);
  return {
    japanese: (result.japanese || '').trim(),
    translation: (result.translation || '').trim(),
  };
}

export function preprocessOCRText(text) {
  if (!text) return '';

  const lines = text.split('\n');
  const cleaned = [];
  let blankCount = 0;

  for (const line of lines) {
    const trimmed = line.trimEnd();

    // Count blank lines
    if (trimmed.trim() === '') {
      blankCount++;
      if (blankCount <= 1) cleaned.push('');
      continue;
    }
    blankCount = 0;

    // Remove lines that are pure garbage (no Japanese, no Latin letters/digits, very short)
    const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(trimmed);
    const hasLatinOrDigit = /[a-zA-Z0-9]/.test(trimmed);
    if (!hasJapanese && !hasLatinOrDigit && trimmed.length <= 2) continue;

    cleaned.push(trimmed);
  }

  return cleaned.join('\n').trim();
}

// Combined clean + translate in a single Haiku call.
// Returns per-sentence arrays for aligned display.
export async function cleanAndTranslate(rawText) {
  if (!rawText || !rawText.trim()) return { sentences: [], translations: [], translation: '' };

  if (!apiKey) {
    throw new Error(
      'API key not configured. Create a .env file with VITE_ANTHROPIC_API_KEY=your-key.'
    );
  }

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 3072,
    messages: [
      {
        role: 'user',
        content: `You are processing raw OCR text extracted from a Japanese image (manga, signage, printed text). Do two things:

1. Reconstruct clean, readable Japanese:
   - Fix OCR errors and garbled or broken characters
   - Reconnect words split across lines (vertical text often fragments words)
   - Normalize spacing and punctuation to standard Japanese conventions
   - Reconstruct natural sentences from fragmented lines
   - Remove noise, stray symbols, and OCR artifacts
   - Split the output into individual sentences at sentence-ending punctuation (。！？)
   - Each array entry must be exactly one complete sentence

2. Translate each sentence to natural English (one translation per sentence, same order).

Respond ONLY with valid JSON — no markdown, no explanation:
{"sentences":["sentence 1","sentence 2"],"translations":["translation 1","translation 2"]}

Raw OCR text:
${rawText}`,
      },
    ],
  });

  const raw = (response.content[0]?.text ?? '').trim();
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) {
    return { sentences: [rawText], translations: [''], translation: '' };
  }

  const result = JSON.parse(match[0]);
  const sentences = Array.isArray(result.sentences) ? result.sentences.map(s => s.trim()).filter(Boolean) : [rawText];
  const translations = Array.isArray(result.translations) ? result.translations.map(t => t.trim()) : [];
  const translation = translations.join(' ');
  return { sentences, translations, translation };
}

// Kept for any direct callers, but no longer used in the main scan pipeline.
export async function cleanOCRText(rawText) {
  if (!rawText || !rawText.trim()) return rawText;

  if (!apiKey) {
    throw new Error(
      'API key not configured. Create a .env file with VITE_ANTHROPIC_API_KEY=your-key.'
    );
  }

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: `Clean and normalize the following Japanese OCR text.
Rules:
- Merge fragmented lines into natural Japanese sentence flow
- Preserve correct sentence boundaries
- Preserve paragraph breaks where they are meaningful
- Remove OCR artifacts and broken spacing
- Do not paraphrase or rewrite
- Do not add or invent content
- Output only the cleaned Japanese text, nothing else

OCR text:
${rawText}`,
      },
    ],
  });

  return (response.content[0]?.text ?? rawText).trim();
}

export async function translateText(japaneseText) {
  if (!apiKey) {
    throw new Error(
      'API key not configured. Create a .env file with VITE_ANTHROPIC_API_KEY=your-key.'
    );
  }

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `Translate the following Japanese text to natural English. Reply with only the translation, no explanation or commentary.\n\n${japaneseText}`,
      },
    ],
  });

  return (response.content[0]?.text ?? '').trim();
}
