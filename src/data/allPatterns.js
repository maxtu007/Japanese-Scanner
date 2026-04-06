/**
 * allPatterns.js — Unified sorted pattern list
 *
 * Merges declarative (grammar-patterns.js) and functional (functional-patterns.js)
 * into a single array sorted for greedy longest-first matching.
 *
 * Sort key (stable, deterministic):
 *   1. effectiveLength DESC  — tokens.length (declarative) | tokenCount (functional)
 *   2. priority DESC         — optional field, default 0
 *   3. original array index  — stable tiebreak
 */

import { GRAMMAR_PATTERNS }    from './grammar-patterns.js';
import { FUNCTIONAL_PATTERNS } from './functional-patterns.js';

const ALL_PATTERNS = [...GRAMMAR_PATTERNS, ...FUNCTIONAL_PATTERNS];

export const SORTED_PATTERNS = ALL_PATTERNS
  .map((p, idx) => ({ p, idx }))
  .sort((a, b) => {
    const lA = a.p.tokens?.length ?? a.p.tokenCount ?? 1;
    const lB = b.p.tokens?.length ?? b.p.tokenCount ?? 1;
    const pA = a.p.priority ?? 0;
    const pB = b.p.priority ?? 0;
    return (lB - lA) || (pB - pA) || (a.idx - b.idx);
  })
  .map(({ p }) => p);
