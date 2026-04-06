/**
 * functional-patterns.js — Programmatic grammar pattern definitions
 *
 * These patterns use match(tokens, i) => boolean for constructions that cannot
 * be expressed as a fixed TokenPredicate sequence because the leading token
 * is a verb (variable surface form) whose conjugated te-form is determined by
 * context, not by a specific surface string.
 *
 * Pattern shape:
 *   {
 *     id:         string  — unique identifier
 *     type:       'grammar'
 *     tokenCount: number  — typical/minimum tokens consumed (sort priority)
 *     match:      (tokens, i) => boolean  — true iff pattern anchors at index i
 *     length:     (tokens, i) => number   — tokens to consume (called only if match=true)
 *     build:      (tokens, i, len) => PatternHit
 *   }
 *
 * PatternHit shape: { length, lemma, reading, type, grammarLabel }
 *
 * Sort priority: tokenCount DESC (same as declarative patterns' tokens.length).
 * All functional patterns here are tokenCount:3, so they sort with other 3-token
 * declarative patterns. Within the same length, array index is the tiebreak.
 *
 * Pattern-vs-lexer contract:
 *   These patterns fire BEFORE the lexer's POS rules. A matched span is
 *   consumed entirely; the lexer skips all those positions. This means
 *   functional patterns take precedence over verbContinues for the same tokens.
 *
 * Te-form detection model:
 *   At index i, we require tokens[i].pos === '動詞'.
 *   Then findTeIdx() skips over any 助動詞 tokens that may be sandwiched between
 *   the verb stem and the て-particle (rare but possible for e.g. さ + れ + て).
 *   After the て, we check the aspect-verb's basic_form.
 *   Trailing 助動詞 (ます, た, ない, etc.) are absorbed into the unit length.
 */

// ─── Shared helpers ────────────────────────────────────────────────────────────

/**
 * Find the te/de connector that follows the verb starting at `start`.
 * Skips 助動詞 tokens between the verb stem and the connector.
 * Returns the index of て/で, or -1 if not found.
 *
 * @param {object[]} tokens
 * @param {number}   start  — index of the head verb token
 * @returns {number}
 */
function findTeIdx(tokens, start) {
  let j = start + 1;
  while (j < tokens.length && tokens[j].pos === '助動詞') j++;
  if (j >= tokens.length) return -1;
  const t = tokens[j];
  if (t.pos === '助詞' && (t.surface_form === 'て' || t.surface_form === 'で')) return j;
  return -1;
}

function joinReading(tokens) {
  return tokens
    .map(t => (t.reading && t.reading !== '*') ? t.reading : t.surface_form)
    .join('');
}

function headLemma(token) {
  return (token.basic_form && token.basic_form !== '*') ? token.basic_form : token.surface_form;
}

/**
 * Compute how many tokens to consume for a te-form construction.
 * Counts from i through (teIdx + aspect-verb) and then absorbs any trailing
 * 助動詞 (polite ます, past た, negative ない, etc.).
 *
 * @param {object[]} tokens
 * @param {number}   i       — head verb index
 * @param {number}   teIdx   — index of the て connector
 * @returns {number}
 */
function teLength(tokens, i, teIdx) {
  let end = teIdx + 2; // one past the aspect verb
  while (end < tokens.length && tokens[end].pos === '助動詞') end++;
  return end - i;
}

/**
 * Build a standard PatternHit for a te-form construction.
 *
 * @param {object[]} tokens
 * @param {number}   i           — head verb index
 * @param {number}   len         — total tokens consumed
 * @param {string}   grammarLabel — display label, e.g. 'ている'
 * @returns {object} PatternHit
 */
function buildTeHit(tokens, i, len, grammarLabel) {
  const consumed = tokens.slice(i, i + len);
  return {
    length:      len,
    lemma:       headLemma(tokens[i]),   // base verb for Jisho lookup
    reading:     joinReading(consumed),
    type:        'grammar',
    grammarLabel,
  };
}

