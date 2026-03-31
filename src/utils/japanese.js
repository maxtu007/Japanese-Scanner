import kuromoji from 'kuromoji';
import { resolveLexicalUnits } from './lexer.js';
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

  // Step 1 — split into paragraph blocks on blank lines.
  // Blank lines represent genuine structural breaks; single newlines may be
  // OCR/layout artifacts that should not fragment the resolver's input.
  const paragraphs = text
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(p => p.length > 0);

  // If there are no blank lines the entire text is one block.
  const blocks = paragraphs.length > 0 ? paragraphs : [text.trim()];

  const result = [];
  for (const block of blocks) {
    // Step 2 — join sublines within the block so the resolver always receives
    // a complete, unfragmented chunk of text, not a raw OCR line slice.
    const joined = block
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0)
      .join('');

    // Step 3 — split into sentence-level units for display.
    // Each sentence becomes one <p> in the UI.
    for (const sentence of splitSentences(joined)) {
      const rawUnits = resolveLexicalUnits(tokenizer.tokenize(sentence));
      result.push(resolveSpans(rawUnits, sentence));
    }

    // If the block had no sentence-ending punctuation, splitSentences returns
    // the whole joined block as one entry — that's the correct fallback.
  }

  return result;
}
