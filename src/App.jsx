import { useState, useMemo } from 'react';
import Upload from './components/Upload';
import TextDisplay from './components/TextDisplay';
import WordModal from './components/WordModal';
import AddToDeckModal from './components/AddToDeckModal';
import FlashcardsTab from './components/FlashcardsTab';
import HistoryTab from './components/HistoryTab';
import AudioBar from './components/AudioBar';
import { cleanAndTranslate, preprocessOCRText } from './utils/claude';
import { reconstructLayout } from './utils/layoutReconstructor';
import { extractTextWithGoogle } from './utils/googleVision';
import { tokenizeLines, hasJapanese } from './utils/japanese';
import { loadDecks } from './utils/deckStorage';
import { addScan } from './utils/historyStorage';

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
  const [decks, setDecks] = useState(() => loadDecks());
  const [pendingFlashcard, setPendingFlashcard] = useState(null); // card data waiting for deck selection

  // Stable sentence strings for AudioBar — only recomputes when tokenBlocks changes
  const sentenceTexts = useMemo(
    () => tokenBlocks.flatMap(b => b.sentences.map(s => s.tokens.map(t => t.surface_form).join(''))),
    [tokenBlocks]
  );

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
        const lines = await tokenizeLines(sentenceTexts[i].replace(/\n+/g, ''));
        for (const tokens of lines) {
          pairedSentences.push({ tokens, translation: translations[i] ?? '' });
        }
      }
      ts(`tokenizeLines done (${pairedSentences.length} sentences)`);

      setTokenBlocks(pairedSentences.length > 0 ? [{ sentences: pairedSentences }] : []);
      setShowTranslations(false);

      // Save to history
      try {
        const thumbnail = src ? await generateThumbnail(src) : '';
        const japanesePreview = pairedSentences
          .slice(0, 5)
          .map(s => s.tokens.map(t => t.surface_form).join(''))
          .join('');
        const titleText = japanesePreview.slice(0, 28) || '(Scan)';
        addScan({
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

  // Called from WordModal when user taps "Add to Flashcards"
  function handleRequestAdd(cardData) {
    setSelectedToken(null); // close WordModal
    setPendingFlashcard(cardData);
  }

  // Called from AddToDeckModal when a deck is chosen
  function handleCardAdded(updatedDecks) {
    setDecks(updatedDecks);
    setPendingFlashcard(null);
  }

  const isAdded = selectedToken
    ? (() => {
        const t = selectedToken.token;
        const target = t.lookupTarget ?? (t.basic_form && t.basic_form !== '*' ? t.basic_form : t.surface_form);
        return decks.some(d => d.cards.some(c => c.word === target));
      })()
    : false;

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
          <div style={{ width: 36 }} />
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
                  onDecksChange={setDecks}
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
              <button className="nav-item" disabled>
                <div className="nav-icon-bg">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                </div>
                <span>Settings</span>
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
    </div>
  );
}
