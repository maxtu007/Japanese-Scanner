/**
 * chunkResolver.js — Single-pass learner chunk resolver
 *
 * Replaces patternMatcher.js + lexer.js with a unified left-to-right walk.
 *
 * At each token position the resolver:
 *   1. Tries all grammar patterns (sorted longest-first). First match wins,
 *      tokens are consumed immediately — no pre-built Map, no second pass.
 *   2. Falls back to the compound-verb lexicon.
 *   3. Falls back to POS-rule patterns (verb, i-adj, na-adj, suru-verb, noun).
 *   4. Defaults to single-token emit.
 *
 * All produced ChunkUnit objects carry a `locked` flag and an explicit
 * `lookupTarget` field for clean tap-to-meaning behaviour.
 *
 * ─── Architecture notes ──────────────────────────────────────────────────────
 *
 * verbTailContinues vs. old verbContinues:
 *   The old rule "absorb any 動詞 that follows て/で" caused over-merges like
 *   食べて帰った → [食べて帰った] (unlookupable blob).  That rule is removed.
 *   Te-form aspect constructions (ている, てしまう, てあげる, etc.) are all
 *   handled by functional patterns which fire BEFORE the verb POS fallback.
 *   Content verbs after て (帰る, くれる-as-main-verb, etc.) are separate units.
 *
 * Grammar pattern tail absorption:
 *   After a grammar pattern consumes its core tokens, ONLY 助動詞 (conjugational
 *   auxiliaries: た, ない, ます, etc.) are absorbed into the locked span.
 *   て, ながら, and further verbs are NOT absorbed — they start new units.
 */

import { toHiragana } from './japanese.js';
import { matchLexicon } from './lexicon.js';
import { SORTED_PATTERNS } from '../data/allPatterns.js';

// ─── Suru-verb family ─────────────────────────────────────────────────────────

const SURU_FAMILY = new Set(['する', 'される', 'させる', 'できる']);

function isSuruFamilyVerb(token) {
  return token.pos === '動詞' && SURU_FAMILY.has(token.basic_form);
}

function isSuruNoun(t, next) {
  if (!next) return false;
  // Tier 1: kuromoji-tagged サ変接続 + any する-family voice
  if (t.pos === '名詞' && t.pos_detail_1 === 'サ変接続' && isSuruFamilyVerb(next)) return true;
  // Tier 2: multi-char noun + plain する (covers loanwords/neologisms)
  if (t.pos === '名詞' && t.surface_form.length >= 2 &&
      next.pos === '動詞' && next.basic_form === 'する') return true;
  return false;
}

// ─── Type inference ───────────────────────────────────────────────────────────

function inferType(headToken) {
  switch (headToken.pos) {
    case '動詞':   return 'verb';
    case '名詞':   return 'noun';
    case '形容詞': return 'i-adjective';
    case '助詞':   return 'particle';
    case '助動詞': return 'auxiliary';
    case '記号':   return 'punctuation';
    case '副詞':   return 'adverb';
    case '接頭詞': return 'prefix';
    default:       return 'other';
  }
}

// ─── Chunk construction ───────────────────────────────────────────────────────

function makeChunk(tokens, lemmaOverride, typeOverride, grammarLabel, locked) {
  const head = tokens[0];
  const last = tokens[tokens.length - 1];

  const surfaceForm = tokens.map(t => t.surface_form).join('');

  const lemma = lemmaOverride
    ?? ((head.basic_form && head.basic_form !== '*') ? head.basic_form : head.surface_form);

  const reading = toHiragana(
    tokens
      .map(t => (t.reading && t.reading !== '*') ? t.reading : t.surface_form)
      .join('')
  );

  const startIndex = (head.word_position || 1) - 1;
  const endIndex   = (last.word_position || 1) - 1 + last.surface_form.length;

  const type     = typeOverride ?? inferType(head);
  const isLocked = locked ?? (type === 'grammar');

  return {
    // Learner-facing shape
    surfaceForm,
    lemma,
    reading,
    lookupTarget: lemma,   // explicit contract for WordModal / save-to-vocab
    partOfSpeech: head.pos,
    startIndex,
    endIndex,
    sourceTokens: tokens,
    type,
    grammarLabel: grammarLabel ?? null,
    locked:       isLocked,

    // Backward-compat aliases (TextDisplay, WordModal, App)
    surface_form: surfaceForm,
    basic_form:   lemma,
    pos:          head.pos,
  };
}