// ─── Pattern: ている — continuous / resultant state ────────────────────────────
//
// 食べている, 書いている, 住んでいる, 走っている
// Polite:  食べています (absorbs ます)
// Past:    食べていた   (absorbs い+た or いた)
// Negative: 食べていない (absorbs ない)
//
// kuromoji: いる → 動詞,非自立,basic=いる
//           い   → 動詞,非自立,basic=いる  (before ます/た/ない)

export const V_TE_IRU = {
  id: 'v-te-iru', type: 'grammar', tokenCount: 3,
  match(tokens, i) {
    if (tokens[i].pos !== '動詞') return false;
    const teIdx = findTeIdx(tokens, i);
    if (teIdx < 0) return false;
    const next = tokens[teIdx + 1];
    return next?.basic_form === 'いる' && next?.pos === '動詞';
  },
  length(tokens, i) {
    return teLength(tokens, i, findTeIdx(tokens, i));
  },
  build(tokens, i, len) {
    return buildTeHit(tokens, i, len, 'ている');
  },
};

// ─── Pattern: てしまう — completive / regret aspect ────────────────────────────
//
// 食べてしまう, 忘れてしまった, やってしまいました
// kuromoji: しまう → 動詞,自立 (basic=しまう)
//           しまい → 動詞,自立 (basic=しまう, before ます)
//           しまっ → 動詞,自立 (basic=しまう, before た)

export const V_TE_SHIMAU = {
  id: 'v-te-shimau', type: 'grammar', tokenCount: 3,
  match(tokens, i) {
    if (tokens[i].pos !== '動詞') return false;
    const teIdx = findTeIdx(tokens, i);
    if (teIdx < 0) return false;
    const next = tokens[teIdx + 1];
    return next?.basic_form === 'しまう' && next?.pos === '動詞';
  },
  length(tokens, i) {
    return teLength(tokens, i, findTeIdx(tokens, i));
  },
  build(tokens, i, len) {
    return buildTeHit(tokens, i, len, 'てしまう');
  },
};

// ─── Pattern: てみる — tentative / experimental aspect ────────────────────────
//
// 食べてみる, 試してみた, 書いてみましょう
// kuromoji: みる → 動詞,非自立,basic=みる

export const V_TE_MIRU = {
  id: 'v-te-miru', type: 'grammar', tokenCount: 3,
  match(tokens, i) {
    if (tokens[i].pos !== '動詞') return false;
    const teIdx = findTeIdx(tokens, i);
    if (teIdx < 0) return false;
    const next = tokens[teIdx + 1];
    return next?.basic_form === 'みる' && next?.pos === '動詞';
  },
  length(tokens, i) {
    return teLength(tokens, i, findTeIdx(tokens, i));
  },
  build(tokens, i, len) {
    return buildTeHit(tokens, i, len, 'てみる');
  },
};

// ─── Pattern: ておく — preparatory / leave-in-state aspect ────────────────────
//
// 買っておく, 準備しておいた, 読んでおきます
// kuromoji: おく → 動詞,非自立,basic=おく
//           おい → 動詞,非自立,basic=おく  (before ます/た — contracted: ておく → とく common)
//           ote: contracted とく form is not handled here (different tokenization)

export const V_TE_OKU = {
  id: 'v-te-oku', type: 'grammar', tokenCount: 3,
  match(tokens, i) {
    if (tokens[i].pos !== '動詞') return false;
    const teIdx = findTeIdx(tokens, i);
    if (teIdx < 0) return false;
    const next = tokens[teIdx + 1];
    return next?.basic_form === 'おく' && next?.pos === '動詞';
  },
  length(tokens, i) {
    return teLength(tokens, i, findTeIdx(tokens, i));
  },
  build(tokens, i, len) {
    return buildTeHit(tokens, i, len, 'ておく');
  },
};

// ─── Pattern: てくる — directional / inceptive aspect ─────────────────────────
//
// 走ってくる, 変わってきた, 増えてきています
// kuromoji: くる → 動詞,非自立,basic=くる (来る, irregular)
//           き   → 動詞,非自立,basic=くる  (連用形 before ます/た)

