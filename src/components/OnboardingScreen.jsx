import { useState, useRef } from 'react';

// ── Welcome slides (feature overview) ────────────────────────────────────────
const WELCOME_SLIDES = [
  {
    id: 'w1',
    illustration: (
      <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="60" cy="60" r="28" fill="#eef1fe" />
        <text x="60" y="68" textAnchor="middle" fontSize="28" fontFamily="serif" fill="#4c6ef5">日</text>
        {[0,45,90,135,180,225,270,315].map((deg, i) => {
          const rad = (deg * Math.PI) / 180;
          return <line key={i}
            x1={60 + 34 * Math.cos(rad)} y1={60 + 34 * Math.sin(rad)}
            x2={60 + 48 * Math.cos(rad)} y2={60 + 48 * Math.sin(rad)}
            stroke="#4c6ef5" strokeWidth="2.5" strokeLinecap="round" opacity="0.4" />;
        })}
      </svg>
    ),
    headline: 'Japanese, anywhere you go.',
    body: 'The world around you — menus, signs, books, manga — finally readable.',
  },
  {
    id: 'w2',
    illustration: (
      <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="20" y="38" width="80" height="54" rx="10" fill="#eef1fe" />
        <rect x="34" y="30" width="20" height="10" rx="4" fill="#c7d0fa" />
        <circle cx="60" cy="65" r="18" fill="#fff" stroke="#4c6ef5" strokeWidth="2.5" />
        <circle cx="60" cy="65" r="11" fill="#4c6ef5" opacity="0.15" />
        <circle cx="60" cy="65" r="6" fill="#4c6ef5" />
        <line x1="44" y1="34" x2="76" y2="34" stroke="#4c6ef5" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
        <circle cx="88" cy="46" r="4" fill="#4c6ef5" opacity="0.5" />
      </svg>
    ),
    headline: 'Point. Snap. Read.',
    body: 'Take a photo of any Japanese text and see instant furigana and translation — no typing required.',
  },
  {
    id: 'w3',
    illustration: (
      <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="18" y="30" width="52" height="8" rx="4" fill="#e5e7eb" />
        <rect x="18" y="46" width="40" height="8" rx="4" fill="#e5e7eb" />
        <rect x="18" y="62" width="30" height="8" rx="4" fill="#4c6ef5" />
        <rect x="54" y="62" width="28" height="8" rx="4" fill="#e5e7eb" />
        <rect x="30" y="76" width="72" height="34" rx="8" fill="#fff" stroke="#4c6ef5" strokeWidth="1.5" />
        <rect x="38" y="83" width="32" height="5" rx="2.5" fill="#0f1b4d" opacity="0.8" />
        <rect x="38" y="93" width="50" height="4" rx="2" fill="#6b7280" opacity="0.5" />
        <rect x="38" y="101" width="40" height="4" rx="2" fill="#6b7280" opacity="0.3" />
        <circle cx="33" cy="66" r="5" fill="#4c6ef5" opacity="0.2" />
        <circle cx="33" cy="66" r="2.5" fill="#4c6ef5" />
      </svg>
    ),
    headline: 'Every word, on tap.',
    body: 'Tap any word to instantly see its meaning, reading, and dictionary form. No more leaving the app.',
  },
  {
    id: 'w4',
    illustration: (
      <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="28" y="48" width="64" height="44" rx="8" fill="#c7d0fa" />
        <rect x="22" y="42" width="64" height="44" rx="8" fill="#eef1fe" />
        <rect x="16" y="36" width="64" height="44" rx="8" fill="#fff" stroke="#4c6ef5" strokeWidth="1.5" />
        <text x="48" y="62" textAnchor="middle" fontSize="20" fontFamily="serif" fill="#4c6ef5">食</text>
        <rect x="26" y="68" width="44" height="4" rx="2" fill="#6b7280" opacity="0.3" />
        <rect x="30" y="74" width="36" height="4" rx="2" fill="#6b7280" opacity="0.2" />
        <circle cx="76" cy="34" r="11" fill="#4c6ef5" />
        <line x1="76" y1="28" x2="76" y2="40" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="70" y1="34" x2="82" y2="34" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    ),
    headline: 'Turn real life into lessons.',
    body: 'Save words from anything you scan. Review with spaced repetition and build vocabulary from content that actually matters.',
  },
];

