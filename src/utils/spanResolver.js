/**
 * spanResolver.js — Context-aware span resolver (post-lexer layer)
 *
 * Takes LexicalUnit[] from resolveLexicalUnits() and applies a second
 * pass of neighbor-aware merges to produce better learner-facing tappable
 * units (SpanUnit[]).
 *
 * Responsibilities:
 *   - Attach prefixes (お+茶 → お茶, ご+飯 → ご飯)
 *   - Merge katakana loanword sequences (コーヒー+ショップ → コーヒーショップ)
 *   - Merge noun compounds (電子+辞書 → 電子辞書, 携帯+電話 → 携帯電話)
 *   - Pass all other units through unchanged (zero-copy)
 *
 * Does NOT:
 *   - Re-run kuromoji
 *   - Call any external APIs
 *   - Re-handle what lexer.js already covers (suru-verbs, V+V, adj+aux, noun+suffix)
 *   - Merge particles (助詞) into anything
 */

// ── Helpers ──────────────────────────────────────────────────────────────────

function headToken(unit) {
  return unit.sourceTokens[0];
}

function makeSpan(units, reason) {
  const surfaceForm  = units.map(u => u.surfaceForm).join('');
  const reading      = units.map(u => u.reading).join('');
  const lemma        = units.map(u => u.lemma).join('');
  const startIndex   = units[0].startIndex;
  const endIndex     = units[units.length - 1].endIndex;
  const partOfSpeech = units[0].partOfSpeech;
  const sourceTokens = units.flatMap(u => u.sourceTokens);
  const type         = units[0].type ?? 'other';
  const grammarLabel = units[0].grammarLabel ?? null;
  const lookupTarget = units[0].lookupTarget ?? lemma;

  return {
    surfaceForm,
    lemma,
    reading,
    lookupTarget,
    partOfSpeech,
    startIndex,
    endIndex,
    sourceTokens,
    type,
    grammarLabel,
    locked: false,  // merged fallback spans are never locked
    // Backward-compat aliases required by TextDisplay, WordModal, App
    surface_form: surfaceForm,
    basic_form:   lemma,
    pos:          partOfSpeech,
    // Debug field — visible in devtools console.log(tokenLines)
    mergeReason: reason,
  };
}

// ── Guards ───────────────────────────────────────────────────────────────────

/**
 * Noun subtypes that must not participate in span merges on either side.
 * These are either already handled by lexer.js or are grammatically independent.
 */
function isNonMergeableNoun(unit) {
  const d1 = headToken(unit).pos_detail_1;
  return (
    d1 === '接尾'         ||  // nominal suffix: lexer already absorbs these
    d1 === '助数詞'       ||  // counter: lexer already absorbs these
    d1 === '代名詞'       ||  // pronoun: 私, あなた, これ — always independent
    d1 === '形容動詞語幹' ||  // na-adj stem: has its own lexer pattern
    d1 === '数'               // numeral: lexer handles N+counter pairs
  );
}

// ── Katakana detection ────────────────────────────────────────────────────────

// Matches pure katakana strings including long-vowel mark (ー U+30FC) and middle dot (・ U+30FB)
const KATAKANA_RE = /^[\u30A0-\u30FF]+$/;

function isAllKatakana(str) {
  return KATAKANA_RE.test(str);
}

// ── Merge predicates ──────────────────────────────────────────────────────────

/**
 * Rule 0: number-sequence
 * Merge adjacent numeral tokens and attach counters.
 * Examples: 十+八→十八, 十八+歳→十八歳, 二+十+年→二十年
 * Must fire before isNonMergeableNoun guards which block 数 and 助数詞.
 */
function checkNumberSequence(left, right) {
  const leftD1  = headToken(left).pos_detail_1;
  const rightD1 = headToken(right).pos_detail_1;
  if (left.pos !== '名詞' || right.pos !== '名詞') return null;
  // Adjacent numerals: 十 + 八 → 十八
  if (leftD1 === '数' && rightD1 === '数') return { merge: true, reason: 'number-sequence' };
  // Numeral + counter: 十八 + 歳 → 十八歳
  if (leftD1 === '数' && rightD1 === '助数詞') return { merge: true, reason: 'number-counter' };
  return null;
}

/**
 * Rule 1: prefix-attach
 * 接頭詞 (prefix) units unconditionally bind to the immediately following unit.
 * Examples: お+茶→お茶, ご+飯→ご飯, 超+高速→超高速, 不+可能→不可能
 */