export const V_TE_KURU = {
  id: 'v-te-kuru', type: 'grammar', tokenCount: 3,
  match(tokens, i) {
    if (tokens[i].pos !== '動詞') return false;
    const teIdx = findTeIdx(tokens, i);
    if (teIdx < 0) return false;
    const next = tokens[teIdx + 1];
    return next?.basic_form === 'くる' && next?.pos === '動詞';
  },
  length(tokens, i) {
    return teLength(tokens, i, findTeIdx(tokens, i));
  },
  build(tokens, i, len) {
    return buildTeHit(tokens, i, len, 'てくる');
  },
};

// ─── Pattern: ていく — directional / progressive aspect ───────────────────────
//
// 歩いていく, 増えていった, 変わっていきます
// kuromoji: いく / ゆく → 動詞,非自立,basic=いく (行く)
//           い   → 動詞,非自立,basic=いく  (連用形 before ます/た)

export const V_TE_IKU = {
  id: 'v-te-iku', type: 'grammar', tokenCount: 3,
  match(tokens, i) {
    if (tokens[i].pos !== '動詞') return false;
    const teIdx = findTeIdx(tokens, i);
    if (teIdx < 0) return false;
    const next = tokens[teIdx + 1];
    return next?.basic_form === 'いく' && next?.pos === '動詞';
  },
  length(tokens, i) {
    return teLength(tokens, i, findTeIdx(tokens, i));
  },
  build(tokens, i, len) {
    return buildTeHit(tokens, i, len, 'ていく');
  },
};

// ─── Pattern: てあげる — benefactive "do for someone" ─────────────────────────
//
// 食べてあげる, 書いてあげた, 教えてあげましょう
// kuromoji: あげる → 動詞,自立 (basic=あげる)
//           あげ   → 動詞,自立 (basic=あげる, before ます/た)

export const V_TE_AGERU = {
  id: 'v-te-ageru', type: 'grammar', tokenCount: 3,
  match(tokens, i) {
    if (tokens[i].pos !== '動詞') return false;
    const teIdx = findTeIdx(tokens, i);
    if (teIdx < 0) return false;
    const next = tokens[teIdx + 1];
    return next?.basic_form === 'あげる' && next?.pos === '動詞';
  },
  length(tokens, i) {
    return teLength(tokens, i, findTeIdx(tokens, i));
  },
  build(tokens, i, len) {
    return buildTeHit(tokens, i, len, 'てあげる');
  },
};

// ─── Pattern: てもらう — benefactive "have someone do / receive the favor" ─────
//
// 書いてもらう, 教えてもらった, 直してもらいます
// kuromoji: もらう → 動詞,自立 (basic=もらう)
//           もら   → 動詞,自立 (basic=もらう, before い+ます/い+た)

export const V_TE_MORAU = {
  id: 'v-te-morau', type: 'grammar', tokenCount: 3,
  match(tokens, i) {
    if (tokens[i].pos !== '動詞') return false;
    const teIdx = findTeIdx(tokens, i);
    if (teIdx < 0) return false;
    const next = tokens[teIdx + 1];
    return next?.basic_form === 'もらう' && next?.pos === '動詞';
  },
  length(tokens, i) {
    return teLength(tokens, i, findTeIdx(tokens, i));
  },
  build(tokens, i, len) {
    return buildTeHit(tokens, i, len, 'てもらう');
  },
};

// ─── Pattern: てくれる — benefactive "they do for me/us" ───────────────────────
//
// 教えてくれる, 手伝ってくれた, 送ってくれます
// kuromoji: くれる → 動詞,自立 (basic=くれる)
//           くれ   → 動詞,自立 (basic=くれる, before ます/た)

