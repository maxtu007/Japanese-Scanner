import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import Upload from './components/Upload';
import TextDisplay from './components/TextDisplay';
import WordModal from './components/WordModal';
import AddToDeckModal from './components/AddToDeckModal';
import FlashcardsTab from './components/FlashcardsTab';
import HistoryTab from './components/HistoryTab';
import AudioBar from './components/AudioBar';
import SplashScreen from './components/SplashScreen';
import OnboardingScreen from './components/OnboardingScreen';
import PaywallScreen from './components/PaywallScreen';
import AuthModal from './components/AuthModal';
import { useAuth } from './contexts/AuthContext';
import { cleanAndTranslate, preprocessOCRText } from './utils/claude';
import { reconstructLayout } from './utils/layoutReconstructor';
import { extractTextWithGoogle } from './utils/googleVision';
import { tokenizeSentence, hasJapanese } from './utils/japanese';
import { loadDecks } from './utils/supabaseDecks';
import { addScan } from './utils/supabaseHistory';
import { migrateLocalStorageToSupabase } from './utils/migrate';

async function generateThumbnail(objectURL) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const MAX = 110;
      const ratio = img.width / img.height;
      const [w, h] = ratio > 1
        ? [MAX, Math.round(MAX / ratio)]
        : [Math.round(MAX * ratio), MAX];
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.6));
    };
    img.onerror = () => resolve('');
    img.src = objectURL;
  });
}