function checkPrefixAttach(left, right) {
  if (headToken(left).pos !== '接頭詞') return null;
  if (right.pos === '助詞') return null;
  if (right.pos === '記号') return null;
  return { merge: true, reason: 'prefix-attach' };
}

/**
 * Rule 2: katakana-compound
 * Adjacent pure-katakana nouns form a single loanword compound.
 * Examples: コーヒー+ショップ→コーヒーショップ, ゲーム+センター→ゲームセンター
 */
function checkKatakanaCompound(left, right) {
  if (left.pos !== '名詞') return null;
  if (right.pos !== '名詞') return null;
  if (!isAllKatakana(left.surfaceForm)) return null;
  if (!isAllKatakana(right.surfaceForm)) return null;
  if (isNonMergeableNoun(right)) return null;
  return { merge: true, reason: 'katakana-compound' };
}

/**
 * Rule 3: noun-compound
 * Adjacent standalone nouns that form a single compound lexical unit.
 * Examples: 電子+辞書→電子辞書, 携帯+電話→携帯電話, 東京+大学→東京大学
 *
 * Excludes:
 *   - 副詞可能 nouns (temporal/adverbial: 今日, 昨日, 今) — used as adverbs, not compound heads
 *   - Single hiragana on the left — too ambiguous (may be a mislabeled particle or filler)
 *   - Any type in isNonMergeableNoun (suffix, counter, pronoun, na-adj stem, numeral)
 */
function checkNounCompound(left, right) {
  if (left.pos !== '名詞') return null;
  if (right.pos !== '名詞') return null;
  if (isNonMergeableNoun(left)) return null;
  if (isNonMergeableNoun(right)) return null;

  const leftD1  = headToken(left).pos_detail_1;
  const rightD1 = headToken(right).pos_detail_1;

  if (leftD1  === '副詞可能') return null;
  if (rightD1 === '副詞可能') return null;

  // Single hiragana on the left is too ambiguous
  if (left.surfaceForm.length === 1 && /^[\u3040-\u309F]$/.test(left.surfaceForm)) return null;

  return { merge: true, reason: 'noun-compound' };
}

// ── Master dispatcher ─────────────────────────────────────────────────────────

function shouldMerge(left, right) {
  // Locked spans (grammar patterns) are never absorbed into noun compounds or prefix spans.
  if (left.locked || right.locked) return null;

  // Hard guards: particles, punctuation, and auxiliaries can never be merged into
  if (right.pos === '助詞')   return null;
  if (right.pos === '記号')   return null;
  if (right.pos === '助動詞') return null;

  // Rules in priority order — first match wins
  return (
    checkNumberSequence(left, right) ??
    checkPrefixAttach(left, right) ??
    checkKatakanaCompound(left, right) ??
    checkNounCompound(left, right)
  );
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Resolve a LexicalUnit[] into learner-facing SpanUnit[].
 *
 * Sits between resolveLexicalUnits() [lexer.js] and the render layer.
 * Applies context-aware neighbor merges for noun compounds, katakana sequences,
 * and prefix attachment. All other units pass through unchanged (zero-copy).
 *
 * @param {object[]} units - LexicalUnit[] from resolveLexicalUnits()
 * @param {string} _sentenceText - raw sentence string (reserved for future rules)
 * @returns {object[]} SpanUnit[] — same shape as LexicalUnit with mergeReason on merged spans
 */
export function resolveSpans(units, _sentenceText) {
  if (!units?.length) return units;

  const result = [];
  let pendingGroup   = [units[0]];
  let pendingReasons = [];

  for (let i = 1; i < units.length; i++) {
    const left  = pendingGroup[pendingGroup.length - 1];
    const right = units[i];

    const decision = shouldMerge(left, right);

    if (decision) {
      pendingGroup.push(right);
      pendingReasons.push(decision.reason);
    } else {
      result.push(
        pendingGroup.length === 1
          ? pendingGroup[0]
          : makeSpan(pendingGroup, pendingReasons[0])
      );
      pendingGroup   = [right];
      pendingReasons = [];
    }
  }

  // Flush the final accumulated group
  result.push(
    pendingGroup.length === 1
      ? pendingGroup[0]
      : makeSpan(pendingGroup, pendingReasons[0])
  );

  return result;
}
