import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { loadJMdict, lookupLocal, isLoaded } from './jmdict.js';
import rateLimit from 'express-rate-limit';
import Anthropic from '@anthropic-ai/sdk';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';

const app       = express();
const PORT      = process.env.PORT || 3001;
const __dirname = dirname(fileURLToPath(import.meta.url));

app.use(helmet());
app.use(express.json({ limit: '10mb' }));
app.set('trust proxy', 1);

app.use(cors({
  origin: [
    'capacitor://localhost',
    'http://localhost:5173',
    'http://localhost:5174',
    ...(process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
      : []),
  ],
  methods: ['GET', 'POST'],
}));

// ── Supabase admin client (service role — JWT verification) ──────────────────
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'Invalid token' });
  req.user = user;
  next();
}

// ── Anthropic client (server-side — no dangerouslyAllowBrowser) ──────────────
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Rate limiters ─────────────────────────────────────────────────────────────
const ocrLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'OCR rate limit exceeded. Try again in an hour.' },
});

const translateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Translate rate limit exceeded. Try again in an hour.' },
});

const explainLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Explain rate limit exceeded. Try again in an hour.' },
});

// ── Response cache ────────────────────────────────────────────────────────────
// Keyed by lookup word. Survives for the lifetime of the server process.
// Covers both local-JMdict hits and Jisho fallback results.
const responseCache = new Map();

// ── Explain cache ─────────────────────────────────────────────────────────────
// Keyed by "word:reading". Shared across all users — same word only calls
// Gemini once per server session regardless of how many users tap it.
const explainCache = new Map();

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

// ── OCR route ─────────────────────────────────────────────────────────────────
app.post('/api/ocr', requireAuth, ocrLimiter, async (req, res) => {
  const { imageData } = req.body;
  if (!imageData) return res.status(400).json({ error: 'Missing imageData' });

  const key = process.env.GOOGLE_VISION_API_KEY;
  if (!key) return res.status(500).json({ error: 'OCR not configured on server' });

  const payload = {
    requests: [{
      image: { content: imageData },
      features: [{ type: 'DOCUMENT_TEXT_DETECTION', maxResults: 1 }],
      imageContext: { languageHints: ['ja'] },
    }],
  };

  const visionRes = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${key}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
  );
  if (!visionRes.ok) {
    return res.status(502).json({ error: `Google Vision error: ${visionRes.status}` });
  }

  const json   = await visionRes.json();
  const result = json.responses?.[0];

  if (!result?.fullTextAnnotation) {
    return res.json({ fullText: '', blocks: [], pageWidth: null, pageHeight: null, locale: '', confidence: null });
  }

  const fta  = result.fullTextAnnotation;
  const page = fta.pages?.[0];

  const blocks = (page?.blocks ?? []).map((block) => {
    const paragraphTexts = (block.paragraphs ?? [])
      .map((p) => (p.words ?? []).flatMap((w) => (w.symbols ?? []).map((s) => s.text)).join(''))
      .filter((t) => t.length > 0);
    return {
      text:        paragraphTexts.join('\n'),
      boundingBox: block.boundingBox ?? null,
      confidence:  block.confidence  ?? null,
      paragraphs:  block.paragraphs  ?? [],
    };
  });

  const confidenceValues = blocks.map((b) => b.confidence).filter((c) => c !== null);
  const avgConfidence    = confidenceValues.length
    ? confidenceValues.reduce((a, b) => a + b, 0) / confidenceValues.length
    : null;

  res.json({
    fullText:   fta.text ?? '',
    blocks,
    pageWidth:  page?.width  ?? null,
    pageHeight: page?.height ?? null,
    locale:     result.textAnnotations?.[0]?.locale ?? '',
    confidence: avgConfidence,
  });
});

// ── Translate route ───────────────────────────────────────────────────────────
app.post('/api/translate', requireAuth, translateLimiter, async (req, res) => {
  const { rawText } = req.body;
  if (!rawText?.trim()) return res.json({ sentences: [], translations: [], translation: '' });

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 3072,
    messages: [{
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
    }],
  });

  const raw   = (response.content[0]?.text ?? '').trim();
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) {
    return res.json({ sentences: [rawText], translations: [''], translation: '' });
  }

  const result       = JSON.parse(match[0]);
  const sentences    = Array.isArray(result.sentences)    ? result.sentences.map(s => s.trim()).filter(Boolean) : [rawText];
  const translations = Array.isArray(result.translations) ? result.translations.map(t => t.trim()) : [];
  const translation  = translations.join(' ');
  res.json({ sentences, translations, translation });
});

// ── Explain route ─────────────────────────────────────────────────────────────
app.post('/api/explain', requireAuth, explainLimiter, async (req, res) => {
  const { word, reading, sentence } = req.body;
  if (!word || !sentence) return res.status(400).json({ error: 'Missing word or sentence' });

  const cacheKey = `${word}:${reading || ''}`;
  if (explainCache.has(cacheKey)) {
    return res.json({ explanation: explainCache.get(cacheKey) });
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) return res.status(500).json({ error: 'Explain not configured on server' });

  const prompt = `Japanese sentence: "${sentence}"
Word: "${word}"${reading ? ` (${reading})` : ''}

In 1-2 short sentences, explain what "${word}" means in this specific context. Be natural and direct — no "In this context" filler, just explain it plainly.`;

  const geminiRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${geminiKey}`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    }
  );

  if (!geminiRes.ok) {
    return res.status(502).json({ error: `Gemini error: ${geminiRes.status}` });
  }

  const json        = await geminiRes.json();
  const explanation = (json.candidates?.[0]?.content?.parts?.[0]?.text ?? '').trim() || null;
  if (explanation) explainCache.set(cacheKey, explanation);
  res.json({ explanation });
});

// ── Lookup route ──────────────────────────────────────────────────────────────
app.get('/api/lookup', requireAuth, async (req, res) => {
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
