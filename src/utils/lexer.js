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
 *   4. Suru-verb compounds — merge noun + する-family conjugation
 *   5. Nouns               — absorb suffixes and counters
 *
 * ─── Lexical architecture ───────────────────────────────────────────────────
 *
 * Two-tier knowledge model:
 *
 *   Tier A — POS-rule patterns (this file)
 *     The primary scalable mechanism. Kuromoji's own POS tags (サ変接続,
 *     動詞, 助動詞, etc.) ARE the lexical knowledge. Pattern 4 covers ALL
 *     suru-verbs — active, passive (される), causative (させる), potential
 *     (できる) — without any manual word list.  Adding new suru-verbs to the
 *     language is automatically handled as long as kuromoji tags them
 *     サ変接続.
 *
 *   Tier B — compound-verbs.json lexicon (lexicon.js)
 *     Used only for V+V compounds (走り出す, 食べ始める, etc.) where two
 *     independent verb stems join into one unit.  POS rules cannot reliably
 *     detect these because both components have independent verb POS tags.
 *     This list is intentionally small and focused — it is NOT the right
 *     place to grow suru-verb or conjugation coverage.
 *
 * To improve coverage: extend POS patterns here, not the compound JSON.
 */

import { toHiragana } from './japanese.js';
import { matchLexicon } from './lexicon.js';

// ─── Suru-verb family ─────────────────────────────────────────────────────────
//
// Kuromoji can return any of these as basic_form for the verbal token that
// immediately follows a suru-verb noun stem:
//
//   する   — active base form           (推奨する, 説明する)
//   される  — passive derived form        (推奨されています)
//   させる  — causative derived form       (参加させる)
//   できる  — potential derived form       (確認できる)
//
// Depending on the kuromoji/IPAdic version, the passive される may tokenize as
// either a single token (され, basic_form=される) OR as two tokens
// (さ basic_form=する + れ 助動詞).  Both paths are handled: the single-token
// path is covered by SURU_FAMILY; the two-token path by basic_form=する.

const SURU_FAMILY = new Set(['する', 'される', 'させる', 'できる']);

function isSuruFamilyVerb(token) {
  return token.pos === '動詞' && SURU_FAMILY.has(token.basic_form);
}

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

  // Absorb ながら (simultaneous action: "while V-ing") — part of the verb unit
  if (next.pos === '助詞' && next.surface_form === 'ながら') return true;

  // Absorb bound suffix verbs (動詞,接尾): passive れる, causative せる/させる,
  // potential られる, etc.  These are morphological suffixes in IPAdic — they
  // are never independent words and always belong to the preceding verb stem.
  // This is the general fix for: される, させる, させられる, etc.
  //   推奨さ + れ(動詞,接尾) → continues → 推奨され…
  //   参加さ + せ(動詞,接尾) + られ(動詞,接尾) → continues → 参加させられ…
  if (next.pos === '動詞' && next.pos_detail_1 === '接尾') return true;

  // Absorb non-independent verbs (動詞,非自立) that directly follow a verb stem.
  // This covers V+V compound second components that kuromoji splits because it
  // doesn't have them as compound dictionary entries: 続ける, 始める, 終わる, etc.
  //   走り(動詞,自立) + 続ける(動詞,非自立) → one unit
  //   書き(動詞,自立) + 始める(動詞,非自立) → one unit
  // NOTE: this rule is scoped to last.pos === '動詞' so it does NOT fire for the
  // て-chain case (last = て/助詞), which is handled by the rule below.
  if (next.pos === '動詞' && next.pos_detail_1 === '非自立' && last.pos === '動詞') return true;

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
  // Pre-compute all lexicon matches for this sentence.
  // These represent dictionary-known compound units and take priority over
  // the POS-rule patterns below.
  const lexiconHits = matchLexicon(tokens);

  const result = [];
  let i = 0;

  while (i < tokens.length) {
    const t = tokens[i];
    const next = tokens[i + 1] ?? null;

    // ── Lexicon override ─────────────────────────────────────────────────────
    // A known compound starts here — use the dictionary entry as the unit.
    const hit = lexiconHits.get(i);
    if (hit) {
      const baseGroup = tokens.slice(i, i + hit.length);
      i += hit.length;
      // After the compound, continue absorbing auxiliaries and te-form chains
      // just as we would for any verb group (handles 走り出した, 食べ始めている, etc.)
      const group = [...baseGroup];
      while (i < tokens.length && verbContinues(group, tokens[i])) {
        group.push(tokens[i++]);
      }
      result.push(makeUnit(group, hit.lemma));
      continue;
    }

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
    //
    // Two acceptance tiers (see architecture note at top of file):
    //
    //   Tier 1 — kuromoji-verified サ変接続 nouns
    //     Accept the full する-family (する, される, させる, できる).
    //     This covers active, passive, causative, and potential voices of any
    //     suru-verb that kuromoji knows — without any word list.
    //     e.g. 推奨されています, 参加させられます, 確認できました
    //
    //   Tier 2 — general nouns (≥ 2 chars) + する
    //     Conservative heuristic for nouns kuromoji didn't tag サ変接続
    //     (neologisms, loanwords, domain terms).  Restricted to basic する
    //     only to limit false positives.
    //     e.g. アクセスする, キャンセルする
    //
    // Lemma is always normalized to the active dictionary form (stem + する)
    // so Jisho lookup works regardless of which voice was used.

    const isSuruNoun = t.pos === '名詞' && (
      // Tier 1: kuromoji-verified + any する-family form
      (t.pos_detail_1 === 'サ変接続' && next && isSuruFamilyVerb(next)) ||
      // Tier 2: any multi-char noun + plain する
      (t.pos_detail_1 !== 'サ変接続' && t.surface_form.length >= 2 &&
       next?.pos === '動詞' && next?.basic_form === 'する')
    );

    if (isSuruNoun) {
      const group = [t, next];
      i += 2;
      while (i < tokens.length && verbContinues(group, tokens[i])) {
        group.push(tokens[i++]);
      }
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