export const V_TE_KURERU = {
  id: 'v-te-kureru', type: 'grammar', tokenCount: 3,
  match(tokens, i) {
    if (tokens[i].pos !== '動詞') return false;
    const teIdx = findTeIdx(tokens, i);
    if (teIdx < 0) return false;
    const next = tokens[teIdx + 1];
    return next?.basic_form === 'くれる' && next?.pos === '動詞';
  },
  length(tokens, i) {
    return teLength(tokens, i, findTeIdx(tokens, i));
  },
  build(tokens, i, len) {
    return buildTeHit(tokens, i, len, 'てくれる');
  },
};

// ─── Pattern: ていただく — humble "have someone do" ───────────────────────────
//
// 説明していただく, 確認していただきました
// kuromoji: いただく → 動詞,自立 (basic=いただく)
//           いただき → 動詞,自立 (basic=いただく, before ます/た)

export const V_TE_ITADAKU = {
  id: 'v-te-itadaku', type: 'grammar', tokenCount: 3,
  match(tokens, i) {
    if (tokens[i].pos !== '動詞') return false;
    const teIdx = findTeIdx(tokens, i);
    if (teIdx < 0) return false;
    const next = tokens[teIdx + 1];
    return next?.basic_form === 'いただく' && next?.pos === '動詞';
  },
  length(tokens, i) {
    return teLength(tokens, i, findTeIdx(tokens, i));
  },
  build(tokens, i, len) {
    return buildTeHit(tokens, i, len, 'ていただく');
  },
};

// ─── Pattern: てから — sequential "after doing" ───────────────────────────────
//
// 食べてから帰る, 確認してから送る, 寝てから考える
// Second element is から (助詞), not a verb.
//
// length: verb stem tokens + て connector + から (no trailing aux absorption here
// since から starts the next clause — the caller's conj-tail loop handles it if needed)

export const V_TE_KARA = {
  id: 'v-te-kara', type: 'grammar', tokenCount: 3,
  match(tokens, i) {
    if (tokens[i].pos !== '動詞') return false;
    const teIdx = findTeIdx(tokens, i);
    if (teIdx < 0) return false;
    const next = tokens[teIdx + 1];
    return next?.surface_form === 'から' && next?.pos === '助詞';
  },
  length(tokens, i) {
    const teIdx = findTeIdx(tokens, i);
    // verb stem tokens (may be > 1 if 助動詞 sandwiched) + て + から
    return teIdx - i + 2;
  },
  build(tokens, i, len) {
    const consumed = tokens.slice(i, i + len);
    return {
      length:      len,
      lemma:       headLemma(tokens[i]),
      reading:     joinReading(consumed),
      type:        'grammar',
      grammarLabel: 'てから',
    };
  },
};

// ─── Pattern: ても — concessive "even if / even though" ───────────────────────
//
// 食べても太らない, 行っても意味がない, 努力しても無駄だ
// Second element is も (助詞,係助詞), not a verb.
// Must NOT fire when followed by いい/よい — those are handled by v-te-mo-ii.
//
// NOTE: tokenCount=3 is the same as v-te-mo-ii. v-te-mo-ii has higher priority (4)
// so it is sorted first among equal-length patterns when both could match.

export const V_TE_MO = {
  id: 'v-te-mo', type: 'grammar', tokenCount: 3, priority: 0,
  match(tokens, i) {
    if (tokens[i].pos !== '動詞') return false;
    const teIdx = findTeIdx(tokens, i);
    if (teIdx < 0) return false;
    const next  = tokens[teIdx + 1];
    const after = tokens[teIdx + 2];
    if (next?.basic_form !== 'も' || next?.pos !== '助詞') return false;
    // Defer to v-te-mo-ii when followed by いい/よい
    if (after?.basic_form === 'いい' || after?.basic_form === 'よい') return false;
    return true;
  },
  length(tokens, i) {
    const teIdx = findTeIdx(tokens, i);
    return teIdx - i + 2;  // verb tokens + て + も
  },
  build(tokens, i, len) {
    const consumed = tokens.slice(i, i + len);
    return {
      length:      len,
      lemma:       headLemma(tokens[i]),
      reading:     joinReading(consumed),
      type:        'grammar',
      grammarLabel: 'ても',
    };
  },
};

