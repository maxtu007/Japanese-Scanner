/**
 * patternMatcher.js — Grammar pattern detection engine
 *
 * Scans a flat array of raw kuromoji tokens for grammar construction matches
 * defined in grammar-patterns.js. Returns a Map of locked spans that the
 * lexer processes BEFORE its own POS rules.
 *
 * Algorithm: greedy left-to-right, longest-first.
 *   - Patterns are sorted by token count descending at module load.
 *   - At each position, the first (longest) matching pattern wins.
 *   - Consumed positions are skipped — no overlapping matches.
 */

import { GRAMMAR_PATTERNS } from '../data/grammar-patterns.js';

// Sort longest-first, then by original array index (stable tiebreak).
// Computed once at module load — not per call.
const SORTED_PATTERNS = [...GRAMMAR_PATTERNS]
  .map((p, idx) => ({ p, idx }))
  .sort((a, b) => {
    const d = b.p.tokens.length - a.p.tokens.length;
    return d !== 0 ? d : a.idx - b.idx;
  })
  .map(({ p }) => p);

/**
 * Check whether a single kuromoji token satisfies a TokenPredicate.
 * All specified fields must match (AND logic). Unspecified fields are wildcards.
 *
 * @param {object} token - raw kuromoji token
 * @param {object} pred  - TokenPredicate descriptor
 * @returns {boolean}
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

/**
 * Scan a raw kuromoji token array for grammar pattern matches.
 *
 * @param {object[]} tokens - raw kuromoji tokens for one sentence
 * @returns {Map<number, { length: number, lemma: string, reading: string, type: string }>}
 *          tokenIndex → match descriptor
 *          'type' is always 'grammar' for all entries in this map.
 */
export function matchPatterns(tokens) {
  const result   = new Map();
  const consumed = new Set();

  for (let i = 0; i < tokens.length; i++) {
    if (consumed.has(i)) continue;

    for (const pattern of SORTED_PATTERNS) {
      const len = pattern.tokens.length;

      // Bounds check — pattern would extend past end of token array
      if (i + len > tokens.length) continue;

      // Check all predicates in sequence
      let allMatch = true;
      for (let k = 0; k < len; k++) {
        if (!tokenMatches(tokens[i + k], pattern.tokens[k])) {
          allMatch = false;
          break;
        }
      }

      if (allMatch) {
        result.set(i, {
          length:  len,
          lemma:   pattern.lemma,
          reading: pattern.reading,
          type:    'grammar',
        });
        // Lock all token positions in the matched span
        for (let k = 0; k < len; k++) consumed.add(i + k);
        break; // first (longest) match wins at this position; move to next i
      }
    }
  }

  return result;
}
