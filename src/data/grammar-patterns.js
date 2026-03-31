/**
 * grammar-patterns.js — Japanese grammar construction patterns
 *
 * Each pattern describes a multi-token functional expression that should be
 * treated as a single learner-facing unit (e.g. ことになる, てもいい).
 *
 * Pattern shape:
 *   { id, type, lemma, reading, tokens: TokenPredicate[] }
 *
 * TokenPredicate shape (ALL specified fields must match — AND logic):
 *   {
 *     surface?:    string             — exact surface_form match
 *     basicForm?:  string | string[]  — basic_form match (or any-of array)
 *     pos?:        string | string[]  — pos match (or any-of array)
 *     posDetail1?: string | string[]  — pos_detail_1 match (or any-of array)
 *   }
 *
 * Priority: longer patterns win over shorter ones (enforced by patternMatcher.js
 * which sorts by token count descending). Within the same length, array order
 * determines priority.
 *
 * Kuromoji IPAdic tag reference for common functional words:
 *   こと/よう/はず/もの/わけ/ところ/ため  → 名詞, 非自立
 *   に/が/は/も/と/て/かも/ばかり           → 助詞, (various pos_detail_1)
 *   なる/する/ある/いう/できる/しれる/すぎる → 動詞, 自立
 *   ある (copula context)                   → 動詞, 非自立
 *   だ/ない (auxiliary)                     → 助動詞 (basic_form=だ or ない)
 *   ない (adjective)                        → 形容詞, 自立
 *   ほしい                                  → 形容詞, 非自立
 *   いい/よい                               → 形容詞, 自立
 */