// ─── Pattern dispatch ─────────────────────────────────────────────────────────

/**
 * Check whether a single token satisfies a TokenPredicate (AND logic).
 */
function tokenMatches(token, pred) {
  if (pred.surface !== undefined) {
    if (token.surface_form !== pred.surface) return false;
  }
  if (pred.basicForm !== undefined) {
    const ok = Array.isArray(pred.basicForm)
      ? pred.basicForm.includes(token.basic_form)
      : token.basic_form === pred.basicForm;
    if (!ok) return false;
  }
  if (pred.pos !== undefined) {
    const ok = Array.isArray(pred.pos)
      ? pred.pos.includes(token.pos)
      : token.pos === pred.pos;
    if (!ok) return false;
  }
  if (pred.posDetail1 !== undefined) {
    const ok = Array.isArray(pred.posDetail1)
      ? pred.posDetail1.includes(token.pos_detail_1)
      : token.pos_detail_1 === pred.posDetail1;
    if (!ok) return false;
  }
  return true;
}

function patternMatchesAt(pattern, tokens, i) {
  if (typeof pattern.match === 'function') {
    return pattern.match(tokens, i);
  }
  // Declarative: check all predicates
  const len = pattern.tokens.length;
  if (i + len > tokens.length) return false;
  for (let k = 0; k < len; k++) {
    if (!tokenMatches(tokens[i + k], pattern.tokens[k])) return false;
  }
  return true;
}

function patternConsumeLength(pattern, tokens, i) {
  if (typeof pattern.length === 'function') {
    return pattern.length(tokens, i);
  }
  return pattern.tokens.length;
}

function patternBuild(pattern, tokens, i, len) {
  if (typeof pattern.build === 'function') {
    return pattern.build(tokens, i, len);
  }
  return {
    length:      len,
    lemma:       pattern.lemma,
    reading:     pattern.reading,
    type:        'grammar',
    grammarLabel: pattern.grammarLabel ?? pattern.lemma,
  };
}

// ─── Tail absorption predicates ───────────────────────────────────────────────

/**
 * verbTailContinues — absorb tokens that morphologically belong to the preceding
 * verb stem.  Intentionally does NOT absorb independent verbs after て/で;
 * those are handled by functional patterns or emitted as separate units.
 */
function verbTailContinues(group, next) {
  const last = group[group.length - 1];

  // Always absorb auxiliaries (ます, た, ない, られる, etc.)
  if (next.pos === '助動詞') return true;

  // Absorb the て/で connector — it is the te-form ending of the verb stem itself.
  // The verb after て (if any) is handled separately: aspect verbs by functional
  // patterns, content verbs as new units.
  if (next.pos === '助詞' && (next.surface_form === 'て' || next.surface_form === 'で')) {
    return true;
  }

  // Absorb ながら (simultaneous action)
  if (next.pos === '助詞' && next.surface_form === 'ながら') return true;

  // Absorb bound suffix verbs (動詞,接尾): passive れる, causative せる/させる,
  // potential られる.  These are morphological suffixes, never independent words.
  if (next.pos === '動詞' && next.pos_detail_1 === '接尾') return true;

  // Absorb non-independent verbs (動詞,非自立) that directly follow a verb stem.
  // This covers V+V compound second components (続ける, 始める, 終わる, etc.)
  // when kuromoji splits them.  Scoped to last.pos === '動詞' so it does NOT
  // fire for the て-connector case (last would be て/助詞).
  if (next.pos === '動詞' && next.pos_detail_1 === '非自立' && last.pos === '動詞') return true;

  // ── REMOVED: old rule that absorbed ANY 動詞自立 following て/で.
  //    That was the source of over-merges like 食べて帰った → [食べて帰った].
  //    All legitimate cases (ている, てしまう, etc.) are now functional patterns.

  return false;
}

function adjContinues(_group, next) {
  return next.pos === '助動詞';
}

function naAdjContinues(_group, next) {
  if (next.pos === '助動詞') return true;
  if (next.pos === '助詞' && next.pos_detail_1 === '副詞化') return true;
  return false;
}

