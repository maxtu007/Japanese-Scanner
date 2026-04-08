import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Capacitor } from '@capacitor/core';
import { InAppReview } from '@capacitor-community/in-app-review';
import TextDisplay from './TextDisplay';

// ── Welcome slides ────────────────────────────────────────────────────────────
const WELCOME_SLIDES = [
  {
    id: 'w1',
    illustration: (
      <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Book */}
        <rect x="22" y="30" width="76" height="60" rx="6" fill="#eef1fe" />
        <rect x="22" y="30" width="4" height="60" fill="#c7d0fa" />
        {/* Japanese text lines on book */}
        <rect x="34" y="42" width="50" height="5" rx="2.5" fill="#c7d0fa" />
        <rect x="34" y="52" width="38" height="5" rx="2.5" fill="#c7d0fa" />
        <rect x="34" y="62" width="46" height="5" rx="2.5" fill="#c7d0fa" />
        <rect x="34" y="72" width="30" height="5" rx="2.5" fill="#c7d0fa" />
        {/* Mystery kanji floating - blurred/blocked */}
        <rect x="36" y="44" width="10" height="10" rx="2" fill="#4c6ef5" opacity="0.2" />
        <rect x="58" y="44" width="10" height="10" rx="2" fill="#4c6ef5" opacity="0.2" />
        <rect x="36" y="60" width="10" height="10" rx="2" fill="#4c6ef5" opacity="0.2" />
        {/* Fog/blur overlay */}
        <rect x="60" y="55" width="36" height="30" rx="6" fill="white" opacity="0.7" />
        {/* Question marks */}
        <text x="68" y="72" fontSize="14" fill="#9ca3af" fontFamily="serif" textAnchor="middle">?</text>
        <text x="82" y="72" fontSize="14" fill="#9ca3af" fontFamily="serif" textAnchor="middle">?</text>
      </svg>
    ),
    headline: 'Japanese is everywhere around you.',
    body: 'Novels, textbooks, manga. And right now, most of it is invisible to you.',
  },
  {
    id: 'w2',
    illustration: (
      <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Phone */}
        <rect x="35" y="20" width="50" height="80" rx="10" fill="#eef1fe" />
        <rect x="35" y="20" width="50" height="80" rx="10" stroke="#4c6ef5" strokeWidth="1.5" fill="none" />
        {/* Screen content - Japanese text with furigana */}
        <rect x="43" y="35" width="34" height="4" rx="2" fill="#c7d0fa" />
        <rect x="43" y="30" width="14" height="3" rx="1.5" fill="#4c6ef5" opacity="0.4" />
        <rect x="43" y="48" width="26" height="4" rx="2" fill="#c7d0fa" />
        <rect x="43" y="43" width="10" height="3" rx="1.5" fill="#4c6ef5" opacity="0.4" />
        {/* Tap ripple on a word */}
        <circle cx="56" cy="64" r="10" fill="#4c6ef5" opacity="0.1" />
        <circle cx="56" cy="64" r="6" fill="#4c6ef5" opacity="0.15" />
        <rect x="48" y="61" width="16" height="5" rx="2.5" fill="#4c6ef5" />
        {/* Popup */}
        <rect x="30" y="76" width="60" height="18" rx="6" fill="white" stroke="#4c6ef5" strokeWidth="1.2" />
        <rect x="36" y="80" width="20" height="3" rx="1.5" fill="#0f1b4d" opacity="0.8" />
        <rect x="36" y="86" width="36" height="3" rx="1.5" fill="#6b7280" opacity="0.5" />
        {/* Timer badge */}
        <circle cx="89" cy="27" r="10" fill="#4c6ef5" />
        <text x="89" y="31" fontSize="8" fill="white" textAnchor="middle" fontWeight="bold">2m</text>
      </svg>
    ),
    headline: 'That changes in 2 minutes.',
    body: "Tell us a little about yourself — then we'll show you something that fixes all of it.",
  },
];

