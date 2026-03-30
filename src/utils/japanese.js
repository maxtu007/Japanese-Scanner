import kuromoji from 'kuromoji';

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

export async function tokenizeLines(text) {
  const tokenizer = await getTokenizer();

  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) return [];

  return lines.map((line) => tokenizer.tokenize(line));
}
