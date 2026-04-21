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
      .builder({ dicPath: '/dict' })
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

// Hepburn romanization — input must be hiragana (run toHiragana first)
const ROMAJI_DIGRAPHS = {
  'きゃ':'kya','きゅ':'kyu','きょ':'kyo',
  'しゃ':'sha','しゅ':'shu','しょ':'sho',
  'ちゃ':'cha','ちゅ':'chu','ちょ':'cho',
  'にゃ':'nya','にゅ':'nyu','にょ':'nyo',
  'ひゃ':'hya','ひゅ':'hyu','ひょ':'hyo',
  'みゃ':'mya','みゅ':'myu','みょ':'myo',
  'りゃ':'rya','りゅ':'ryu','りょ':'ryo',
  'ぎゃ':'gya','ぎゅ':'gyu','ぎょ':'gyo',
  'じゃ':'ja', 'じゅ':'ju', 'じょ':'jo',
  'ぢゃ':'ja', 'ぢゅ':'ju', 'ぢょ':'jo',
  'びゃ':'bya','びゅ':'byu','びょ':'byo',
  'ぴゃ':'pya','ぴゅ':'pyu','ぴょ':'pyo',
  'ふぁ':'fa', 'ふぃ':'fi', 'ふぇ':'fe', 'ふぉ':'fo',
  'てぃ':'ti', 'でぃ':'di',
};
const ROMAJI_SINGLE = {
  'あ':'a','い':'i','う':'u','え':'e','お':'o',
  'か':'ka','き':'ki','く':'ku','け':'ke','こ':'ko',
  'さ':'sa','し':'shi','す':'su','せ':'se','そ':'so',
  'た':'ta','ち':'chi','つ':'tsu','て':'te','と':'to',
  'な':'na','に':'ni','ぬ':'nu','ね':'ne','の':'no',
  'は':'ha','ひ':'hi','ふ':'fu','へ':'he','ほ':'ho',
  'ま':'ma','み':'mi','む':'mu','め':'me','も':'mo',
  'や':'ya','ゆ':'yu','よ':'yo',
  'ら':'ra','り':'ri','る':'ru','れ':'re','ろ':'ro',
  'わ':'wa','ゐ':'i','ゑ':'e','を':'o','ん':'n',
  'が':'ga','ぎ':'gi','ぐ':'gu','げ':'ge','ご':'go',
  'ざ':'za','じ':'ji','ず':'zu','ぜ':'ze','ぞ':'zo',
  'だ':'da','ぢ':'ji','づ':'zu','で':'de','ど':'do',
  'ば':'ba','び':'bi','ぶ':'bu','べ':'be','ぼ':'bo',
  'ぱ':'pa','ぴ':'pi','ぷ':'pu','ぺ':'pe','ぽ':'po',
  'ゔ':'vu',
  // small vowels (standalone edge cases)
  'ぁ':'a','ぃ':'i','ぅ':'u','ぇ':'e','ぉ':'o',
  'っ':'', // handled inline
  'ー':'-','〜':'~',
};

export function toRomaji(hiragana) {
  if (!hiragana) return '';
  let result = '';
  let i = 0;
  while (i < hiragana.length) {
    const c = hiragana[i];
    // Double-consonant: っ duplicates the first letter of the next mora
    if (c === 'っ') {
      const next = ROMAJI_DIGRAPHS[hiragana.slice(i + 1, i + 3)]
                ?? ROMAJI_SINGLE[hiragana[i + 1]]
                ?? '';
      if (next) result += next[0];
      i++;
      continue;
    }
    // 2-char digraph
    const two = hiragana.slice(i, i + 2);
    if (ROMAJI_DIGRAPHS[two]) {
      result += ROMAJI_DIGRAPHS[two];
      i += 2;
      continue;
    }
    // Single char
    result += ROMAJI_SINGLE[c] ?? c;
    i++;
  }
  return result;
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

// Tokenize a single pre-split sentence without any further sentence splitting.
// Use this when the caller already has clean sentence boundaries (e.g. from Claude).
export async function tokenizeSentence(text) {
  const tokenizer = await getTokenizer();
  if (!text?.trim()) return [];
  const tokens = tokenizer.tokenize(text.trim());
  const rawChunks = resolveChunks(tokens);
  return resolveSpans(rawChunks, text.trim());
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