// ─── Pattern: てもいい — permissive "it's okay to / may" ──────────────────────
//
// 食べてもいい, 帰ってもいいです, 見てもよかった
// Subsumes the verb + the whole てもいい construction so the learner taps one unit.
// priority=4 ensures this sorts above v-te-mo (priority=0) at the same tokenCount.

export const V_TE_MO_II = {
  id: 'v-te-mo-ii', type: 'grammar', tokenCount: 4, priority: 4,
  match(tokens, i) {
    if (tokens[i].pos !== '動詞') return false;
    const teIdx = findTeIdx(tokens, i);
    if (teIdx < 0) return false;
    const mo  = tokens[teIdx + 1];
    const ii  = tokens[teIdx + 2];
    return (
      mo?.basic_form === 'も'   && mo?.pos === '助詞' &&
      (ii?.basic_form === 'いい' || ii?.basic_form === 'よい') && ii?.pos === '形容詞'
    );
  },
  length(tokens, i) {
    const teIdx = findTeIdx(tokens, i);
    // verb tokens + て + も + いい/よい, then absorb trailing 助動詞
    let end = teIdx + 3;
    while (end < tokens.length && tokens[end].pos === '助動詞') end++;
    return end - i;
  },
  build(tokens, i, len) {
    const consumed = tokens.slice(i, i + len);
    return {
      length:      len,
      lemma:       headLemma(tokens[i]),
      reading:     joinReading(consumed),
      type:        'grammar',
      grammarLabel: 'てもいい',
    };
  },
};

// ─── Pattern: てはいけない — prohibitive "must not / cannot" ──────────────────
//
// 食べてはいけない, 入ってはいけません, 使ってはいけなかった
// Subsumes the verb + てはいけない so the learner taps one unit.
// Priority=4, tokenCount=5 (longer than v-te-mo-ii, naturally wins).

export const V_TE_WA_IKENAI = {
  id: 'v-te-wa-ikenai', type: 'grammar', tokenCount: 5, priority: 4,
  match(tokens, i) {
    if (tokens[i].pos !== '動詞') return false;
    const teIdx = findTeIdx(tokens, i);
    if (teIdx < 0) return false;
    const wa     = tokens[teIdx + 1];
    const ikenai = tokens[teIdx + 2];
    const nai    = tokens[teIdx + 3];
    return (
      wa?.basic_form === 'は'     && wa?.pos === '助詞' &&
      ikenai?.basic_form === 'いける' && ikenai?.pos === '動詞' &&
      nai?.basic_form === 'ない'  && nai?.pos === '助動詞'
    );
  },
  length(tokens, i) {
    const teIdx = findTeIdx(tokens, i);
    // verb tokens + て + は + いけ + ない, absorb trailing 助動詞 (e.g. ません)
    let end = teIdx + 4;
    while (end < tokens.length && tokens[end].pos === '助動詞') end++;
    return end - i;
  },
  build(tokens, i, len) {
    const consumed = tokens.slice(i, i + len);
    return {
      length:      len,
      lemma:       headLemma(tokens[i]),
      reading:     joinReading(consumed),
      type:        'grammar',
      grammarLabel: 'てはいけない',
    };
  },
};

// ─── Export ───────────────────────────────────────────────────────────────────

export const FUNCTIONAL_PATTERNS = [
  // Existing te-form aspect patterns
  V_TE_IRU,
  V_TE_SHIMAU,
  V_TE_MIRU,
  V_TE_OKU,
  V_TE_KURU,
  V_TE_IKU,
  // New te-form benefactive patterns
  V_TE_AGERU,
  V_TE_MORAU,
  V_TE_KURERU,
  V_TE_ITADAKU,
  // New te-form modal/conditional patterns
  V_TE_WA_IKENAI,  // 5 tokens — sorted first among the te-modal group
  V_TE_MO_II,      // 4 tokens, priority=4
  V_TE_KARA,       // 3 tokens
  V_TE_MO,         // 3 tokens, priority=0 (after v-te-kara and v-te-mo-ii)
];