// ── Social platform icons ─────────────────────────────────────────────────────
const PlatformIcon = ({ id }) => {
  if (id === 'tiktok') return (
    <svg viewBox="0 0 36 36" fill="none"><rect width="36" height="36" rx="10" fill="#010101"/>
      <path d="M23.5 10.2c-.9-1-1.4-2.4-1.4-3.7h-3.2v15.6c0 1.6-1.3 2.9-2.9 2.9s-2.9-1.3-2.9-2.9 1.3-2.9 2.9-2.9c.3 0 .5 0 .8.1v-3.3c-.3 0-.5-.1-.8-.1C12.3 16 9 19.3 9 23.3S12.3 30.5 16 30.5s7-3.3 7-7.2V17c1.3.9 2.8 1.4 4.4 1.4v-3.2c-.9 0-2.7-.5-3.9-5z" fill="white"/>
    </svg>
  );
  if (id === 'instagram') return (
    <svg viewBox="0 0 36 36" fill="none"><rect width="36" height="36" rx="10" fill="url(#ig)"/>
      <defs><linearGradient id="ig" x1="0" y1="36" x2="36" y2="0"><stop stopColor="#f09433"/><stop offset="0.25" stopColor="#e6683c"/><stop offset="0.5" stopColor="#dc2743"/><stop offset="0.75" stopColor="#cc2366"/><stop offset="1" stopColor="#bc1888"/></linearGradient></defs>
      <rect x="9" y="9" width="18" height="18" rx="5" stroke="white" strokeWidth="1.8" fill="none"/>
      <circle cx="18" cy="18" r="4.5" stroke="white" strokeWidth="1.8" fill="none"/>
      <circle cx="24" cy="12" r="1.2" fill="white"/>
    </svg>
  );
  if (id === 'youtube') return (
    <svg viewBox="0 0 36 36" fill="none"><rect width="36" height="36" rx="10" fill="#FF0000"/>
      <path d="M27.8 13.2a2.5 2.5 0 0 0-1.8-1.8C24.4 11 18 11 18 11s-6.4 0-8 .4a2.5 2.5 0 0 0-1.8 1.8C8 14.8 8 18 8 18s0 3.2.4 4.8a2.5 2.5 0 0 0 1.8 1.8c1.6.4 8 .4 8 .4s6.4 0 8-.4a2.5 2.5 0 0 0 1.8-1.8c.4-1.6.4-4.8.4-4.8s0-3.2-.6-4.8z" fill="white"/>
      <polygon points="15.5,21 21.5,18 15.5,15" fill="#FF0000"/>
    </svg>
  );
  if (id === 'x') return (
    <svg viewBox="0 0 36 36" fill="none"><rect width="36" height="36" rx="10" fill="#000"/>
      <path d="M20.3 16.7L26.5 9h-1.5l-5.4 6.3L15 9H9.5l6.5 9.5L9.5 27H11l5.7-6.6L21.5 27H27l-6.7-10.3zm-2 2.3l-.7-1L11.5 10.2H14l4.3 6.2.7 1 5.5 7.9h-2.5l-4.7-6.3z" fill="white"/>
    </svg>
  );
  if (id === 'friend') return (
    <svg viewBox="0 0 36 36" fill="none"><rect width="36" height="36" rx="10" fill="#4c6ef5"/>
      <circle cx="18" cy="14" r="5" stroke="white" strokeWidth="1.8" fill="none"/>
      <path d="M8 29c0-5.5 4.5-10 10-10s10 4.5 10 10" stroke="white" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
    </svg>
  );
  if (id === 'other') return (
    <svg viewBox="0 0 36 36" fill="none"><rect width="36" height="36" rx="10" fill="#6b7280"/>
      <circle cx="18" cy="18" r="3" fill="white"/>
      <circle cx="9" cy="18" r="3" fill="white"/>
      <circle cx="27" cy="18" r="3" fill="white"/>
    </svg>
  );
  return null;
};

// ── Demo data — opening of 雪国 (Snow Country) by Kawabata (public domain) ──────
const DEMO_MEANINGS = {
  '国境':  { reading: 'こっきょう', meaning: 'border; boundary between regions' },
  '長い':  { reading: 'ながい',     meaning: 'long; lengthy' },
  'トンネル': { reading: 'とんねる', meaning: 'tunnel' },
  '抜ける': { reading: 'ぬける',    meaning: 'to pass through; to exit the other side' },
  '雪国':  { reading: 'ゆきぐに',   meaning: 'snow country; snowy land' },
  'ある':  { reading: 'ある',       meaning: 'to be; to exist (past form: あった)' },
  '夜':    { reading: 'よる',       meaning: 'night; nighttime' },
  '底':    { reading: 'そこ',       meaning: 'bottom; the very depths' },
  '白い':  { reading: 'しろい',     meaning: 'white; pure white' },
  'なる':  { reading: 'なる',       meaning: 'to become; to turn into' },
  '信号所': { reading: 'しんごうじょ', meaning: 'signal halt; railway signal stop' },
  '汽車':  { reading: 'きしゃ',     meaning: 'steam train; railway train (old-style)' },
  '止まる': { reading: 'とまる',    meaning: 'to stop; to come to a halt' },
};

const DEMO_BLOCKS = [
  {
    sentences: [
      {
        tokens: [
          { surface_form: '国境', reading: 'コッキョウ', pos: '名詞', basic_form: '国境', lookupTarget: '国境' },
          { surface_form: 'の',   reading: 'ノ',         pos: '助詞', basic_form: 'の' },
          { surface_form: '長い', reading: 'ナガイ',     pos: '形容詞', basic_form: '長い', lookupTarget: '長い' },
          { surface_form: 'トンネル', reading: 'トンネル', pos: '名詞', basic_form: 'トンネル', lookupTarget: 'トンネル' },
          { surface_form: 'を',   reading: 'ヲ',         pos: '助詞', basic_form: 'を' },
          { surface_form: '抜ける', reading: 'ヌケル',   pos: '動詞', basic_form: '抜ける', lookupTarget: '抜ける' },
          { surface_form: 'と',   reading: 'ト',         pos: '助詞', basic_form: 'と' },
          { surface_form: '雪国', reading: 'ユキグニ',   pos: '名詞', basic_form: '雪国', lookupTarget: '雪国' },
          { surface_form: 'で',   reading: 'デ',         pos: '助詞', basic_form: 'で' },
          { surface_form: 'あった', reading: 'アッタ',   pos: '動詞', basic_form: 'ある', lookupTarget: 'ある' },
          { surface_form: '。',   reading: '。',         pos: '記号', basic_form: '。' },
        ],
        translation: 'The train came out of the long tunnel into the snow country.',
      },
      {
        tokens: [
          { surface_form: '夜',   reading: 'ヨル',       pos: '名詞', basic_form: '夜', lookupTarget: '夜' },
          { surface_form: 'の',   reading: 'ノ',         pos: '助詞', basic_form: 'の' },
          { surface_form: '底',   reading: 'ソコ',       pos: '名詞', basic_form: '底', lookupTarget: '底' },
          { surface_form: 'が',   reading: 'ガ',         pos: '助詞', basic_form: 'が' },
          { surface_form: '白く', reading: 'シロク',     pos: '形容詞', basic_form: '白い', lookupTarget: '白い' },
          { surface_form: 'なった', reading: 'ナッタ',   pos: '動詞', basic_form: 'なる', lookupTarget: 'なる' },
          { surface_form: '。',   reading: '。',         pos: '記号', basic_form: '。' },
        ],
        translation: 'The bottom of the night had turned white.',
      },
      {
        tokens: [
          { surface_form: '信号所', reading: 'シンゴウジョ', pos: '名詞', basic_form: '信号所', lookupTarget: '信号所' },
          { surface_form: 'に',   reading: 'ニ',         pos: '助詞', basic_form: 'に' },
          { surface_form: '汽車', reading: 'キシャ',     pos: '名詞', basic_form: '汽車', lookupTarget: '汽車' },
          { surface_form: 'が',   reading: 'ガ',         pos: '助詞', basic_form: 'が' },
          { surface_form: '止まった', reading: 'トマッタ', pos: '動詞', basic_form: '止まる', lookupTarget: '止まる' },
          { surface_form: '。',   reading: '。',         pos: '記号', basic_form: '。' },
        ],
        translation: 'The train stopped at a signal halt.',
      },
    ],
  },
];

