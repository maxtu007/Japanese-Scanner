import kuromoji from 'kuromoji';
import { resolveChunks } from './chunkResolver.js';
import { resolveSpans } from './spanResolver.js';

let _tokenizer = null;
let _building = null;

function getTokenizer() {
  if (_tokenizer) return Promise.resolve(_tokenizer);
  if (_building) return _building;

  _building = new Promise((resolve, reject) => {
    kuromoji
      .builder({ dicPath: 'https://cdn.jsdelivr.net/npm/kuromoji@0.1.2/dict' })
      .build((err, tokenizer) => {
        _building = null;
        if (err) {
          reject(new Error('Failed to load Japanese tokenizer'));
          return;
        }
        _tokenizer = tokenizer;
        resolve(tokenizer);
      });
  });

  return _building;
}

export function toHiragana(str) {
  if (!str || str === '*') return '';
  return str.replace(/[\u30A1-\u30F6]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0x60)
  );
}

export function hasJapanese(text) {
  return /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text);
}

// Split joined text into sentence-level blocks for display.
// Splits after Japanese sentence-ending punctuation, keeping the marker with its sentence.
function splitSentences(text) {
  const marked = text.replace(/([。！？…」』])/g, '$1\0');
  return marked.split('\0').map(s => s.trim()).filter(s => s.length > 0);
}

export async function tokenizeLines(text) {
  const tokenizer = await getTokenizer();
  if (!text?.trim()) return [];

  // Step 1 — split into paragraph blocks.
  //
  // Two separator levels are recognised, in priority order:
  //   · \n\n (blank line) — always a structural break (region/paragraph boundary)
  //   · \n   (single newline) — a Vision paragraph boundary within a block,
  //          preserved by googleVision.js as a sentence separator.
  //          Previously these were joined away as OCR artifacts, but the pipeline
  //          now emits them intentionally so they must be respected here.
  //
  // We split on any newline sequence, then treat each non-empty line as its own
  // paragraph for sentence-splitting purposes.  Empty lines become block gaps.
  const paragraphs = text
    .split(/\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const result = [];
  for (const para of paragraphs) {
    // Step 2 — sentence-split within the paragraph.
    // splitSentences keeps sentence-terminal punctuation with its sentence and
    // returns the whole paragraph as one entry when no such marker is found.
    for (const sentence of splitSentences(para)) {
      const tokens    = tokenizer.tokenize(sentence);
      const rawChunks = resolveChunks(tokens);
      result.push(resolveSpans(rawChunks, sentence));
    }
  }

  return result;
}
