/**
 * lexicon.js — Dictionary-backed lexical matching
 *
 * Scans raw kuromoji token sequences for spans that correspond to known
 * multi-token lexical units (compound verbs, V+adjective forms).
 *
 * This is distinct from the POS-rule resolver in lexer.js: it uses a real
 * word list as its knowledge source, not morphological heuristics.
 *
 * Two lookup strategies per span:
 *   1. surface1 + surface2  — exact match for uninflected compounds
 *   2. surface1 + basic_form2 — match for conjugated compounds
 *      e.g. 走り出した → span [走り, 出し]
 *           key = 走り + basic_form(出し=出す) = 走り出す ✓
 *
 * Works for V+V (走り出す, 食べ始める) and V+Adj (食べやすい, 読みにくい).
 */

import compoundVerbs from '../data/compound-verbs.json';

// Build a Map at module load time for O(1) lookup.
// Skip entries starting with "_" (metadata comments).
const LEXICON = new Map(
  Object.entries(compoundVerbs).filter(([k]) => !k.startsWith('_'))
);

/**
 * Compute lookup keys for a token span.
 * Returns up to two candidates — exact surface concat, then surface+basic_form.
 */
function spanKeys(span) {
  const surfaces = span.map(t => t.surface_form);
  const keys = [surfaces.join('')];

  const last = span[span.length - 1];
  if (last.basic_form && last.basic_form !== '*' && last.basic_form !== last.surface_form) {
    keys.push(surfaces.slice(0, -1).join('') + last.basic_form);
  }

  return keys;
}

/**
 * Find all lexicon matches in a flat token array.
 *
 * @param {object[]} tokens — raw kuromoji tokens for one sentence
 * @returns {Map<number, {length: number, lemma: string, reading: string}>}
 *          startIndex → match descriptor
 *
 * Greedy longest-match: tries span length 3 before 2 at each position,
 * advances past matched spans so results never overlap.
 */
export function matchLexicon(tokens) {
  const matches = new Map();
  let i = 0;

  while (i < tokens.length) {
    let hit = null;

    // Try longest span first (greedy)
    for (let len = 3; len >= 2 && !hit; len--) {
      if (i + len > tokens.length) continue;

      const span = tokens.slice(i, i + len);
      for (const key of spanKeys(span)) {
        if (LEXICON.has(key)) {
          hit = { length: len, lemma: key, reading: LEXICON.get(key) };
          break;
        }
      }
    }

    if (hit) {
      matches.set(i, hit);
      i += hit.length; // advance past the matched span
    } else {
      i++;
    }
  }

  return matches;
}