// ── Testimonials by context ───────────────────────────────────────────────────
const TESTIMONIALS = {
  manga:    [
    { initial: 'A', color: '#4c6ef5', name: 'Alex M.',  location: 'London',    quote: "Finished my first manga volume in Japanese. UnBlur made it actually possible — I stopped dreading every page." },
    { initial: 'Y', color: '#0ea5e9', name: 'Yuki R.',  location: 'Sydney',    quote: "I used to skip kanji I didn't know. Now I just tap them. My vocabulary doubled in a month from reading manga." },
  ],
  novels:   [
    { initial: 'C', color: '#7c3aed', name: 'Clara H.', location: 'Berlin',    quote: "Reading 雪国 in Japanese felt impossible before this. I'm on my third novel now." },
    { initial: 'J', color: '#059669', name: 'James T.', location: 'Toronto',   quote: "I'd been putting off Japanese novels for years. Finished my first one last month." },
  ],
  everyday: [
    { initial: 'S', color: '#dc2626', name: 'Sarah K.', location: 'Tokyo',     quote: "Two weeks in Japan — read every sign, every menu, every label. Never felt lost once." },
    { initial: 'M', color: '#4c6ef5', name: 'Marcus T.', location: 'New York', quote: "Went from struggling through menus to ordering like a local. Worth every penny." },
  ],
  social:   [
    { initial: 'P', color: '#0ea5e9', name: 'Priya S.', location: 'Singapore', quote: "I actually follow Japanese Twitter now. Used to be completely locked out of it." },
    { initial: 'L', color: '#7c3aed', name: 'Liam B.',  location: 'Melbourne', quote: "YouTube comments, Discord servers — I can participate now instead of just lurking." },
  ],
};
const DEFAULT_TESTIMONIALS = [
  { initial: 'S', color: '#4c6ef5', name: 'Sarah K.', location: 'Tokyo',    quote: "Finally I can read without stopping every 5 seconds. UnBlur completely changed how I study." },
  { initial: 'M', color: '#0ea5e9', name: 'Marcus T.', location: 'New York', quote: "Went from struggling through menus to reading signs confidently. Absolutely worth it." },
];

// ── Mirror text builders ──────────────────────────────────────────────────────
function getMirror1(answers) {
  const ctxMap = { manga: 'manga', novels: 'novels', everyday: 'everyday Japanese text', social: 'Japanese social media' };
  const frMap  = {
    switch: 'you have to stop and switch to Google Translate',
    dict:   'you stop to open a dictionary app and lose your place',
    skip:   "you skip the word and hope context fills the gap",
    stop:   'the frustration makes you want to stop reading entirely',
  };
  const ctxArr = answers.context || [];
  const ctxText = ctxArr.length > 0
    ? ctxArr.slice(0, 2).map(c => ctxMap[c] || c).join(' and ')
    : 'Japanese content';
  const frText = frMap[answers.friction] || 'you get stuck';
  return { ctxText, frText };
}

function getMirror2(answers) {
  const freqMap = {
    constant:   'losing your reading flow every few minutes',
    frequent:   'being interrupted several times every session',
    occasional: 'having your momentum killed every time it happens',
    stopped:    'having mostly given up on reading in Japanese',
  };
  const commitMap = {
    serious:    "you're done being stuck",
    pretty:     "you have the motivation — you just need the right tool",
    exploring:  "you're ready to try something new",
  };
  return {
    freq:   freqMap[answers.frequency]  || 'struggling with Japanese',
    commit: commitMap[answers.commitment] || "you're ready to change that",
  };
}

function getVisionText(answers) {
  const ctxMap = { manga: 'a manga chapter', novels: 'a Japanese novel', everyday: 'a sign or menu', social: 'a Japanese tweet' };
  const ctxArr = answers.context || [];
  return ctxArr[0] ? ctxMap[ctxArr[0]] : 'any Japanese text';
}

