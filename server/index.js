import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { loadJMdict, lookupLocal, isLoaded } from './jmdict.js';

const app       = express();
const PORT      = 3001;
const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Response cache ────────────────────────────────────────────────────────────
// Keyed by lookup word. Survives for the lifetime of the server process.
// Covers both local-JMdict hits and Jisho fallback results.
const responseCache = new Map();

// ── Jisho fallback ────────────────────────────────────────────────────────────
async function jishoLookup(word) {
  const url  = `https://jisho.org/api/v1/search/words?keyword=${encodeURIComponent(word)}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Jisho returned ${resp.status}`);

  const { data } = await resp.json();
  if (!data?.length) {
    return { found: false, word, dictionaryForm: word, reading: '', meanings: [], pos: [] };
  }

  const entry = data[0];
  const jp    = entry.japanese?.[0] ?? {};
  const meanings = [];
  const posSet   = new Set();

  for (const sense of (entry.senses ?? []).slice(0, 5)) {
    const defs = (sense.english_definitions ?? []).slice(0, 4);
    if (defs.length) meanings.push(defs.join('; '));
    const p = sense.parts_of_speech?.[0];
    if (p) posSet.add(p);
  }

  return {
    found:          true,
    word:           jp.word    || word,
    dictionaryForm: jp.word    || word,
    reading:        jp.reading || '',
    meanings:       meanings.slice(0, 5),
    pos:            [...posSet].slice(0, 3),
  };
}

// ── Lookup route ──────────────────────────────────────────────────────────────
app.get('/api/lookup', async (req, res) => {
  const tapTime = Date.now();
  const word    = req.query.lemma || req.query.surface;

  if (!word) return res.status(400).json({ error: 'Missing lookup target' });

  // 1. Response cache (covers both local and Jisho results)
  if (responseCache.has(word)) {
    console.log(`[lookup] cache  "${word}" → ${Date.now() - tapTime}ms`);
    return res.json(responseCache.get(word));
  }

  console.log(`[lookup] miss   "${word}" (jmdict=${isLoaded()})`);
  const t1 = Date.now();

  // 2. Local JMdict (instant if loaded)
  const local = lookupLocal(word);
  if (local) {
    console.log(`[lookup] local  "${word}" → ${Date.now() - t1}ms`);
    responseCache.set(word, local);
    return res.json(local);
  }

  // 3. Jisho fallback (network, slow — for words not in local index or during startup)
  try {
    const t2     = Date.now();
    const result = await jishoLookup(word);
    console.log(`[lookup] jisho  "${word}" → ${Date.now() - t2}ms (total ${Date.now() - tapTime}ms)`);
    responseCache.set(word, result);
    return res.json(result);
  } catch (err) {
    console.error(`[lookup] error  "${word}": ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.use(express.static(join(__dirname, '../dist')));

app.listen(PORT, () => {
  console.log(`Dictionary server → http://localhost:${PORT}`);
  // Load JMdict after server is accepting requests so HTTP is never blocked.
  loadJMdict();
});
