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
      <header className="header">
        <h1>Japan Scanner</h1>
        {phase === 'results' && (
          <button className="btn-ghost" onClick={() => setShowSaved(true)}>
            Saved ({savedWords.length})
          </button>
        )}
      </header>

      <main>
        {phase === 'upload' && <Upload onFile={handleFile} />}

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
            const base =
              selectedToken.basic_form && selectedToken.basic_form !== '*'
                ? selectedToken.basic_form
                : selectedToken.surface_form;
            return w.word === base;
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
