/**
 * server/jmdict.js — Local JMdict loader and lookup
 *
 * Loads data/jmdict-eng.json (from `npm run setup-dict`) at server startup
 * and indexes all kanji + kana forms into a Map for O(1) lookup.
 *
 * Startup time: ~3–5 seconds while the 230MB JSON is parsed.
 * Lookup time:  < 1ms after loading.
 *
 * During the loading window, lookupLocal() returns null → server falls
 * back to Jisho for those early requests.
 */

import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

// POS code → human-readable label
const POS_LABELS = {
  'v1':    'Ichidan verb',
  'v5r':   'Godan verb',  'v5k':   'Godan verb',  'v5s':   'Godan verb',
  'v5t':   'Godan verb',  'v5n':   'Godan verb',  'v5b':   'Godan verb',
  'v5m':   'Godan verb',  'v5g':   'Godan verb',  'v5u':   'Godan verb',
  'vk':    'Irregular verb (くる)',
  'vs':    'Suru verb',   'vs-i':  'Suru verb',   'vs-s':  'Suru verb',
  'n':     'Noun',        'n-suf': 'Suffix',       'n-pref':'Prefix',
  'adj-i': 'I-adjective', 'adj-na':'Na-adjective', 'adj-no':'No-adjective',
  'adv':   'Adverb',      'adv-to':'Adverb',
  'prt':   'Particle',    'conj':  'Conjunction',  'int':   'Interjection',
  'pn':    'Pronoun',     'exp':   'Expression',   'aux':   'Auxiliary',
  'aux-v': 'Auxiliary verb', 'aux-adj':'Auxiliary adjective',
  'vt':    'Transitive',  'vi':    'Intransitive',
};

// word → { found, word, dictionaryForm, reading, meanings[], pos[] }
const index = new Map();
let   loaded = false;

function normalizeWord(w) {
  const kanji   = w.kanji?.[0]?.text ?? w.kana?.[0]?.text ?? '';
  const reading = w.kana?.[0]?.text  ?? '';

  const meanings = [];
  const posSet   = new Set();

  for (const sense of (w.sense ?? []).slice(0, 5)) {
    const defs = (sense.gloss ?? [])
      .filter((g) => g.lang === 'eng')
      .map((g) => g.text)
      .slice(0, 4);
    if (defs.length) meanings.push(defs.join('; '));
    const p = sense.partOfSpeech?.[0];
    if (p) posSet.add(POS_LABELS[p] ?? p);
  }

  return {
    found:          true,
    word:           kanji,
    dictionaryForm: kanji,
    reading,
    meanings:       meanings.slice(0, 5),
    pos:            [...posSet].slice(0, 3),
  };
}

export async function loadJMdict() {
  const path = resolve('./data/jmdict-eng.json');

  if (!existsSync(path)) {
    console.warn('[jmdict] data/jmdict-eng.json not found. Run: npm run setup-dict');
    console.warn('[jmdict] Falling back to Jisho for all lookups (slow).');
    return;
  }

  const t0 = Date.now();
  console.log('[jmdict] Loading dictionary…');

  // readFileSync + JSON.parse is CPU-bound (~3s for 230MB).
  // Runs after server.listen() so HTTP is already accepting requests.
  const { words } = JSON.parse(readFileSync(path, 'utf8'));

  for (const w of words) {
    const entry = normalizeWord(w);
    for (const k of (w.kanji ?? [])) {
      if (!index.has(k.text)) index.set(k.text, entry);
    }
    for (const r of (w.kana ?? [])) {
      if (!index.has(r.text)) index.set(r.text, entry);
    }
  }

  loaded = true;
  console.log(`[jmdict] Ready — ${index.size} entries in ${Date.now() - t0}ms`);
}

export function lookupLocal(word) {
  if (!loaded) return null;
  return index.get(word) ?? null;
}

export function isLoaded() {
  return loaded;
}
