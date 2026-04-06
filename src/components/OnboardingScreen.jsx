import { useState, useRef } from 'react';

// ── Welcome slides ────────────────────────────────────────────────────────────
const WELCOME_SLIDES = [
  {
    id: 'w1',
    illustration: (
      <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="20" y="38" width="80" height="54" rx="10" fill="#eef1fe" />
        <rect x="34" y="30" width="20" height="10" rx="4" fill="#c7d0fa" />
        <circle cx="60" cy="65" r="18" fill="#fff" stroke="#4c6ef5" strokeWidth="2.5" />
        <circle cx="60" cy="65" r="11" fill="#4c6ef5" opacity="0.15" />
        <circle cx="60" cy="65" r="6" fill="#4c6ef5" />
        <circle cx="88" cy="46" r="4" fill="#4c6ef5" opacity="0.5" />
      </svg>
    ),
    headline: 'Scan. Boom. Understand.',
    body: 'Point at any Japanese text, snap a photo, and get instant furigana and translation. No more tedious work.',
  },
  {
    id: 'w2',
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
    id: 'w3',
    illustration: (
      <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Page with text lines */}
        <rect x="22" y="20" width="76" height="80" rx="8" fill="#eef1fe" />
        {/* Text lines */}
        <rect x="32" y="34" width="44" height="6" rx="3" fill="#c7d0fa" />
        <rect x="32" y="46" width="56" height="6" rx="3" fill="#c7d0fa" />
        {/* Grammar pattern bracket — underline highlight */}
        <rect x="32" y="58" width="36" height="6" rx="3" fill="#4c6ef5" opacity="0.25" />
        <line x1="32" y1="66" x2="68" y2="66" stroke="#4c6ef5" strokeWidth="1.5" />
        <rect x="32" y="72" width="48" height="6" rx="3" fill="#c7d0fa" />
        {/* Explanation tag */}
        <rect x="54" y="54" width="38" height="18" rx="6" fill="#4c6ef5" />
        <rect x="58" y="59" width="22" height="3" rx="1.5" fill="#fff" opacity="0.9" />
        <rect x="58" y="64" width="16" height="3" rx="1.5" fill="#fff" opacity="0.6" />
        {/* Connector dot */}
        <circle cx="50" cy="61" r="2.5" fill="#4c6ef5" />
        <line x1="52" y1="61" x2="54" y2="61" stroke="#4c6ef5" strokeWidth="1.5" />
      </svg>
    ),
    headline: 'Get real clarity.',
    body: 'Tap any word or grammar pattern for a full explanation — meaning, context, and usage — so you actually understand what you read.',
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
    body: 'Save words from anything you scan. Review with spaced repetition and build vocabulary from content that matters.',
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

// ── Immersion screens ─────────────────────────────────────────────────────────
const SCREENS = [
  {
    type: 'question',
    id: 'source',
    label: 'WELCOME',
    question: 'Where did you hear about us?',
    subtext: "We're so glad you're here — let us know how you found UnBlur.",
    multiSelect: false,
    options: [
      { id: 'tiktok',   label: 'TikTok',         sub: 'Saw a video',           platform: true },
      { id: 'instagram',label: 'Instagram',       sub: 'Saw a post or reel',    platform: true },
      { id: 'youtube',  label: 'YouTube',         sub: 'Watched a video',       platform: true },
      { id: 'x',        label: 'X / Twitter',     sub: 'Saw a post',            platform: true },
      { id: 'friend',   label: 'A friend told me',sub: 'Word of mouth',         platform: true },
      { id: 'other',    label: 'Somewhere else',  sub: 'Google, App Store, etc',platform: true },
    ],
  },
  {
    type: 'question',
    id: 'frequency',
    label: 'YOUR HABITS',
    question: 'How often do you encounter Japanese?',
    subtext: "Whether it's every day or once in a while — UnBlur is ready when you are.",
    multiSelect: false,
    options: [
      { id: 'daily',    label: 'Every day',           sub: "It's part of my daily life" },
      { id: 'weekly',   label: 'A few times a week',  sub: 'Regularly but not daily' },
      { id: 'sometimes',label: 'Occasionally',        sub: 'When I watch, read, or travel' },
      { id: 'soon',     label: "I'm going to Japan",  sub: 'Preparing for a trip' },
    ],
  },
  {
    type: 'question',
    id: 'problems',
    label: 'YOUR STRUGGLES',
    question: 'What holds you back when reading Japanese?',
    subtext: "Select everything that feels familiar. No judgment — we've got you covered.",
    multiSelect: true,
    options: [
      { id: 'kanji',   label: "Kanji I can't read",            sub: 'Unknown characters block my reading' },
      { id: 'flow',    label: 'Losing my reading flow',         sub: 'Stopping to look things up breaks focus' },
      { id: 'vocab',   label: "Forgetting words I've learned",  sub: "Studied it, then it's gone" },
      { id: 'grammar', label: "Grammar I don't understand",     sub: "Patterns that don't make sense" },
    ],
  },
  {
    type: 'marketing',
    id: 'stat',
  },
  {
    type: 'question',
    id: 'goal',
    label: 'YOUR GOAL',
    question: "What's your main goal with Japanese?",
    subtext: "We'll make sure UnBlur is set up to get you there.",
    multiSelect: false,
    options: [
      { id: 'read',    label: 'Read without stopping',      sub: 'Flow through any text smoothly' },
      { id: 'vocab',   label: 'Build vocabulary faster',    sub: 'Learn words from real content' },
      { id: 'grammar', label: 'Understand grammar better',  sub: 'See patterns explained in context' },
      { id: 'basics',  label: 'Just get the basics',        sub: 'Communicate what I need' },
    ],
  },
  {
    type: 'rating',
    id: 'rate',
  },
];

// ── Star component ────────────────────────────────────────────────────────────
function StarIcon({ filled }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="star-icon">
      <path
        d="M20 4l4.5 9.1 10 1.5-7.3 7.1 1.7 10-8.9-4.7-8.9 4.7 1.7-10L5.5 14.6l10-1.5z"
        fill={filled ? '#f59e0b' : 'none'}
        stroke={filled ? '#f59e0b' : '#d1d5db'}
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function OnboardingScreen({ onDone }) {
  const [phase, setPhase]         = useState('welcome');
  const [welcomeIdx, setWelcomeIdx] = useState(0);
  const [screenIdx, setScreenIdx] = useState(0);
  const [answers, setAnswers]     = useState({});
  const [rating, setRating]       = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const touchStartX = useRef(null);

  const totalScreens = SCREENS.length;
  const progress = ((screenIdx + 1) / totalScreens) * 100;

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
    if (screen.type === 'marketing' || screen.type === 'rating') return true;
    if (screen.multiSelect) return (answers[screen.id] || []).length > 0;
    return !!answers[screen.id];
  }

  // ── Render: welcome ──────────────────────────────────────────────────────────
  if (phase === 'welcome') {
    return (
      <div className="onboarding" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        <button className="onboarding-skip" onClick={onDone}>Skip</button>

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
            {welcomeIdx < WELCOME_SLIDES.length - 1 ? 'Next' : 'Continue'}
          </button>
        </div>
      </div>
    );
  }

  // ── Render: immersion ────────────────────────────────────────────────────────
  const screen = SCREENS[screenIdx];
  const isLast = screenIdx === SCREENS.length - 1;

  // Marketing screen
  if (screen.type === 'marketing') {
    return (
      <div className="onboarding">
        <div className="immersion-progress-bar-track">
          <div className="immersion-progress-bar-fill" style={{ width: `${progress}%` }} />
        </div>
        <div className="immersion-content immersion-marketing">
          <span className="onboarding-phase-label">DID YOU KNOW</span>
          <div className="marketing-stat">2×</div>
          <h2 className="marketing-headline">Faster vocabulary growth</h2>
          <p className="marketing-body">
            UnBlur users build vocabulary <strong>twice as fast</strong> as traditional dictionary lookups — because you learn words in real context, from content you actually care about.
          </p>
          <div className="marketing-compare">
            <div className="marketing-compare-item bad">
              <span className="marketing-compare-label">Dictionary lookups</span>
              <div className="marketing-compare-bar">
                <div className="marketing-compare-fill" style={{ width: '40%', background: '#e5e7eb' }} />
              </div>
              <span className="marketing-compare-pct muted">Slow. Breaks focus.</span>
            </div>
            <div className="marketing-compare-item good">
              <span className="marketing-compare-label">UnBlur</span>
              <div className="marketing-compare-bar">
                <div className="marketing-compare-fill" style={{ width: '90%', background: '#4c6ef5' }} />
              </div>
              <span className="marketing-compare-pct accent">In context. Sticks.</span>
            </div>
          </div>
        </div>
        <div className="onboarding-actions">
          <button className="onboarding-next-btn" onClick={next}>That's what I want →</button>
        </div>
      </div>
    );
  }

  // Rating screen
  if (screen.type === 'rating') {
    const displayRating = hoverRating || rating;
    return (
      <div className="onboarding">
        <div className="immersion-progress-bar-track">
          <div className="immersion-progress-bar-fill" style={{ width: `${progress}%` }} />
        </div>
        <div className="immersion-content">
          <span className="onboarding-phase-label">LOVED BY LEARNERS</span>
          <h2 className="onboarding-headline immersion-headline">People are already reading more.</h2>

          <div className="review-card">
            <div className="review-avatar" style={{ background: '#4c6ef5' }}>S</div>
            <div className="review-content">
              <div className="review-name">Sarah K. <span className="review-location">— Tokyo</span></div>
              <div className="review-stars">{'★'.repeat(5)}</div>
              <p className="review-quote">"Finally I can read manga without stopping every 5 seconds. UnBlur completely changed how I study."</p>
            </div>
          </div>

          <div className="review-card" style={{ marginTop: 10 }}>
            <div className="review-avatar" style={{ background: '#0ea5e9' }}>M</div>
            <div className="review-content">
              <div className="review-name">Marcus T. <span className="review-location">— New York</span></div>
              <div className="review-stars">{'★'.repeat(5)}</div>
              <p className="review-quote">"Went from struggling through menus to reading signs confidently. Absolutely worth it."</p>
            </div>
          </div>

          <div className="rating-ask">
            <p className="rating-ask-text">How excited are you to start?</p>
            <div
              className="rating-stars"
              onMouseLeave={() => setHoverRating(0)}
            >
              {[1,2,3,4,5].map(n => (
                <button
                  key={n}
                  className="rating-star-btn"
                  onClick={() => setRating(n)}
                  onMouseEnter={() => setHoverRating(n)}
                  aria-label={`${n} star`}
                >
                  <StarIcon filled={n <= displayRating} />
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="onboarding-actions">
          <button className="onboarding-next-btn" onClick={onDone}>
            {rating >= 4 ? "Let's go! →" : "Start reading →"}
          </button>
          <button className="onboarding-signin-link" onClick={onDone}>Skip for now</button>
        </div>
      </div>
    );
  }

  // Question screen
  const ans = screen.multiSelect ? (answers[screen.id] || []) : answers[screen.id];
  const isSelected = (optId) => screen.multiSelect ? ans.includes(optId) : ans === optId;

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
      </div>

      <div className="onboarding-actions">
        <button
          className={`onboarding-next-btn${!canContinue(screen) ? ' disabled' : ''}`}
          onClick={canContinue(screen) ? next : undefined}
          disabled={!canContinue(screen)}
        >
          {isLast ? "Let's go →" : 'Continue'}
        </button>
        <button className="onboarding-signin-link" onClick={onDone}>Skip for now</button>
      </div>
    </div>
  );
}