export default function App() {
  const { user, signOut } = useAuth();

  const [showAuth, setShowAuth] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(
    () => !localStorage.getItem('unblur-onboarded')
  );
  const [showPaywall, setShowPaywall] = useState(
    () => !localStorage.getItem('unblur-paywall-seen')
  );
  const [paywallKey, setPaywallKey] = useState(0);

  const onboardingRef = useRef(null);

  const handleOnboardingDone = useCallback(() => {
    localStorage.setItem('unblur-onboarded', '1');
    setShowOnboarding(false);
  }, []);

  const handlePaywallDone = useCallback(() => {
    localStorage.setItem('unblur-paywall-seen', '1');
    setShowPaywall(false);
  }, []);

  const [phase, setPhase] = useState('upload'); // 'upload' | 'processing' | 'results'
  const [activeTab, setActiveTab] = useState('scan'); // 'scan' | 'history' | 'flashcards'
  const [status, setStatus] = useState('');
  const [imageSrc, setImageSrc] = useState(null);
  const [tokenBlocks, setTokenBlocks] = useState([]);
  const [selectedToken, setSelectedToken] = useState(null);
  const [showTranslations, setShowTranslations] = useState(false);
  const [showFurigana, setShowFurigana] = useState(true);
  const [error, setError] = useState(null);

  // Flashcard state
  const [decks, setDecks] = useState([]);
  const [pendingFlashcard, setPendingFlashcard] = useState(null);

  // Stable sentence strings for AudioBar
  const sentenceTexts = useMemo(
    () => tokenBlocks.flatMap(b => b.sentences.map(s => s.tokens.map(t => t.surface_form).join(''))),
    [tokenBlocks]
  );

  // Load decks and run migration once user is authenticated
  useEffect(() => {
    if (!user) return;
    (async () => {
      await migrateLocalStorageToSupabase();
      const decksData = await loadDecks();
      setDecks(decksData);
    })();
  }, [user]);

  async function handleFile(file) {
    const src = URL.createObjectURL(file);
    setImageSrc(src);
    setPhase('processing');
    setError(null);

    try {
      const t0 = performance.now();
      const ts = (label) => console.log(`[scan] ${label} +${(performance.now() - t0).toFixed(0)}ms`);

      setStatus('Running OCR…');
      let visionResult;
      try {
        visionResult = await extractTextWithGoogle(file);
        ts('google-vision done');
      } catch (visionErr) {
        console.error('[scan] Google Vision failed:', visionErr.message);
        throw new Error('Could not read this image. Please try a clearer photo.');
      }

      const rawBlocks = visionResult.blocks?.length > 0
        ? visionResult.blocks
        : [{ text: visionResult.fullText, boundingBox: null }];

      // Detect tategumi (vertical text): blocks taller than wide.
      // Vision already returns fullText in correct reading order for vertical Japanese,
      // so skip the manga-layout reconstructor and use fullText directly.
      const isVerticalLayout = (() => {
        const boxed = rawBlocks.filter(b => b.boundingBox?.vertices?.length >= 4);
        if (boxed.length < 3) return false;
        const tallCount = boxed.filter(b => {
          const xs = b.boundingBox.vertices.map(v => v.x ?? 0);
          const ys = b.boundingBox.vertices.map(v => v.y ?? 0);
          const w = Math.max(...xs) - Math.min(...xs);
          const h = Math.max(...ys) - Math.min(...ys);
          return h > w * 1.2;
        }).length;
        return tallCount / boxed.length > 0.5;
      })();

      // For vertical text, Vision sometimes places a short section marker / annotation
      // on its own line at the top of the fullText before the actual body text starts.
      // Strip these leading short lines (≤6 kana/kanji chars, no sentence-ending punct).
      const verticalFullText = visionResult.fullText.replace(
        /^([\u3040-\u30FF\u4E00-\u9FFF\uFF00-\uFFEF]{1,6})\n+/,
        (match, line) => /[。、！？…」』）]$/.test(line) ? match : ''
      );

      const regions = isVerticalLayout
        ? [{ text: verticalFullText }]
        : reconstructLayout(rawBlocks, visionResult.pageWidth, visionResult.pageHeight);
      const effectiveRegions = regions.length > 0 ? regions : [{ text: visionResult.fullText }];

      const cleanedRegions = effectiveRegions
        .map((r) => preprocessOCRText(r.text))
        .filter((t) => t.trim().length > 0 && hasJapanese(t));

      if (cleanedRegions.length === 0) {
        throw new Error('Could not extract readable text. Try a clearer image.');
      }

      // Join regions with double newline (paragraph separator), then collapse
      // any remaining single newlines — these are OCR line-break artifacts from
      // Vision splitting one continuous sentence across multiple detected lines.
      // Keeping them causes Claude to treat each physical line as a separate
      // sentence. Double newlines (real paragraph/block boundaries) are preserved.
      const rawCombined = cleanedRegions.join('\n\n')
        .replace(/([^\n])\n([^\n])/g, '$1$2');

      setStatus('Translating…');
      const { sentences: sentenceTexts, translations } = await cleanAndTranslate(rawCombined);
      ts('cleanAndTranslate done');

      setStatus('Processing text…');
      const pairedSentences = [];
      for (let i = 0; i < sentenceTexts.length; i++) {
        const tokens = await tokenizeSentence(sentenceTexts[i].replace(/\n+/g, ''));
        if (tokens.length > 0) {
          pairedSentences.push({ tokens, translation: translations[i] ?? '' });
        }
      }
      ts(`tokenizeLines done (${pairedSentences.length} sentences)`);

      setTokenBlocks(pairedSentences.length > 0 ? [{ sentences: pairedSentences }] : []);
      setShowTranslations(false);

      // Save to history (Supabase) — only when authenticated
      if (user) {
        try {
          const thumbnail = src ? await generateThumbnail(src) : '';
          const japanesePreview = pairedSentences
            .slice(0, 5)
            .map(s => s.tokens.map(t => t.surface_form).join(''))
            .join('');
          const titleText = japanesePreview.slice(0, 28) || '(Scan)';
          await addScan({
            name: titleText,
            thumbnail,
            japanese: japanesePreview,
            translation: pairedSentences[0]?.translation ?? '',
            tokenBlocks: pairedSentences.length > 0 ? [{ sentences: pairedSentences }] : [],
          });
        } catch (e) {
          console.error('[history] Failed to save scan:', e);
        }
      }

      setPhase('results');
    } catch (err) {
      setError(err.message || 'Processing failed. Please try again.');
      setPhase('upload');
    }
  }

  function handleScanAgain() {
    if (imageSrc) URL.revokeObjectURL(imageSrc);
    setImageSrc(null);
    setTokenBlocks([]);
    setShowTranslations(false);
    setSelectedToken(null);
    setPhase('upload');
  }

  function handleOpenScan(scan) {
    if (!scan.tokenBlocks?.length) {
      setError('This scan was saved before history was supported. Please scan again to save a reopenable version.');
      return;
    }
    setImageSrc(scan.thumbnail || null);
    setTokenBlocks(scan.tokenBlocks);
    setShowTranslations(false);
    setShowFurigana(true);
    setSelectedToken(null);
    setPhase('results');
  }

  function handleRequestAdd(cardData) {
    setSelectedToken(null);
    setPendingFlashcard(cardData);
  }

  async function handleCardAdded() {
    setPendingFlashcard(null);
    const fresh = await loadDecks();
    setDecks(fresh);
  }

  async function handleDecksChange() {
    const fresh = await loadDecks();
    setDecks(fresh);
  }

  const isAdded = selectedToken
    ? (() => {
        const t = selectedToken.token;
        const target = t.lookupTarget ?? (t.basic_form && t.basic_form !== '*' ? t.basic_form : t.surface_form);
        return decks.some(d => d.cards.some(c => c.word === target));
      })()
    : false;

  if (showSplash) {
    return <SplashScreen onDone={() => setShowSplash(false)} />;
  }

  if (showOnboarding) {
    return (
      <>
        <OnboardingScreen ref={onboardingRef} onDone={handleOnboardingDone} />
        {import.meta.env.DEV && (
          <DevPanel
            onboardingRef={onboardingRef}
            showOnboarding={true}
            showPaywall={false}
            onResetOnboarding={() => {}}
            onResetPaywall={() => {
              localStorage.removeItem('unblur-paywall-seen');
              setShowOnboarding(false);
              setShowPaywall(true);
              setPaywallKey(k => k + 1);
            }}
          />
        )}
      </>
    );
  }

  if (showPaywall) {
    return (
      <>
        <PaywallScreen key={paywallKey} onDone={handlePaywallDone} />
        {import.meta.env.DEV && (
          <DevPanel
            onboardingRef={null}
            showOnboarding={false}
            showPaywall={true}
            onResetOnboarding={() => {
              localStorage.removeItem('unblur-onboarded');
              localStorage.removeItem('unblur-paywall-seen');
              setShowPaywall(false);
              setShowOnboarding(true);
            }}
            onResetPaywall={() => setPaywallKey(k => k + 1)}
          />
        )}
      </>
    );
  }

  return (
    <div className="app">
      {phase !== 'upload' && (
        <header className="header">
          {phase === 'results' ? (
            <button className="header-back-btn" onClick={handleScanAgain} aria-label="Back">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </button>
          ) : (
            <div />
          )}
          <div className="wordmark-sm">Un<em>blur</em></div>
          <div />
        </header>
      )}

      <main>
        {phase === 'upload' && (
          <div className="home">
            <div className="home-content">
              {activeTab === 'scan' ? (
                <>
                  <div className="home-header">
                    <div className="wordmark">Un<em>blur</em></div>
                    <div className="tagline">Scan. Boom. Understand.</div>
                  </div>
                  <div className="home-illus">
                    <img src="/books.png" alt="" />
                  </div>
                  <Upload onFile={handleFile} />
                </>
              ) : activeTab === 'history' ? (
                <HistoryTab onOpenScan={handleOpenScan} />
              ) : activeTab === 'flashcards' ? (
                <FlashcardsTab
                  decks={decks}
                  onDecksChange={handleDecksChange}
                />
              ) : (
                <div className="account-tab">
                  {/* Premium hero */}
                  <div className="acct-hero">
                    <h1 className="acct-hero-heading">
                      Unblur<br/>
                      <span className="acct-hero-accent">Premium</span>
                      <svg className="acct-hero-star" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                    </h1>
                    <p className="acct-hero-sub">You're on Unblur Premium — enjoy everything Unblur has to offer.</p>
                    <div className="acct-hero-rule"/>
                    <div className="acct-feature-list">
                      <div className="acct-feature-row">
                        <svg className="acct-feature-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                        <span>Unlimited Scans</span>
                      </div>
                      <div className="acct-feature-row">
                        <svg className="acct-feature-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                        <span>Word Explanations</span>
                      </div>
                      <div className="acct-feature-row">
                        <svg className="acct-feature-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                        <span>Full Dictionary</span>
                      </div>
                      <div className="acct-feature-row">
                        <svg className="acct-feature-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                        <span>Scan History</span>
                      </div>
                      <div className="acct-feature-row">
                        <svg className="acct-feature-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                        <span>Flashcard Decks</span>
                      </div>
                      <div className="acct-feature-row">
                        <svg className="acct-feature-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                        <span>Accelerated Learning</span>
                      </div>
                    </div>
                  </div>

                  {/* Account & Sync */}
                  <p className="acct-section-label">ACCOUNT &amp; SYNC</p>
                  <div className="acct-group">
                    {user && (
                      <>
                        <div className="acct-row" style={{cursor:'default'}}>
                          <span className="acct-row-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                          </span>
                          <span className="acct-row-text" style={{color:'var(--text-secondary,#888)',fontSize:'0.85rem'}}>{user.email}</span>
                        </div>
                        <div className="acct-divider"/>
                      </>
                    )}
                    <button
                      className={`acct-row${user ? ' acct-row-danger' : ''}`}
                      onClick={user ? signOut : () => setShowAuth(true)}
                    >
                      <span className="acct-row-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                      </span>
                      <span className="acct-row-text">{user ? 'Sign Out' : 'Sign In / Sign Up'}</span>
                      <svg className="acct-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                    </button>
                  </div>

                  {/* Support */}
                  <p className="acct-section-label">SUPPORT</p>
                  <div className="acct-group">
                    <button className="acct-row">
                      <span className="acct-row-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17" strokeWidth="2.5" strokeLinecap="round"/></svg></span>
                      <span className="acct-row-text">FAQ</span>
                      <svg className="acct-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                    </button>
                    <div className="acct-divider"/>
                    <button className="acct-row">
                      <span className="acct-row-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg></span>
                      <span className="acct-row-text">Email Support</span>
                      <svg className="acct-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                    </button>
                    <div className="acct-divider"/>
                    <button className="acct-row">
                      <span className="acct-row-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.5"/></svg></span>
                      <span className="acct-row-text">Restore Purchase</span>
                      <svg className="acct-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                    </button>
                    <div className="acct-divider"/>
                    <button className="acct-row">
                      <span className="acct-row-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16" strokeWidth="2.5" strokeLinecap="round"/></svg></span>
                      <span className="acct-row-text">About Us</span>
                      <svg className="acct-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                    </button>
                    <div className="acct-divider"/>
                    <button className="acct-row">
                      <span className="acct-row-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></span>
                      <span className="acct-row-text">Privacy Policy</span>
                      <svg className="acct-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                    </button>
                  </div>

                  {/* Stay in Touch */}
                  <p className="acct-section-label">STAY IN TOUCH</p>
                  <div className="acct-group">
                    <button className="acct-row">
                      <span className="acct-row-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></span>
                      <span className="acct-row-text">Rate the App</span>
                      <svg className="acct-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                    </button>
                    <div className="acct-divider"/>
                    <button className="acct-row">
                      <span className="acct-row-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg></span>
                      <span className="acct-row-text">Share the App</span>
                      <svg className="acct-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                    </button>
                    <div className="acct-divider"/>
                    <button className="acct-row">
                      <span className="acct-row-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5" strokeWidth="2.5" strokeLinecap="round"/></svg></span>
                      <span className="acct-row-text">Follow Us</span>
                      <svg className="acct-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                    </button>
                  </div>
                </div>
              )}
            </div>

            <nav className="bottom-nav">
              <button
                className={`nav-item${activeTab === 'scan' ? ' active' : ''}`}
                onClick={() => setActiveTab('scan')}
              >
                <div className={`nav-icon-bg${activeTab === 'scan' ? ' active' : ''}`}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/>
                    <path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
                    <rect x="7" y="7" width="10" height="10" rx="1"/>
                  </svg>
                </div>
                <span>Scan</span>
              </button>
              <button
                className={`nav-item${activeTab === 'history' ? ' active' : ''}`}
                onClick={() => setActiveTab('history')}
              >
                <div className={`nav-icon-bg${activeTab === 'history' ? ' active' : ''}`}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/>
                  </svg>
                </div>
                <span>History</span>
              </button>
              <button
                className={`nav-item${activeTab === 'flashcards' ? ' active' : ''}`}
                onClick={() => setActiveTab('flashcards')}
              >
                <div className={`nav-icon-bg${activeTab === 'flashcards' ? ' active' : ''}`}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="3" width="9" height="13" rx="1.5"/><rect x="7" y="8" width="9" height="13" rx="1.5"/>
                  </svg>
                </div>
                <span>Flashcards</span>
              </button>
              <button
                className={`nav-item${activeTab === 'account' ? ' active' : ''}`}
                onClick={() => setActiveTab('account')}
              >
                <div className={`nav-icon-bg${activeTab === 'account' ? ' active' : ''}`}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
                  </svg>
                </div>
                <span>Account</span>
              </button>
            </nav>
          </div>
        )}

        {phase === 'processing' && (
          <div className="processing">
            {imageSrc && <img src={imageSrc} alt="" className="thumb" />}
            <div className="spinner" />
            <p className="processing-msg">{status}</p>
          </div>
        )}

        {phase === 'results' && (
          <div className="results">
            <TextDisplay
              tokenBlocks={tokenBlocks}
              onWordClick={(token, sentence) => setSelectedToken({ token, sentence })}
              showTranslations={showTranslations}
              showFurigana={showFurigana}
            />
          </div>
        )}
      </main>

      {error && (
        <div className="error-banner" role="alert">
          <span>{error}</span>
          <button onClick={() => setError(null)} aria-label="Dismiss">✕</button>
        </div>
      )}

      {selectedToken && (
        <WordModal
          token={selectedToken.token}
          sentence={selectedToken.sentence}
          onClose={() => setSelectedToken(null)}
          onRequestAdd={handleRequestAdd}
          isAdded={isAdded}
        />
      )}

      {showAuth && (
        <AuthModal onClose={() => setShowAuth(false)} />
      )}

      {pendingFlashcard && (
        <AddToDeckModal
          card={pendingFlashcard}
          decks={decks}
          onClose={() => setPendingFlashcard(null)}
          onAdded={handleCardAdded}
        />
      )}

      {phase === 'results' && (
        <div className="results-bottom-bar">
          <AudioBar sentences={sentenceTexts} />
          <div className="bottom-pills-row">
            <button
              className={`bar-pill${showTranslations ? ' active' : ''}`}
              onClick={() => setShowTranslations(v => !v)}
            >
              <span className="bar-pill-icon">文</span>
              Translation
            </button>
            <button
              className={`bar-pill${showFurigana ? ' active' : ''}`}
              onClick={() => setShowFurigana(v => !v)}
            >
              <span className="bar-pill-icon">ふ</span>
              Furigana
            </button>
          </div>
        </div>
      )}

      {import.meta.env.DEV && (
        <DevPanel
          onboardingRef={null}
          showOnboarding={false}
          showPaywall={false}
          onResetOnboarding={() => {
            localStorage.removeItem('unblur-onboarded');
            localStorage.removeItem('unblur-paywall-seen');
            setShowOnboarding(true);
            setShowPaywall(true);
            setPaywallKey(k => k + 1);
          }}
          onResetPaywall={() => {
            localStorage.removeItem('unblur-paywall-seen');
            setShowPaywall(true);
            setPaywallKey(k => k + 1);
          }}
        />
      )}
    </div>
  );
}