function getPlanItems(answers) {
  const ctxLabels  = { manga: 'Manga & Visual Novels', novels: 'Literary Fiction & Novels', everyday: 'Everyday Text & Signs', social: 'Social Media & Online Content' };
  const frLabels   = { switch: 'App-switching breaks flow', dict: 'Dictionary lookups break flow', skip: 'Skipping unknown kanji', stop: 'Frustration-driven reading blocks' };
  const freqLabels = { constant: 'Multiple times per minute', frequent: 'Several times per session', occasional: 'Occasional but flow-breaking', stopped: 'Severe — nearly quit reading' };
  const ctxArr = answers.context || [];
  return [
    { label: 'Reading context',  value: ctxArr.map(c => ctxLabels[c] || c).join(', ') || 'General Japanese' },
    { label: 'Primary friction', value: frLabels[answers.friction]  || 'Unknown words' },
    { label: 'Frequency',        value: freqLabels[answers.frequency] || 'Regular' },
    { label: 'Goal',             value: 'Read without interruption' },
    { label: 'Method',           value: 'Real-content immersion + instant lookup' },
  ];
}

// ── Screen definitions ────────────────────────────────────────────────────────
const SCREENS = [
  // ─ ACT 1: DIAGNOSIS ──────────────────────────────────────────────────────
  {
    type: 'question', id: 'source', label: 'WELCOME',
    question: 'Where did you hear about us?',
    subtext: "We're so glad you're here — let us know how you found UnBlur.",
    multiSelect: false,
    options: [
      { id: 'tiktok',    label: 'TikTok',          sub: 'Saw a video',            platform: true },
      { id: 'instagram', label: 'Instagram',        sub: 'Saw a post or reel',     platform: true },
      { id: 'youtube',   label: 'YouTube',          sub: 'Watched a video',        platform: true },
      { id: 'x',         label: 'X / Twitter',      sub: 'Saw a post',             platform: true },
      { id: 'friend',    label: 'A friend told me', sub: 'Word of mouth',          platform: true },
      { id: 'other',     label: 'Somewhere else',   sub: 'Google, App Store, etc', platform: true },
    ],
  },
  {
    type: 'question', id: 'identity', label: 'WHO YOU ARE',
    question: 'What best describes you right now?',
    subtext: "There's no wrong answer — we'll set up UnBlur for exactly who you are.",
    multiSelect: false,
    options: [
      { id: 'enthusiast', label: 'Japanese enthusiast',        sub: 'Anime, manga, games, music' },
      { id: 'student',    label: 'Actively studying Japanese', sub: 'Working through the language seriously' },
      { id: 'traveler',   label: 'Going to Japan',             sub: 'Preparing for a trip or move' },
      { id: 'immersed',   label: 'Japanese is in my daily life', sub: 'Work, school, or living in Japan' },
    ],
  },
  {
    type: 'question', id: 'context', label: 'YOUR WORLD',
    question: 'What do you most want to read without struggling?',
    subtext: 'Select all that apply.',
    multiSelect: true,
    options: [
      { id: 'manga',    label: 'Manga and visual novels',      sub: 'Panels, speech bubbles, text boxes' },
      { id: 'novels',   label: 'Novels and books',             sub: 'Literary fiction, light novels' },
      { id: 'everyday', label: 'Menus, signs, packaging',     sub: 'Real-world everyday text' },
      { id: 'social',   label: 'Social media and online',     sub: 'Tweets, YouTube, news articles' },
    ],
  },
  {
    type: 'question', id: 'friction', label: 'THE REALITY',
    question: "When you hit a kanji you don't know — what do you actually do?",
    subtext: "Be honest. We've all been there.",
    multiSelect: false,
    options: [
      { id: 'switch', label: 'Switch to Google Translate',    sub: "Leave what I'm reading, then lose my place" },
      { id: 'dict',   label: 'Open a dictionary app',         sub: 'Breaks my flow every single time' },
      { id: 'skip',   label: 'Skip it and hope context helps', sub: 'Miss the meaning, carry on anyway' },
      { id: 'stop',   label: 'Get frustrated and stop reading', sub: 'It kills the mood entirely' },
    ],
  },
  { type: 'mirror', id: 'mirror1' },
  {
    type: 'question', id: 'frequency', label: 'THE REAL COST',
    question: 'How often does this slow you down in a single reading session?',
    subtext: 'Think about the last time you tried to read something in Japanese.',
    multiSelect: false,
    options: [
      { id: 'constant',   label: 'Constantly — every few minutes',  sub: 'Reading feels like an obstacle course' },
      { id: 'frequent',   label: 'Several times per session',        sub: 'Enough to seriously break focus' },
      { id: 'occasional', label: 'Occasionally',                     sub: "But when it happens, it kills the momentum" },
      { id: 'stopped',    label: "I've mostly given up trying",      sub: "The frustration isn't worth it anymore" },
    ],
  },
  {
    type: 'question', id: 'cost', label: "WHAT IT'S COSTING YOU",
    question: "Be honest — what has this cost you?",
    subtext: 'Select the one that hits closest to home.',
    multiSelect: false,
    options: [
      { id: 'progress',   label: "I study hard but can't read real content", sub: 'All that effort, still blocked' },
      { id: 'enjoyment',  label: "I can't enjoy the things I love",          sub: 'Anime, manga, novels — all harder than they should be' },
      { id: 'stuck',      label: "I feel stuck at the same level",           sub: "No matter what I do, I don't seem to improve" },
      { id: 'quit',       label: "I've almost given up on my goals",         sub: 'The gap feels too big to close' },
    ],
  },
  {
    type: 'question', id: 'commitment', label: 'YOUR INTENTION',
    question: 'How seriously do you want to fix this?',
    subtext: "We're about to show you exactly how.",
    multiSelect: false,
    options: [
      { id: 'serious',   label: "Very seriously — I'm done being stuck",      sub: 'Ready to make a real change' },
      { id: 'pretty',    label: 'Pretty seriously — I just need the right tool', sub: 'The effort is there, just not the solution yet' },
      { id: 'exploring', label: 'Just exploring for now',                     sub: 'Curious to see what this can do' },
    ],
  },
  { type: 'mirror', id: 'mirror2' },
  // ─ ACT 2: THE DEMO ───────────────────────────────────────────────────────
  { type: 'demo-intro',    id: 'demo-intro' },
  { type: 'demo-live',     id: 'demo-live' },
  { type: 'demo-reaction', id: 'demo-reaction' },
  // ─ ACT 3: THE CLOSE ──────────────────────────────────────────────────────
  { type: 'social',  id: 'social' },
  { type: 'vision',  id: 'vision' },
  { type: 'plan',    id: 'plan' },
  {
    type: 'question', id: 'final-commitment', label: 'ONE LAST THING',
    question: 'How committed are you to making this happen?',
    subtext: "Your plan is ready — this is the last step.",
    multiSelect: false,
    options: [
      { id: 'allin',     label: "All in — let's do this",              sub: "I'm starting today" },
      { id: 'ready',     label: "I'm ready to give this a real shot",  sub: 'Committed and motivated' },
      { id: 'maybe',     label: 'I want to think about it first',      sub: 'Just exploring' },
    ],
  },
];