export const GRAMMAR_PATTERNS = [

  // ── 4-token patterns ──────────────────────────────────────────────────────

  // 1. てはいけない — "must not do"
  // て(助詞,接続助詞) + は(助詞,係助詞) + いけ(動詞,basic=いける) + ない(助動詞)
  {
    id: 'te-wa-ikenai', type: 'grammar',
    lemma: 'てはいけない', reading: 'てはいけない',
    tokens: [
      { surface: 'て',       pos: '助詞',  posDetail1: '接続助詞' },
      { basicForm: 'は',     pos: '助詞',  posDetail1: '係助詞'   },
      { basicForm: 'いける', pos: '動詞'                          },
      { basicForm: 'ない',   pos: '助動詞'                        },
    ],
  },

  // Fallback for かもしれない when kuromoji splits かも → か + も (4 tokens)
  {
    id: 'ka-mo-shirenai', type: 'grammar',
    lemma: 'かもしれない', reading: 'かもしれない',
    tokens: [
      { surface: 'か',       pos: '助詞'                       },
      { surface: 'も',       pos: '助詞', posDetail1: '係助詞' },
      { basicForm: 'しれる', pos: '動詞'                       },
      { basicForm: 'ない',   pos: '助動詞'                     },
    ],
  },

  // ── 3-token patterns ──────────────────────────────────────────────────────

  // 3. なければならない — "must do"
  // なければ is the conditional form of ない → basic_form=ない, pos=助動詞
  // ならない → なら(動詞,非自立,basic=なる) + ない(助動詞)
  // Matches the 3-token grammar suffix; the preceding verb is left to the lexer.
  {
    id: 'nakereba-naranai', type: 'grammar',
    lemma: 'なければならない', reading: 'なければならない',
    tokens: [
      { basicForm: 'ない', pos: '助動詞'                       },
      { basicForm: 'なる', pos: '動詞',  posDetail1: '非自立'  },
      { basicForm: 'ない', pos: '助動詞'                       },
    ],
  },

  // 4. ことになる — "it has been decided / it turns out"
  {
    id: 'koto-ni-naru', type: 'grammar',
    lemma: 'ことになる', reading: 'ことになる',
    tokens: [
      { basicForm: 'こと', pos: '名詞', posDetail1: '非自立' },
      { basicForm: 'に',   pos: '助詞', posDetail1: '格助詞' },
      { basicForm: 'なる', pos: '動詞'                       },
    ],
  },

  // 5. ことにする — "decide to"
  {
    id: 'koto-ni-suru', type: 'grammar',
    lemma: 'ことにする', reading: 'ことにする',
    tokens: [
      { basicForm: 'こと', pos: '名詞', posDetail1: '非自立' },
      { basicForm: 'に',   pos: '助詞', posDetail1: '格助詞' },
      { basicForm: 'する', pos: '動詞'                       },
    ],
  },

  // 6. ことができる — "can / be able to"
  {
    id: 'koto-ga-dekiru', type: 'grammar',
    lemma: 'ことができる', reading: 'ことができる',
    tokens: [
      { basicForm: 'こと',   pos: '名詞', posDetail1: '非自立' },
      { basicForm: 'が',     pos: '助詞', posDetail1: '格助詞' },
      { basicForm: 'できる', pos: '動詞'                       },
    ],
  },

  // 7. ことがある — "there are times when / it happens that"
  {
    id: 'koto-ga-aru', type: 'grammar',
    lemma: 'ことがある', reading: 'ことがある',
    tokens: [
      { basicForm: 'こと', pos: '名詞', posDetail1: '非自立' },
      { basicForm: 'が',   pos: '助詞', posDetail1: '格助詞' },
      { basicForm: 'ある', pos: '動詞'                       },
    ],
  },

  // 8. ことはない — "no need to / it never happens"
  // ない here is 形容詞 (predicative adjective), not 助動詞
  {
    id: 'koto-wa-nai', type: 'grammar',
    lemma: 'ことはない', reading: 'ことはない',
    tokens: [
      { basicForm: 'こと', pos: '名詞',   posDetail1: '非自立' },
      { basicForm: 'は',   pos: '助詞',   posDetail1: '係助詞' },
      { basicForm: 'ない', pos: '形容詞'                       },
    ],
  },

  // 9. ようになる — "come to / reach the state where"
  {
    id: 'you-ni-naru', type: 'grammar',
    lemma: 'ようになる', reading: 'ようになる',
    tokens: [
      { basicForm: 'よう', pos: '名詞', posDetail1: '非自立' },
      { basicForm: 'に',   pos: '助詞', posDetail1: '格助詞' },
      { basicForm: 'なる', pos: '動詞'                       },
    ],
  },

  // 10. ようにする — "make it so that / try to ensure"
  {
    id: 'you-ni-suru', type: 'grammar',
    lemma: 'ようにする', reading: 'ようにする',
    tokens: [
      { basicForm: 'よう', pos: '名詞', posDetail1: '非自立' },
      { basicForm: 'に',   pos: '助詞', posDetail1: '格助詞' },
      { basicForm: 'する', pos: '動詞'                       },
    ],
  },

  // 11. はずがない — "there is no way / cannot be"
  {
    id: 'hazu-ga-nai', type: 'grammar',
    lemma: 'はずがない', reading: 'はずがない',
    tokens: [
      { basicForm: 'はず', pos: '名詞',   posDetail1: '非自立' },
      { basicForm: 'が',   pos: '助詞',   posDetail1: '格助詞' },
      { basicForm: 'ない', pos: '形容詞'                       },
    ],
  },

  // 12. わけがない — "there is no way / impossible"
  {
    id: 'wake-ga-nai', type: 'grammar',
    lemma: 'わけがない', reading: 'わけがない',
    tokens: [
      { basicForm: 'わけ', pos: '名詞',   posDetail1: '非自立' },
      { basicForm: 'が',   pos: '助詞',   posDetail1: '格助詞' },
      { basicForm: 'ない', pos: '形容詞'                       },
    ],
  },

  // 13. ものがある — "there is a quality of / truly is"
  {
    id: 'mono-ga-aru', type: 'grammar',
    lemma: 'ものがある', reading: 'ものがある',
    tokens: [
      { basicForm: 'もの', pos: '名詞', posDetail1: '非自立' },
      { basicForm: 'が',   pos: '助詞', posDetail1: '格助詞' },
      { basicForm: 'ある', pos: '動詞'                       },
    ],
  },

  // 14. てもいい — "it's okay to / may"
  // basic_form array covers both いい and よい surface variants
  {
    id: 'te-mo-ii', type: 'grammar',
    lemma: 'てもいい', reading: 'てもいい',
    tokens: [
      { surface: 'て',                   pos: '助詞',   posDetail1: '接続助詞' },
      { basicForm: 'も',                 pos: '助詞',   posDetail1: '係助詞'   },
      { basicForm: ['いい', 'よい'],     pos: '形容詞'                         },
    ],
  },

  // 15. かもしれない — "might / perhaps"
  // かも is one token in kuromoji 0.1.2; see ka-mo-shirenai above for split fallback
  {
    id: 'kamo-shirenai', type: 'grammar',
    lemma: 'かもしれない', reading: 'かもしれない',
    tokens: [
      { basicForm: 'かも',   pos: '助詞', posDetail1: '副助詞' },
      { basicForm: 'しれる', pos: '動詞'                       },
      { basicForm: 'ない',   pos: '助動詞'                     },
    ],
  },

  // 16. に違いない — "must be / without doubt"
  {
    id: 'ni-chigai-nai', type: 'grammar',
    lemma: 'に違いない', reading: 'にちがいない',
    tokens: [
      { basicForm: 'に',   pos: '助詞',   posDetail1: '格助詞' },
      { basicForm: '違い', pos: '名詞',   posDetail1: '非自立' },
      { basicForm: 'ない', pos: '形容詞'                       },
    ],
  },

  // 17. にすぎない — "nothing more than / merely"
  // ない may be tagged 助動詞 or 形容詞 depending on kuromoji version
  {
    id: 'ni-suginai', type: 'grammar',
    lemma: 'にすぎない', reading: 'にすぎない',
    tokens: [
      { basicForm: 'に',    pos: '助詞',                posDetail1: '格助詞'   },
      { basicForm: 'すぎる', pos: '動詞'                                       },
      { basicForm: 'ない',   pos: ['助動詞', '形容詞']                          },
    ],
  },

  // ── 2-token patterns ──────────────────────────────────────────────────────

  // 18. ために — "in order to / for the purpose of"
  {
    id: 'tame-ni', type: 'grammar',
    lemma: 'ために', reading: 'ために',
    tokens: [
      { basicForm: 'ため', pos: '名詞', posDetail1: '非自立' },
      { basicForm: 'に',   pos: '助詞', posDetail1: '格助詞' },
    ],
  },

  // 19. はずだ — "should be / expected to be"
  // basic_form=だ covers all conjugated forms: だ, だっ (past), で (te-form)
  {
    id: 'hazu-da', type: 'grammar',
    lemma: 'はずだ', reading: 'はずだ',
    tokens: [
      { basicForm: 'はず', pos: '名詞',   posDetail1: '非自立' },
      { basicForm: 'だ',   pos: '助動詞'                       },
    ],
  },

  // 20. ものだ — "that's how things are / supposed to"
  {
    id: 'mono-da', type: 'grammar',
    lemma: 'ものだ', reading: 'ものだ',
    tokens: [
      { basicForm: 'もの', pos: '名詞',   posDetail1: '非自立' },
      { basicForm: 'だ',   pos: '助動詞'                       },
    ],
  },

  // 21. わけだ — "that means / naturally / of course"
  {
    id: 'wake-da', type: 'grammar',
    lemma: 'わけだ', reading: 'わけだ',
    tokens: [
      { basicForm: 'わけ', pos: '名詞',   posDetail1: '非自立' },
      { basicForm: 'だ',   pos: '助動詞'                       },
    ],
  },

  // 22. ところだ — "just about to / just finished / in the middle of"
  {
    id: 'tokoro-da', type: 'grammar',
    lemma: 'ところだ', reading: 'ところだ',
    tokens: [
      { basicForm: 'ところ', pos: '名詞',   posDetail1: '非自立' },
      { basicForm: 'だ',     pos: '助動詞'                       },
    ],
  },

  // 23. てほしい — "want (someone) to do"
  // ほしい tagged 形容詞,非自立 (non-independent) in this te-form construction
  {
    id: 'te-hoshii', type: 'grammar',
    lemma: 'てほしい', reading: 'てほしい',
    tokens: [
      { surface: 'て',       pos: '助詞',   posDetail1: '接続助詞' },
      { basicForm: 'ほしい', pos: '形容詞', posDetail1: '非自立'   },
    ],
  },

  // 24. ばかりだ — "nothing but / keeps on / just"
  {
    id: 'bakari-da', type: 'grammar',
    lemma: 'ばかりだ', reading: 'ばかりだ',
    tokens: [
      { basicForm: 'ばかり', pos: '助詞',   posDetail1: '副助詞' },
      { basicForm: 'だ',     pos: '助動詞'                       },
    ],
  },

  // 25. という — "called / the fact that"
  {
    id: 'to-iu', type: 'grammar',
    lemma: 'という', reading: 'という',
    tokens: [
      { basicForm: 'と',   pos: '助詞', posDetail1: '格助詞' },
      { basicForm: 'いう', pos: '動詞'                       },
    ],
  },

  // 26. である — "to be" (formal written copula)
  // で is the te-form of だ: basic_form=だ, pos=助動詞
  // ある here is 動詞,非自立 — distinguishes copula ある from existential ある (自立)
  {
    id: 'de-aru', type: 'grammar',
    lemma: 'である', reading: 'である',
    tokens: [
      { basicForm: 'だ',   pos: '助動詞'                     },
      { basicForm: 'ある', pos: '動詞', posDetail1: '非自立' },
    ],
  },

];