// ── Dev-only navigation panel ─────────────────────────────────────────────────
function DevPanel({ onboardingRef, showOnboarding, showPaywall, onResetOnboarding, onResetPaywall }) {
  const [open, setOpen] = useState(false);

  const s = {
    wrap: {
      position: 'fixed', bottom: 80, right: 12, zIndex: 9999,
      display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6,
    },
    toggle: {
      width: 36, height: 36, borderRadius: '50%', border: 'none',
      background: '#ff3b30', color: '#fff', fontSize: 16, cursor: 'pointer',
      boxShadow: '0 2px 8px rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    },
    panel: {
      background: 'rgba(0,0,0,0.85)', borderRadius: 10, padding: '8px 10px',
      display: 'flex', flexDirection: 'column', gap: 6, minWidth: 140,
    },
    label: { color: '#ff3b30', fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 },
    btn: {
      background: '#222', color: '#fff', border: '1px solid #444',
      borderRadius: 6, padding: '5px 8px', fontSize: 12, cursor: 'pointer', textAlign: 'left',
    },
    row: { display: 'flex', gap: 4 },
    navBtn: {
      flex: 1, background: '#222', color: '#fff', border: '1px solid #444',
      borderRadius: 6, padding: '5px 0', fontSize: 14, cursor: 'pointer', textAlign: 'center',
    },
  };

  return (
    <div style={s.wrap}>
      {open && (
        <div style={s.panel}>
          <div style={s.label}>DEV</div>

          {showOnboarding ? (
            <>
              <div style={s.row}>
                <button style={s.navBtn} onClick={() => onboardingRef?.current?.prev()}>◀</button>
                <button style={s.navBtn} onClick={() => onboardingRef?.current?.next()}>▶</button>
              </div>
              <button style={s.btn} onClick={() => onboardingRef?.current?.goTo(0)}>↩ Restart onboarding</button>
              <button style={s.btn} onClick={onResetPaywall}>⏭ Skip to paywall</button>
            </>
          ) : showPaywall ? (
            <>
              <button style={s.btn} onClick={onResetOnboarding}>↩ Go to onboarding</button>
              <button style={s.btn} onClick={onResetPaywall}>↩ Restart paywall</button>
            </>
          ) : (
            <>
              <button style={s.btn} onClick={onResetOnboarding}>↩ Go to onboarding</button>
              <button style={s.btn} onClick={onResetPaywall}>💳 Go to paywall</button>
            </>
          )}
        </div>
      )}
      <button style={s.toggle} onClick={() => setOpen(v => !v)}>
        {open ? '✕' : '⚙'}
      </button>
    </div>
  );
}