// ── Immersion questions ───────────────────────────────────────────────────────
const QUESTIONS = [
  {
    id: 'q1',
    subLabel: 'A LITTLE ABOUT YOU',
    question: 'What brings you to UnBlur?',
    subtext: "Everyone finds their way to Japanese differently — we'd love to know yours.",
    options: [
      { id: 'travel',  emoji: '✈️', label: 'Traveling to Japan',    sub: 'Navigate menus, signs & more' },
      { id: 'media',   emoji: '🎌', label: 'Manga, anime & games',  sub: 'Read the content you love' },
      { id: 'living',  emoji: '🏙️', label: 'Living or working',     sub: 'Get by every single day' },
      { id: 'study',   emoji: '📚', label: 'Studying Japanese',     sub: 'Level up my reading fast' },
    ],
  },
  {
    id: 'q2',
    subLabel: 'YOUR GOALS',
    question: 'What do you most want to achieve?',
    subtext: "Knowing your goal helps UnBlur work better for you from day one.",
    options: [
      { id: 'read',    emoji: '👁️', label: 'Read without stopping',    sub: 'Flow through any text smoothly' },
      { id: 'vocab',   emoji: '🧠', label: 'Build vocabulary faster',   sub: 'Learn from real-world content' },
      { id: 'grammar', emoji: '🧩', label: 'Understand grammar',        sub: 'See patterns in context' },
      { id: 'basics',  emoji: '💬', label: 'Just get the basics',       sub: 'Communicate what I need' },
    ],
  },
  {
    id: 'q3',
    subLabel: 'YOUR LEVEL',
    question: 'Where are you in your journey?',
    subtext: "No matter where you start, UnBlur meets you exactly there.",
    options: [
      { id: 'beginner',     emoji: '🌱', label: 'Just starting out',     sub: "Still learning kana" },
      { id: 'kana',         emoji: '📖', label: 'Know kana, some kanji', sub: 'Building my foundation' },
      { id: 'intermediate', emoji: '🏗️', label: 'Intermediate',          sub: 'Can read but often get stuck' },
      { id: 'advanced',     emoji: '⭐', label: 'Advanced',               sub: 'Chasing full fluency' },
    ],
  },
];

export default function OnboardingScreen({ onDone }) {
  const [phase, setPhase]           = useState('welcome'); // 'welcome' | 'immersion'
  const [welcomeIdx, setWelcomeIdx] = useState(0);
  const [questionIdx, setQuestionIdx] = useState(0);
  const [answers, setAnswers]       = useState({});         // { q1: optionId, q2: ... }
  const touchStartX = useRef(null);

  // ── Welcome navigation ──────────────────────────────────────────────────────
  function welcomeNext() {
    if (welcomeIdx < WELCOME_SLIDES.length - 1) {
      setWelcomeIdx(i => i + 1);
    } else {
      setPhase('immersion');
    }
  }

  function handleTouchStart(e) {
    touchStartX.current = e.touches[0].clientX;
  }

  function handleTouchEnd(e) {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (delta < -50) welcomeNext();
    if (delta > 50 && welcomeIdx > 0) setWelcomeIdx(i => i - 1);
  }

  // ── Immersion navigation ────────────────────────────────────────────────────
  const currentQ  = QUESTIONS[questionIdx];
  const currentAnswer = answers[currentQ?.id];

  function immersionNext() {
    if (questionIdx < QUESTIONS.length - 1) {
      setQuestionIdx(i => i + 1);
    } else {
      onDone();
    }
  }

  // ── Render: welcome ─────────────────────────────────────────────────────────
  if (phase === 'welcome') {
    const slide = WELCOME_SLIDES[welcomeIdx];
    return (
      <div
        className="onboarding"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <button className="onboarding-skip" onClick={onDone}>Skip</button>

        <div className="onboarding-slides">
          <div
            className="onboarding-track"
            style={{ transform: `translateX(-${welcomeIdx * 100}%)` }}
          >
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
            <button
              key={i}
              className={`onboarding-dot${i === welcomeIdx ? ' active' : ''}`}
              onClick={() => setWelcomeIdx(i)}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>

        <div className="onboarding-actions">
          <button className="onboarding-next-btn" onClick={welcomeNext}>
            {welcomeIdx < WELCOME_SLIDES.length - 1 ? 'Next' : 'Continue'}
          </button>
        </div>
      </div>
    );
  }

  // ── Render: immersion ───────────────────────────────────────────────────────
  return (
    <div className="onboarding">
      <div className="immersion-progress">
        {QUESTIONS.map((_, i) => (
          <div
            key={i}
            className={`immersion-pip${i <= questionIdx ? ' done' : ''}`}
          />
        ))}
      </div>

      <div className="immersion-content">
        <span className="onboarding-phase-label">{currentQ.subLabel}</span>
        <h2 className="onboarding-headline immersion-headline">{currentQ.question}</h2>
        <p className="onboarding-body immersion-subtext">{currentQ.subtext}</p>

        <div className="immersion-options">
          {currentQ.options.map(opt => (
            <button
              key={opt.id}
              className={`immersion-option${currentAnswer === opt.id ? ' selected' : ''}`}
              onClick={() => setAnswers(a => ({ ...a, [currentQ.id]: opt.id }))}
            >
              <span className="immersion-option-emoji">{opt.emoji}</span>
              <span className="immersion-option-text">
                <span className="immersion-option-label">{opt.label}</span>
                <span className="immersion-option-sub">{opt.sub}</span>
              </span>
              {currentAnswer === opt.id && (
                <svg className="immersion-check" viewBox="0 0 20 20" fill="none">
                  <circle cx="10" cy="10" r="9" fill="#4c6ef5" />
                  <polyline points="6,10 9,13 14,7" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="onboarding-actions">
        <button
          className={`onboarding-next-btn${!currentAnswer ? ' disabled' : ''}`}
          onClick={currentAnswer ? immersionNext : undefined}
          disabled={!currentAnswer}
        >
          {questionIdx < QUESTIONS.length - 1 ? 'Continue' : "Let's go →"}
        </button>
        <button className="onboarding-signin-link" onClick={onDone}>Skip for now</button>
      </div>
    </div>
  );
}
