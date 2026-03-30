/**
 * lexer.js — Lexical unit resolver
 *
 * Converts raw kuromoji tokens into learner-friendly selectable units.
 * Each unit represents what a reader would naturally tap as one "word".
 *
 * Five pattern types handled:
 *   1. Verbs               — absorb auxiliaries + te-form chains
 *   2. I-adjectives        — absorb auxiliaries
 *   3. Na-adjective stems  — absorb copula forms + adverbial に
 *   4. Suru-verb compounds — merge サ変接続 noun + する conjugation
 *   5. Nouns               — absorb suffixes and counters
 */

import { toHiragana } from './japanese.js';

// ─── Unit construction ────────────────────────────────────────────────────────

function makeUnit(tokens, lemmaOverride) {
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
  const endIndex = (last.word_position || 1) - 1 + last.surface_form.length;

  return {
    // New learner-facing shape
    surfaceForm,
    lemma,
    reading,
    partOfSpeech: head.pos,
    startIndex,
    endIndex,
    sourceTokens: tokens,

    // Backward-compat aliases (used by TextDisplay, WordModal, App)
    surface_form: surfaceForm,
    basic_form:   lemma,
    pos:          head.pos,
  };
}

// ─── Pattern 1: Verbs ─────────────────────────────────────────────────────────

function verbContinues(group, next) {
  const last = group[group.length - 1];

  // Always absorb auxiliaries
  if (next.pos === '助動詞') return true;

  // Always absorb te/de — the te-form belongs to the verb unit regardless of what follows
  if (next.pos === '助詞' && (next.surface_form === 'て' || next.surface_form === 'で')) {
    return true;
  }

  // A verb that directly follows a て/で connector continues the chain
  // (e.g. ている, てしまう, てみる, ておく, てくる, ていく)
  if (
    next.pos === '動詞' &&
    last.pos === '助詞' &&
    (last.surface_form === 'て' || last.surface_form === 'で')
  ) {
    return true;
  }

  return false;
}

// ─── Pattern 2: I-adjectives ──────────────────────────────────────────────────

function adjContinues(_group, next) {
  return next.pos === '助動詞';
}

// ─── Pattern 3: Na-adjective stems ───────────────────────────────────────────

function naAdjContinues(_group, next) {
  // Absorb copula auxiliaries (だ, な, で, でした, etc.)
  if (next.pos === '助動詞') return true;

  // Absorb the adverbializing に in 静かに (tagged 助詞, 副詞化)
  if (next.pos === '助詞' && next.pos_detail_1 === '副詞化') return true;

  return false;
}

// ─── Pattern 5: Nouns with suffixes ──────────────────────────────────────────

function nounContinues(_group, next) {
  // Standalone suffix token type
  if (next.pos === '接尾辞') return true;

  if (next.pos === '名詞') {
    // Nominal suffixes tagged under 名詞 (e.g. 的, 性, 化)
    if (next.pos_detail_1 === '接尾') return true;
    // Counters (一人, 三つ, etc.)
    if (next.pos_detail_1 === '助数詞') return true;
  }

  return false;
}

// ─── Main resolver ────────────────────────────────────────────────────────────

/**
 * Resolve a flat kuromoji token array into learner-friendly lexical units.
 * @param {object[]} tokens — raw kuromoji tokens for one line
 * @returns {object[]} LexicalUnit array
 */
export function resolveLexicalUnits(tokens) {
  const result = [];
  let i = 0;

  while (i < tokens.length) {
    const t = tokens[i];
    const next = tokens[i + 1] ?? null;

    // ── Pattern 1: Verb ──────────────────────────────────────────────────────
    if (t.pos === '動詞') {
      const group = [t];
      i++;
      while (i < tokens.length && verbContinues(group, tokens[i])) {
        group.push(tokens[i++]);
      }
      result.push(makeUnit(group));
      continue;
    }

    // ── Pattern 2: I-adjective ───────────────────────────────────────────────
    if (t.pos === '形容詞') {
      const group = [t];
      i++;
      while (i < tokens.length && adjContinues(group, tokens[i])) {
        group.push(tokens[i++]);
      }
      result.push(makeUnit(group));
      continue;
    }

    // ── Pattern 3: Na-adjective stem ─────────────────────────────────────────
    if (t.pos === '名詞' && t.pos_detail_1 === '形容動詞語幹') {
      const group = [t];
      i++;
      while (i < tokens.length && naAdjContinues(group, tokens[i])) {
        group.push(tokens[i++]);
      }
      // Lemma is the stem itself (basic_form is often '*' for these)
      const lemma = (t.basic_form && t.basic_form !== '*') ? t.basic_form : t.surface_form;
      result.push(makeUnit(group, lemma));
      continue;
    }

    // ── Pattern 4: Suru-verb compound ────────────────────────────────────────
    if (
      t.pos === '名詞' &&
      t.pos_detail_1 === 'サ変接続' &&
      next?.pos === '動詞' &&
      next?.basic_form === 'する'
    ) {
      // Absorb the する-form verb, then continue with verb rules
      const group = [t, next];
      i += 2;
      while (i < tokens.length && verbContinues(group, tokens[i])) {
        group.push(tokens[i++]);
      }
      // Lemma = noun + する (e.g. 勉強する, 説明する)
      result.push(makeUnit(group, t.surface_form + 'する'));
      continue;
    }

    // ── Pattern 5: Noun with suffixes ────────────────────────────────────────
    if (t.pos === '名詞') {
      const group = [t];
      i++;
      while (i < tokens.length && nounContinues(group, tokens[i])) {
        group.push(tokens[i++]);
      }
      result.push(makeUnit(group));
      continue;
    }

    // ── Default: emit as single unit ─────────────────────────────────────────
    result.push(makeUnit([t]));
    i++;
  }

  return result;
}