// ── Star icon ─────────────────────────────────────────────────────────────────
function StarIcon({ filled }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="star-icon">
      <path
        d="M20 4l4.5 9.1 10 1.5-7.3 7.1 1.7 10-8.9-4.7-8.9 4.7 1.7-10L5.5 14.6l10-1.5z"
        fill={filled ? '#f59e0b' : 'none'}
        stroke={filled ? '#f59e0b' : '#d1d5db'}
        strokeWidth="2" strokeLinejoin="round"
      />
    </svg>
  );
}

// ── Demo word popup (no API calls — hardcoded meanings) ───────────────────────
function DemoWordPopup({ token, onClose }) {
  if (!token) return null;
  const key  = token.basic_form && token.basic_form !== '*' ? token.basic_form : token.surface_form;
  const data = DEMO_MEANINGS[key] || DEMO_MEANINGS[token.surface_form];
  if (!data) return null;

  return (
    <div className="demo-word-popup-backdrop" onClick={onClose}>
      <div className="demo-word-popup" onClick={e => e.stopPropagation()}>
        <button className="demo-word-popup-close" onClick={onClose}>✕</button>
        <div className="demo-word-popup-word">{token.surface_form}</div>
        <div className="demo-word-popup-reading">{data.reading}</div>
        <div className="demo-word-popup-meaning">{data.meaning}</div>
        <div className="demo-word-popup-hint">
          This is what UnBlur shows you — instantly, on every tap.
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
const OnboardingScreen = forwardRef(function OnboardingScreen({ onDone }, ref) {
  const [phase, setPhase]           = useState('welcome');
  const [welcomeIdx, setWelcomeIdx] = useState(0);
  const [screenIdx, setScreenIdx]   = useState(0);
  const [answers, setAnswers]       = useState({});
  // Demo state
  const [demoPhase, setDemoPhase]   = useState('book');  // 'book' | 'scanning' | 'result'
  const [demoToken, setDemoToken]   = useState(null);
  const [demoTapped, setDemoTapped] = useState(false);
  // Demo reaction
  const [reaction, setReaction]     = useState(null);
  const [rating, setRating]         = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  // Plan generation
  const [planStep, setPlanStep]     = useState(0);
  const touchStartX = useRef(null);

  useImperativeHandle(ref, () => ({
    prev: () => {
      if (phase === 'welcome') setWelcomeIdx(i => Math.max(0, i - 1));
      else setScreenIdx(i => Math.max(0, i - 1));
    },
    next: () => {
      if (phase === 'welcome') welcomeNext();
      else next();
    },
    goTo: (idx) => {
      setPhase('immersion');
      setScreenIdx(Math.max(0, Math.min(idx, SCREENS.length - 1)));
    },
    getInfo: () => ({ phase, screenIdx, welcomeIdx, total: SCREENS.length, totalWelcome: WELCOME_SLIDES.length }),
  }));

  const totalScreens = SCREENS.length;
  const progress     = ((screenIdx + 1) / totalScreens) * 100;

  // ── Welcome nav ─────────────────────────────────────────────────────────────
  function welcomeNext() {
    if (welcomeIdx < WELCOME_SLIDES.length - 1) setWelcomeIdx(i => i + 1);
    else setPhase('immersion');
  }
  function handleTouchStart(e) { touchStartX.current = e.touches[0].clientX; }
  function handleTouchEnd(e) {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (delta < -50) welcomeNext();
    if (delta > 50 && welcomeIdx > 0) setWelcomeIdx(i => i - 1);
  }

  // ── Immersion nav ────────────────────────────────────────────────────────────
  function next() {
    if (screenIdx < SCREENS.length - 1) setScreenIdx(i => i + 1);
    else onDone();
  }

  function toggleAnswer(screenId, optId, multiSelect) {
    if (multiSelect) {
      setAnswers(a => {
        const cur = a[screenId] || [];
        return { ...a, [screenId]: cur.includes(optId) ? cur.filter(x => x !== optId) : [...cur, optId] };
      });
    } else {
      setAnswers(a => ({ ...a, [screenId]: optId }));
    }
  }

  function canContinue(screen) {
    if (!screen || screen.type !== 'question') return true;
    if (screen.multiSelect) return (answers[screen.id] || []).length > 0;
    return !!answers[screen.id];
  }

  // ── Demo handlers ────────────────────────────────────────────────────────────
  function handleScanDemo() {
    setDemoPhase('scanning');
    setTimeout(() => setDemoPhase('result'), 1800);
  }

  function handleDemoWordClick(token) {
    const key  = token.basic_form && token.basic_form !== '*' ? token.basic_form : token.surface_form;
    const data = DEMO_MEANINGS[key] || DEMO_MEANINGS[token.surface_form];
    if (!data) return;
    setDemoToken(token);
    setDemoTapped(true);
  }

  // ── Plan animation ────────────────────────────────────────────────────────────
  useEffect(() => {
    const screen = SCREENS[screenIdx];
    if (!screen || screen.type !== 'plan') return;
    setPlanStep(0);
    const items = getPlanItems(answers);
    const timers = items.map((_, i) =>
      setTimeout(() => setPlanStep(s => Math.max(s, i + 1)), 600 + i * 700)
    );
    return () => timers.forEach(clearTimeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screenIdx]);

  // ── Render: welcome ──────────────────────────────────────────────────────────
  if (phase === 'welcome') {
    return (
      <div className="onboarding" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        <div className="onboarding-slides">
          <div className="onboarding-track" style={{ transform: `translateX(-${welcomeIdx * 100}%)` }}>
            {WELCOME_SLIDES.map(s => (
              <div className="onboarding-slide" key={s.id}>
                <div className="onboarding-welcome-header">
                  <span className="onboarding-welcome-eyebrow">Welcome to</span>
                  <div className="onboarding-welcome-wordmark">Un<em>blur</em></div>
                </div>
                <div className="onboarding-illus">{s.illustration}</div>
                <h2 className="onboarding-headline">{s.headline}</h2>
                <p className="onboarding-body">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="onboarding-dots">
          {WELCOME_SLIDES.map((_, i) => (
            <button key={i} className={`onboarding-dot${i === welcomeIdx ? ' active' : ''}`} onClick={() => setWelcomeIdx(i)} />
          ))}
        </div>
        <div className="onboarding-actions">
          <button className="onboarding-next-btn" onClick={welcomeNext}>
            {welcomeIdx < WELCOME_SLIDES.length - 1 ? 'Next' : "Let's go →"}
          </button>
        </div>
      </div>
    );
  }

  // ── Render: immersion ────────────────────────────────────────────────────────
  const screen = SCREENS[screenIdx];

  // ── Mirror screen ────────────────────────────────────────────────────────────
  if (screen.type === 'mirror') {
    if (screen.id === 'mirror1') {
      const { ctxText, frText } = getMirror1(answers);
      return (
        <div className="onboarding">
          <div className="immersion-progress-bar-track">
            <div className="immersion-progress-bar-fill" style={{ width: `${progress}%` }} />
          </div>
          <div className="immersion-content mirror-screen">
            <span className="onboarding-phase-label">WE HEAR YOU</span>
            <div className="mirror-quote-block">
              <p className="mirror-quote-text">
                You want to read <strong>{ctxText}</strong> — but every unknown kanji means <strong>{frText}</strong>.
              </p>
              <p className="mirror-quote-text" style={{ marginTop: 16 }}>
                That's not a <em>you</em> problem. That's a tooling problem.
              </p>
            </div>
            <div className="mirror-accent-line">That stops today.</div>
          </div>
          <div className="onboarding-actions">
            <button className="onboarding-next-btn" onClick={next}>That's exactly it →</button>
          </div>
        </div>
      );
    }

    if (screen.id === 'mirror2') {
      const { freq, commit } = getMirror2(answers);
      return (
        <div className="onboarding">
          <div className="immersion-progress-bar-track">
            <div className="immersion-progress-bar-fill" style={{ width: `${progress}%` }} />
          </div>
          <div className="immersion-content mirror-screen">
            <span className="onboarding-phase-label">YOU'RE IN THE RIGHT PLACE</span>
            <div className="mirror-quote-block">
              <p className="mirror-quote-text">
                You've been <strong>{freq}</strong> — and <strong>{commit}</strong>.
              </p>
              <p className="mirror-quote-text" style={{ marginTop: 16 }}>
                Here's what we built for you.
              </p>
              <p className="mirror-quote-text mirror-quote-emphasis">
                Let's try it right now — before anything else.
              </p>
            </div>
          </div>
          <div className="onboarding-actions">
            <button className="onboarding-next-btn" onClick={next}>Show me →</button>
          </div>
        </div>
      );
    }
  }

  // ── Demo intro ────────────────────────────────────────────────────────────────
  if (screen.type === 'demo-intro') {
    return (
      <div className="onboarding">
        <div className="immersion-progress-bar-track">
          <div className="immersion-progress-bar-fill" style={{ width: `${progress}%` }} />
        </div>
        <div className="immersion-content demo-intro-content">
          <span className="onboarding-phase-label">TRY IT NOW</span>
          <h2 className="onboarding-headline immersion-headline">No tutorial. No walkthrough.</h2>
          <p className="onboarding-body immersion-subtext">
            Below is the opening of <em>Snow Country</em> by Kawabata Yasunari — one of Japan's greatest novels. Scan it and see what UnBlur does.
          </p>
          <div className="demo-book-preview">
            <div className="demo-book-page">
              <div className="demo-book-meta">川端康成 — 雪国</div>
              <div className="demo-book-text">
                国境の長いトンネルを抜けると雪国であった。夜の底が白くなった。信号所に汽車が止まった。
              </div>
            </div>
          </div>
        </div>
        <div className="onboarding-actions">
          <button className="onboarding-next-btn" onClick={next}>Scan this page →</button>
        </div>
      </div>
    );
  }

  // ── Demo live ─────────────────────────────────────────────────────────────────
  if (screen.type === 'demo-live') {
    return (
      <div className="onboarding">
        <div className="immersion-progress-bar-track">
          <div className="immersion-progress-bar-fill" style={{ width: `${progress}%` }} />
        </div>

        {demoPhase === 'book' && (
          <>
            <div className="immersion-content demo-live-content">
              <span className="onboarding-phase-label">YOUR SCAN</span>
              <div className="demo-book-preview demo-book-preview-live">
                <div className="demo-book-page">
                  <div className="demo-book-meta">川端康成 — 雪国</div>
                  <div className="demo-book-text">
                    国境の長いトンネルを抜けると雪国であった。夜の底が白くなった。信号所に汽車が止まった。
                  </div>
                </div>
              </div>
            </div>
            <div className="onboarding-actions">
              <button className="onboarding-next-btn" onClick={handleScanDemo}>
                Scan →
              </button>
            </div>
          </>
        )}

        {demoPhase === 'scanning' && (
          <div className="demo-scanning-screen">
            <div className="demo-scanning-book">
              <div className="demo-book-page demo-book-page-scanning">
                <div className="demo-book-meta">川端康成 — 雪国</div>
                <div className="demo-book-text">
                  国境の長いトンネルを抜けると雪国であった。夜の底が白くなった。信号所に汽車が止まった。
                </div>
                <div className="demo-scan-line" />
              </div>
            </div>
            <p className="demo-scanning-label">Reading…</p>
          </div>
        )}

        {demoPhase === 'result' && (
          <>
            <div className="immersion-content demo-result-content">
              <span className="onboarding-phase-label">RESULT</span>
              {!demoTapped && (
                <p className="demo-tap-hint">Tap any word below ↓</p>
              )}
              <div className="demo-result-display">
                <TextDisplay
                  tokenBlocks={DEMO_BLOCKS}
                  onWordClick={handleDemoWordClick}
                  showFurigana={true}
                  showTranslations={true}
                />
              </div>
              <p className="demo-source-credit">— 雪国, 川端康成 (1935, public domain)</p>
            </div>
            <div className="onboarding-actions">
              <button className="onboarding-next-btn" onClick={next}>
                {demoTapped ? 'Amazing. Continue →' : 'Continue →'}
              </button>
            </div>
            <DemoWordPopup token={demoToken} onClose={() => setDemoToken(null)} />
          </>
        )}
      </div>
    );
  }

  // ── Demo reaction ─────────────────────────────────────────────────────────────
  if (screen.type === 'demo-reaction') {
    return (
      <div className="onboarding">
        <div className="immersion-progress-bar-track">
          <div className="immersion-progress-bar-fill" style={{ width: `${progress}%` }} />
        </div>
        <div className="immersion-content">
          <span className="onboarding-phase-label">FIRST IMPRESSION</span>
          <h2 className="onboarding-headline immersion-headline">How was that?</h2>

          <div className="reaction-options">
            {[
              { id: 'amazing',       label: 'That was incredible' },
              { id: 'useful',        label: 'More useful than I expected' },
              { id: 'surprised',     label: "I didn't think it'd work this well" },
              { id: 'moretoexplore', label: 'I want to explore more' },
            ].map(r => (
              <button
                key={r.id}
                className={`reaction-option${reaction === r.id ? ' selected' : ''}`}
                onClick={() => setReaction(r.id)}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
        <div className="onboarding-actions">
          <button
            className={`onboarding-next-btn${!reaction ? ' disabled' : ''}`}
            onClick={reaction ? next : undefined}
            disabled={!reaction}
          >
            Continue →
          </button>
        </div>
      </div>
    );
  }

  // ── Social proof ──────────────────────────────────────────────────────────────
  if (screen.type === 'social') {
    const ctxArr      = answers.context || [];
    const primary     = ctxArr[0];
    const reviews     = (primary && TESTIMONIALS[primary]) || DEFAULT_TESTIMONIALS;
    const displayRating = hoverRating || rating;
    return (
      <div className="onboarding">
        <div className="immersion-progress-bar-track">
          <div className="immersion-progress-bar-fill" style={{ width: `${progress}%` }} />
        </div>
        <div className="immersion-content">
          <span className="onboarding-phase-label">YOU'RE NOT ALONE</span>
          <div className="rating-ask">
            <h3 className="rating-ask-heading">If you're enjoying it, leave us a rating</h3>
            <div className="rating-stars" onMouseLeave={() => setHoverRating(0)}>
              {[1,2,3,4,5].map(n => (
                <button
                  key={n}
                  className="rating-star-btn"
                  onClick={() => {
                    setRating(n);
                    if (n >= 4 && Capacitor.isNativePlatform()) {
                      InAppReview.requestReview();
                    }
                  }}
                  onMouseEnter={() => setHoverRating(n)}
                  aria-label={`${n} star`}
                >
                  <StarIcon filled={n <= displayRating} />
                </button>
              ))}
            </div>
          </div>
          <h2 className="onboarding-headline immersion-headline" style={{ marginTop: 28 }}>
            50,000+ learners stopped struggling.
          </h2>
          <p className="onboarding-body immersion-subtext">People who were exactly where you are now.</p>
          {reviews.map((r, i) => (
            <div className="review-card" key={i} style={{ marginTop: i === 0 ? 16 : 10 }}>
              <div className="review-avatar" style={{ background: r.color }}>{r.initial}</div>
              <div className="review-content">
                <div className="review-name">{r.name} <span className="review-location">— {r.location}</span></div>
                <div className="review-stars">{'★'.repeat(5)}</div>
                <p className="review-quote">"{r.quote}"</p>
              </div>
            </div>
          ))}
        </div>
        <div className="onboarding-actions">
          <button
            className={`onboarding-next-btn${!rating ? ' disabled' : ''}`}
            onClick={rating ? next : undefined}
            disabled={!rating}
          >
            {rating >= 4 ? "Let's go →" : rating > 0 ? 'Continue →' : 'Continue →'}
          </button>
        </div>
      </div>
    );
  }

  // ── Vision screen ─────────────────────────────────────────────────────────────
  if (screen.type === 'vision') {
    const target = getVisionText(answers);
    return (
      <div className="onboarding">
        <div className="immersion-progress-bar-track">
          <div className="immersion-progress-bar-fill" style={{ width: `${progress}%` }} />
        </div>
        <div className="immersion-content mirror-screen">
          <span className="onboarding-phase-label">YOUR NEW NORMAL</span>
          <div className="mirror-quote-block">
            <p className="mirror-quote-text">
              Imagine this time next week.
            </p>
            <p className="mirror-quote-text" style={{ marginTop: 16 }}>
              You're reading <strong>{target}</strong>. A kanji appears you don't know. You tap it. The meaning, reading, and context appear instantly.
            </p>
            <p className="mirror-quote-text" style={{ marginTop: 16 }}>
              You never left the page. You never broke your flow.
            </p>
            <p className="mirror-quote-text mirror-quote-emphasis">
              That's what UnBlur does.
            </p>
          </div>
        </div>
        <div className="onboarding-actions">
          <button className="onboarding-next-btn" onClick={next}>That's what I want →</button>
        </div>
      </div>
    );
  }

  // ── Plan generation ───────────────────────────────────────────────────────────
  if (screen.type === 'plan') {
    const items    = getPlanItems(answers);
    const allDone  = planStep >= items.length;
    return (
      <div className="onboarding">
        <div className="immersion-progress-bar-track">
          <div className="immersion-progress-bar-fill" style={{ width: `${progress}%` }} />
        </div>
        <div className="immersion-content">
          <span className="onboarding-phase-label">YOUR READING PLAN</span>
          <h2 className="onboarding-headline immersion-headline">
            {allDone ? 'Your plan is ready.' : 'Building your personal plan…'}
          </h2>
          <div className="plan-items">
            {items.map((item, i) => (
              <div key={i} className={`plan-item${i < planStep ? ' done' : ''}`}>
                <div className="plan-item-check">
                  {i < planStep ? (
                    <svg viewBox="0 0 20 20" fill="none">
                      <circle cx="10" cy="10" r="9" fill="#4c6ef5" />
                      <polyline points="6,10 9,13 14,7" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <div className="plan-item-pending" />
                  )}
                </div>
                <div className="plan-item-text">
                  <span className="plan-item-label">{item.label}</span>
                  <span className="plan-item-value">{i < planStep ? item.value : '…'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="onboarding-actions">
          <button
            className={`onboarding-next-btn${!allDone ? ' disabled' : ''}`}
            onClick={allDone ? next : undefined}
            disabled={!allDone}
          >
            My plan is ready →
          </button>
        </div>
      </div>
    );
  }

  // ── Question screen ───────────────────────────────────────────────────────────
  const ans        = screen.multiSelect ? (answers[screen.id] || []) : answers[screen.id];
  const isSelected = (optId) => screen.multiSelect ? ans.includes(optId) : ans === optId;

  const FREQ_CALLOUT = { constant: '30+', frequent: '10–15', occasional: '5–10', stopped: 'too many' };

  return (
    <div className="onboarding">
      <div className="immersion-progress-bar-track">
        <div className="immersion-progress-bar-fill" style={{ width: `${progress}%` }} />
      </div>

      <div className="immersion-content">
        <span className="onboarding-phase-label">{screen.label}</span>
        <h2 className="onboarding-headline immersion-headline">{screen.question}</h2>
        <p className="onboarding-body immersion-subtext">{screen.subtext}</p>
        {screen.multiSelect && <p className="immersion-multiselect-hint">Select all that apply</p>}

        <div className="immersion-options">
          {screen.options.map(opt => (
            <button
              key={opt.id}
              className={`immersion-option${isSelected(opt.id) ? ' selected' : ''}${opt.platform ? ' platform-option' : ''}`}
              onClick={() => toggleAnswer(screen.id, opt.id, screen.multiSelect)}
            >
              {opt.platform && (
                <span className="immersion-platform-icon"><PlatformIcon id={opt.id} /></span>
              )}
              <span className="immersion-option-text">
                <span className="immersion-option-label">{opt.label}</span>
                <span className="immersion-option-sub">{opt.sub}</span>
              </span>
              {isSelected(opt.id) && (
                <svg className="immersion-check" viewBox="0 0 20 20" fill="none">
                  <circle cx="10" cy="10" r="9" fill="#4c6ef5" />
                  <polyline points="6,10 9,13 14,7" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          ))}
        </div>

        {screen.id === 'frequency' && answers.frequency && (
          <div className="frequency-callout">
            That's up to <strong>{FREQ_CALLOUT[answers.frequency]} interruptions</strong> per reading session.
            UnBlur eliminates every single one.
          </div>
        )}
      </div>

      <div className="onboarding-actions">
        <button
          className={`onboarding-next-btn${!canContinue(screen) ? ' disabled' : ''}`}
          onClick={canContinue(screen) ? next : undefined}
          disabled={!canContinue(screen)}
        >
          Continue
        </button>
      </div>
    </div>
  );
});

export default OnboardingScreen;