function nounContinues(_group, next) {
  if (next.pos === '接尾辞') return true;
  if (next.pos === '名詞') {
    if (next.pos_detail_1 === '接尾') return true;
    if (next.pos_detail_1 === '助数詞') return true;
  }
  return false;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Resolve a flat kuromoji token array into learner-friendly ChunkUnit[].
 *
 * Single-pass left-to-right walk:
 *   Pattern check → Lexicon check → POS fallback → Default
 *
 * @param {object[]} tokens - raw kuromoji tokens for one sentence
 * @returns {object[]} ChunkUnit[]
 */
export function resolveChunks(tokens) {
  // Compound-verb lexicon index (internal implementation detail — not a pre-pass
  // in the architectural sense; it is an O(1) lookup within the same loop).
  const lexiconHits = matchLexicon(tokens);

  const result = [];
  let i = 0;

  while (i < tokens.length) {
    const t    = tokens[i];
    const next = tokens[i + 1] ?? null;

    // ── Phase 1: grammar pattern (single-pass, longest-first) ─────────────
    // All patterns are tried at this position before any POS rule fires.
    // First match consumes its tokens immediately — no Map, no deferred apply.
    let matched = false;

    for (const pattern of SORTED_PATTERNS) {
      if (!patternMatchesAt(pattern, tokens, i)) continue;

      const len = patternConsumeLength(pattern, tokens, i);
      if (i + len > tokens.length) continue;  // bounds safety

      const hit   = patternBuild(pattern, tokens, i, len);
      const group = tokens.slice(i, i + len);
      i += len;

      // After the grammar core, absorb ONLY conjugational auxiliaries (助動詞).
      // て, ながら, and further verbs start new units.
      while (i < tokens.length && tokens[i].pos === '助動詞') {
        group.push(tokens[i++]);
      }

      result.push(makeChunk(group, hit.lemma, 'grammar', hit.grammarLabel, true));
      matched = true;
      break;
    }

    if (matched) continue;

    // ── Phase 2: lexicon (compound verbs dictionary) ───────────────────────
    const lhit = lexiconHits.get(i);
    if (lhit) {
      const group = tokens.slice(i, i + lhit.length);
      i += lhit.length;
      while (i < tokens.length && verbTailContinues(group, tokens[i])) {
        group.push(tokens[i++]);
      }
      result.push(makeChunk(group, lhit.lemma, lhit.type ?? 'compound-verb'));
      continue;
    }

    // ── Phase 3: POS fallback rules ────────────────────────────────────────

    // Verb
    if (t.pos === '動詞') {
      const group = [t];
      i++;
      while (i < tokens.length && verbTailContinues(group, tokens[i])) {
        group.push(tokens[i++]);
      }
      result.push(makeChunk(group));
      continue;
    }

    // I-adjective
    if (t.pos === '形容詞') {
      const group = [t];
      i++;
      while (i < tokens.length && adjContinues(group, tokens[i])) {
        group.push(tokens[i++]);
      }
      result.push(makeChunk(group));
      continue;
    }

    // Na-adjective stem
    if (t.pos === '名詞' && t.pos_detail_1 === '形容動詞語幹') {
      const group = [t];
      i++;
      while (i < tokens.length && naAdjContinues(group, tokens[i])) {
        group.push(tokens[i++]);
      }
      const lemma = (t.basic_form && t.basic_form !== '*') ? t.basic_form : t.surface_form;
      result.push(makeChunk(group, lemma, 'na-adjective'));
      continue;
    }

    // Suru-verb compound (two acceptance tiers — see MEMORY.md)
    if (isSuruNoun(t, next)) {
      const group = [t, next];
      i += 2;
      while (i < tokens.length && verbTailContinues(group, tokens[i])) {
        group.push(tokens[i++]);
      }
      result.push(makeChunk(group, t.surface_form + 'する', 'suru-verb'));
      continue;
    }

    // Noun with suffixes / counters
    if (t.pos === '名詞') {
      const group = [t];
      i++;
      while (i < tokens.length && nounContinues(group, tokens[i])) {
        group.push(tokens[i++]);
      }
      result.push(makeChunk(group));
      continue;
    }

    // Default: emit single token
    result.push(makeChunk([t]));
    i++;
  }

  return result;
}
