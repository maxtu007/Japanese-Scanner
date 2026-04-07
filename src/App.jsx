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
import { useAuth } from './contexts/AuthContext';
import { cleanAndTranslate, preprocessOCRText } from './utils/claude';
import { reconstructLayout } from './utils/layoutReconstructor';
import { extractTextWithGoogle } from './utils/googleVision';
import { tokenizeLines, tokenizeSentence, hasJapanese } from './utils/japanese';
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
  const { user, session, signOut } = useAuth();

  const [showSplash, setShowSplash] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(
    () => !localStorage.getItem('unblur-onboarded')
  );
  const [showPaywall, setShowPaywall] = useState(
    () => !localStorage.getItem('unblur-paywall-seen')
  );

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

      const regions = reconstructLayout(rawBlocks, visionResult.pageWidth, visionResult.pageHeight);
      const effectiveRegions = regions.length > 0 ? regions : [{ text: visionResult.fullText }];

      const cleanedRegions = effectiveRegions
        .map((r) => preprocessOCRText(r.text))
        .filter((t) => t.trim().length > 0 && hasJapanese(t));

      if (cleanedRegions.length === 0) {
        throw new Error('Could not extract readable text. Try a clearer image.');
      }

      const rawCombined = cleanedRegions.join('\n\n');

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

      // Save to history (Supabase)
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
        console.warn('[history] Failed to save scan:', e);
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
        {import.meta.env.DEV && <DevPanel onboardingRef={onboardingRef} showOnboarding={true} onResetOnboarding={() => {}} />}
      </>
    );
  }

  if (showPaywall) {
    return <PaywallScreen onDone={handlePaywallDone} />;
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
          <button className="signout-btn" onClick={signOut} title="Sign out" aria-label="Sign out">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:18,height:18}}>
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
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
              ) : (
                <FlashcardsTab
                  decks={decks}
                  onDecksChange={handleDecksChange}
                />
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
                className="nav-item"
                onClick={signOut}
                title="Sign out"
              >
                <div className="nav-icon-bg">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                    <polyline points="16 17 21 12 16 7"/>
                    <line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                </div>
                <span>Sign Out</span>
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
          onResetOnboarding={() => {
            localStorage.removeItem('unblur-onboarded');
            setShowOnboarding(true);
          }}
        />
      )}
    </div>
  );
}

// ── Dev-only navigation panel ─────────────────────────────────────────────────
function DevPanel({ onboardingRef, showOnboarding, onResetOnboarding }) {
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
            </>
          ) : (
            <button style={s.btn} onClick={onResetOnboarding}>↩ Go to onboarding</button>
          )}

          <button style={{ ...s.btn, color: '#aaa', cursor: 'not-allowed' }} disabled>
            Skip paywall (soon)
          </button>
        </div>
      )}
      <button style={s.toggle} onClick={() => setOpen(v => !v)}>
        {open ? '✕' : '⚙'}
      </button>
    </div>
  );
}
