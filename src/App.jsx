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
import { addScan, loadHistory } from './utils/supabaseHistory';
import { migrateLocalStorageToSupabase } from './utils/migrate';
import { initPurchases, checkEntitlement } from './utils/purchases';

async function generateThumbnail(file) {
  // Use FileReader to get a data URL from the File directly.
  // Drawing a blob URL onto canvas in WKWebView taints the canvas and
  // silently blocks toDataURL() — FileReader avoids this restriction.
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onerror = () => resolve('');
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => resolve('');
      img.onload = () => {
        const MAX = 400;
        const ratio = img.width / img.height;
        const [w, h] = ratio > 1
          ? [MAX, Math.round(MAX / ratio)]
          : [Math.round(MAX * ratio), MAX];
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}


export default function App() {
  const { user, signOut, deleteAccount } = useAuth();

  const [showAuth, setShowAuth] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Close auth modal when user becomes authenticated (e.g. after Google/Apple OAuth)
  useEffect(() => {
    if (user && showAuth) setShowAuth(false);
  }, [user, showAuth]);

  async function handleDeleteAccount() {
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      await deleteAccount();
      setShowDeleteConfirm(false);
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeleteLoading(false);
    }
  }
  const [showSplash, setShowSplash] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(
    () => !localStorage.getItem('unblur-onboarded')
  );
  const [showPaywall, setShowPaywall] = useState(
    () => false // DEV BYPASS — restore to: !localStorage.getItem('unblur-paywall-seen')
  );
  const [paywallKey, setPaywallKey] = useState(0);

  const onboardingRef = useRef(null);

  // Init RevenueCat and bypass paywall if already subscribed
  useEffect(() => {
    initPurchases().then(() =>
      checkEntitlement().then(hasPremium => {
        if (hasPremium) {
          localStorage.setItem('unblur-paywall-seen', '1');
          setShowPaywall(false);
        }
      })
    );
  }, []);

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
  const [showRomaji, setShowRomaji] = useState(false);
  const [error, setError] = useState(null);

  // Flashcard state
  const [decks, setDecks] = useState([]);
  const [pendingFlashcard, setPendingFlashcard] = useState(null);

  // History state — loaded once on login so the History tab renders instantly
  const [history, setHistory] = useState({ folders: [] });

  // Stable sentence strings for AudioBar
  const sentenceTexts = useMemo(
    () => tokenBlocks.flatMap(b => b.sentences.map(s => s.tokens.map(t => t.surface_form).join(''))),
    [tokenBlocks]
  );

  // Load decks + history once user is authenticated (or on dev without auth)
  useEffect(() => {
    if (!user && !import.meta.env.DEV) return;
    (async () => {
      if (user) await migrateLocalStorageToSupabase();
      const [decksData, historyData] = await Promise.all([
        user ? loadDecks() : Promise.resolve([]),
        loadHistory(),
      ]);
      setDecks(decksData);
      setHistory(historyData);
    })();
  }, [user]);

  async function handleFile(file) {
    const src = URL.createObjectURL(file);
    setImageSrc(src);
    setPhase('processing');
    setError(null);

    // Safety timeout — never hang forever on iOS
    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      setError('Scan timed out. Please try again.');
      setPhase('upload');
    }, 60000);

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

      const regions = isVerticalLayout
        ? [{ text: visionResult.fullText }]
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

      // Save to history
      try {
        const thumbnail = await generateThumbnail(file);
        const japanesePreview = pairedSentences
          .slice(0, 5)
          .map(s => s.tokens.map(t => t.surface_form).join(''))
          .join('');
        const titleText = japanesePreview.slice(0, 28) || '(Scan)';
        if (user) {
          // Authenticated: persist to Supabase
          const updatedHistory = await addScan({
            name: titleText,
            thumbnail,
            japanese: japanesePreview,
            translation: pairedSentences[0]?.translation ?? '',
            tokenBlocks: pairedSentences.length > 0 ? [{ sentences: pairedSentences }] : [],
          });
          if (updatedHistory) setHistory(updatedHistory);
        } else if (import.meta.env.DEV) {
          // DEV without auth: store scan in local state only (no Supabase)
          const devScan = {
            id: crypto.randomUUID(),
            name: titleText,
            thumbnail,
            japanese: japanesePreview,
            translation: pairedSentences[0]?.translation ?? '',
            tokenBlocks: pairedSentences.length > 0 ? [{ sentences: pairedSentences }] : [],
            createdAt: new Date().toISOString(),
            folderId: 'dev',
          };
          setHistory(prev => {
            const devFolder = prev.folders.find(f => f.id === 'dev') ?? {
              id: 'dev', name: 'Default Folder', isDefault: true, scans: [],
            };
            const updatedFolder = { ...devFolder, scans: [devScan, ...devFolder.scans] };
            const otherFolders = prev.folders.filter(f => f.id !== 'dev');
            return { folders: [updatedFolder, ...otherFolders] };
          });
        }
      } catch (e) {
        console.error('[history] Failed to save scan:', e);
      }

      if (!timedOut) setPhase('results');
    } catch (err) {
      if (!timedOut) {
        setError(err.message || 'Processing failed. Please try again.');
        setPhase('upload');
      }
    } finally {
      clearTimeout(timeoutId);
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
                <HistoryTab history={history} onHistoryChange={setHistory} onOpenScan={handleOpenScan} />
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
                      onClick={user ? () => setShowSignOutConfirm(true) : () => setShowAuth(true)}
                    >
                      <span className="acct-row-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                      </span>
                      <span className="acct-row-text">{user ? 'Sign Out' : 'Sign In / Sign Up'}</span>
                      <svg className="acct-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                    </button>
                    {user && (
                      <>
                        <div className="acct-divider"/>
                        <button className="acct-row acct-row-danger" onClick={() => { setDeleteError(null); setShowDeleteConfirm(true); }}>
                          <span className="acct-row-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                          </span>
                          <span className="acct-row-text">Delete Account</span>
                          <svg className="acct-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                        </button>
                      </>
                    )}
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
                    <button className="acct-row" onClick={() => setShowAbout(true)}>
                      <span className="acct-row-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16" strokeWidth="2.5" strokeLinecap="round"/></svg></span>
                      <span className="acct-row-text">About</span>
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
              showRomaji={showRomaji}
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

      {/* About modal */}
      {showAbout && (
        <div className="confirm-overlay" onClick={() => setShowAbout(false)}>
          <div className="confirm-sheet" onClick={e => e.stopPropagation()}>
            <div className="wordmark" style={{textAlign:'center',fontSize:'28px',marginBottom:'2px'}}>Un<em>blur</em></div>
            <p style={{textAlign:'center',fontSize:'12px',color:'var(--muted)',margin:'0 0 16px'}}>Version 1.0.0</p>
            <p style={{fontSize:'13px',color:'var(--muted)',lineHeight:'1.6',margin:'0 0 20px',textAlign:'center'}}>
              Unblur uses AI to help you read Japanese — OCR by Google Cloud Vision, translations by Claude (Anthropic), and word explanations by Gemini (Google). AI results may not always be accurate.
            </p>
            <button className="confirm-btn confirm-btn-cancel" onClick={() => setShowAbout(false)}>Close</button>
          </div>
        </div>
      )}

      {/* Sign Out confirmation */}
      {showSignOutConfirm && (
        <div className="confirm-overlay" onClick={() => setShowSignOutConfirm(false)}>
          <div className="confirm-sheet" onClick={e => e.stopPropagation()}>
            <p className="confirm-title">Sign Out</p>
            <p className="confirm-msg">Are you sure you want to sign out?</p>
            <div className="confirm-actions">
              <button className="confirm-btn confirm-btn-cancel" onClick={() => setShowSignOutConfirm(false)}>Cancel</button>
              <button className="confirm-btn confirm-btn-danger" onClick={() => { signOut(); setShowSignOutConfirm(false); }}>Sign Out</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Account confirmation */}
      {showDeleteConfirm && (
        <div className="confirm-overlay" onClick={() => !deleteLoading && setShowDeleteConfirm(false)}>
          <div className="confirm-sheet" onClick={e => e.stopPropagation()}>
            <p className="confirm-title">Delete Account</p>
            <p className="confirm-msg">This will permanently delete your account and all saved words, decks, and scan history. This cannot be undone.</p>
            {deleteError && <p className="confirm-error">{deleteError}</p>}
            <div className="confirm-actions">
              <button className="confirm-btn confirm-btn-cancel" onClick={() => setShowDeleteConfirm(false)} disabled={deleteLoading}>Cancel</button>
              <button className="confirm-btn confirm-btn-danger" onClick={handleDeleteAccount} disabled={deleteLoading}>
                {deleteLoading ? 'Deleting…' : 'Delete Account'}
              </button>
            </div>
          </div>
        </div>
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
              onClick={() => { const next = !showFurigana; setShowFurigana(next); if (next) setShowRomaji(false); }}
            >
              <span className="bar-pill-icon">ふ</span>
              Furigana
            </button>
            <button
              className={`bar-pill${showRomaji ? ' active' : ''}`}
              onClick={() => { const next = !showRomaji; setShowRomaji(next); if (next) setShowFurigana(false); }}
            >
              <span className="bar-pill-icon">A</span>
              Romaji
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
