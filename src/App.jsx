import { useState, useEffect } from 'react';
import Upload from './components/Upload';
import TextDisplay from './components/TextDisplay';
import WordModal from './components/WordModal';
import SavedWords from './components/SavedWords';
import { extractTextFromImage, translateText, cleanOCRText, preprocessOCRText } from './utils/claude';
import { extractTextWithGoogle } from './utils/googleVision';
import { scoreOCRQuality, getImageDimensions } from './utils/ocrQuality';
import { tokenizeLines, hasJapanese } from './utils/japanese';
import { loadSavedWords, saveWord, removeWord } from './utils/storage';

export default function App() {
  const [phase, setPhase] = useState('upload'); // 'upload' | 'processing' | 'results'
  const [status, setStatus] = useState('');
  const [imageSrc, setImageSrc] = useState(null);
  const [tokenLines, setTokenLines] = useState([]);
  const [cleanText, setCleanText] = useState('');
  const [translation, setTranslation] = useState('');
  const [selectedToken, setSelectedToken] = useState(null);
  const [showSaved, setShowSaved] = useState(false);
  const [savedWords, setSavedWords] = useState([]);
  const [error, setError] = useState(null);
  useEffect(() => {
    setSavedWords(loadSavedWords());
  }, []);

  async function handleFile(file) {
    const src = URL.createObjectURL(file);
    setImageSrc(src);
    setPhase('processing');
    setError(null);

    let rawText = '';
    let normalizedText = '';
    let translation = '';

    try {
      setStatus('Running OCR…');
      let visionResult = null;
      let usedFallback = false;

      try {
        visionResult = await extractTextWithGoogle(file);
      } catch (visionErr) {
        console.warn('Google Vision failed, falling back to Claude Vision:', visionErr.message);
        usedFallback = true;
      }

      if (!usedFallback && visionResult) {
        let dimensions = null;
        try {
          dimensions = await getImageDimensions(file);
        } catch {
          // dimensions stays null; ocrQuality handles this gracefully
        }

        const quality = scoreOCRQuality(visionResult.fullText, dimensions);

        if (quality.shouldFallback) {
          usedFallback = true;
        }
      }

      if (usedFallback) {
        setStatus('Scanning…');
        const result = await extractTextFromImage(file);
        rawText = result.japanese;
        normalizedText = result.japanese; // Claude Vision output is already clean
        translation = result.translation;
      } else {
        rawText = visionResult.fullText;
        setStatus('Cleaning up text…');
        normalizedText = await cleanOCRText(preprocessOCRText(rawText));
        setStatus('Translating…');
        translation = await translateText(normalizedText);
      }

      if (!normalizedText || !hasJapanese(normalizedText)) {
        throw new Error('No Japanese text detected in this image.');
      }

      setStatus('Processing text…');
      setCleanText(normalizedText);
      const lines = await tokenizeLines(normalizedText);

      setTokenLines(lines);
      setTranslation(translation);
      setPhase('results');
    } catch (err) {
      setError(err.message || 'Processing failed. Please try again.');
      setPhase('upload');
    }
  }

  function handleSave(entry) {
    setSavedWords(saveWord(entry));
  }

  function handleRemove(word) {
    setSavedWords(removeWord(word));
  }

  function handleScanAgain() {
    if (imageSrc) URL.revokeObjectURL(imageSrc);
    setImageSrc(null);
    setTokenLines([]);
    setCleanText('');
    setTranslation('');
    setSelectedToken(null);
    setPhase('upload');
  }

  return (
    <div className="app">
      {phase !== 'upload' && (
        <header className="header">
          <div className="wordmark-sm">Un<em>blur</em></div>
          {phase === 'results' && (
            <button className="btn-ghost" onClick={() => setShowSaved(true)}>
              Saved ({savedWords.length})
            </button>
          )}
        </header>
      )}

      <main>
        {phase === 'upload' && (
          <div className="home">
            <div className="home-header">
              <div className="wordmark">Un<em>blur</em></div>
              <div className="tagline">Point. Tap. Understand.</div>
            </div>
            <div className="home-illus">
              <img src="/books.png" alt="" />
            </div>
            <Upload onFile={handleFile} />
            <nav className="bottom-nav">
              <button className="nav-item active">
                <div className="nav-icon-bg active">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/>
                    <path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
                    <rect x="7" y="7" width="10" height="10" rx="1"/>
                  </svg>
                </div>
                <span>Scan</span>
              </button>
              <button className="nav-item" disabled>
                <div className="nav-icon-bg">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/>
                  </svg>
                </div>
                <span>History</span>
              </button>
              <button className="nav-item" disabled>
                <div className="nav-icon-bg">
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
            {imageSrc && (
              <img src={imageSrc} alt="" className="thumb" />
            )}
            <div className="spinner" />
            <p className="processing-msg">{status}</p>
          </div>
        )}

        {phase === 'results' && (
          <div className="results">
            <TextDisplay tokenLines={tokenLines} onWordClick={setSelectedToken} />

            <div className="translation">
              <p className="translation-label">Translation</p>
              <p className="translation-text">
                {translation || 'Translation unavailable.'}
              </p>
            </div>

            <button className="btn-ghost" onClick={handleScanAgain}>
              ← Scan another image
            </button>
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
          token={selectedToken}
          onClose={() => setSelectedToken(null)}
          onSave={handleSave}
          isSaved={savedWords.some((w) => {
            const target =
              selectedToken.lookupTarget
                ?? (selectedToken.basic_form && selectedToken.basic_form !== '*'
                    ? selectedToken.basic_form
                    : selectedToken.surface_form);
            return w.word === target;
          })}
        />
      )}

      {showSaved && (
        <SavedWords
          words={savedWords}
          onClose={() => setShowSaved(false)}
          onRemove={handleRemove}
        />
      )}
    </div>
  );
}
