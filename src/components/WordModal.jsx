import { useState, useEffect } from 'react';
import { lookupWord } from '../utils/jisho';
import { toHiragana } from '../utils/japanese';
import { explainWord } from '../utils/explain';
import { speakOne } from '../utils/tts';

export default function WordModal({ token, sentence, onClose, onRequestAdd, isAdded }) {
  const [lookup,      setLookup]      = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [explanation, setExplanation] = useState(null);
  const [explaining,  setExplaining]  = useState(false);

  const surface      = token.surface_form;
  const baseForm     = token.basic_form && token.basic_form !== '*' ? token.basic_form : surface;
  const lookupTarget = token.lookupTarget ?? baseForm;
  const grammarLabel = token.grammarLabel ?? null;
  const localReading = toHiragana(token.reading);

  // Lock background scroll while modal is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLookup(null);
    setError(null);

    lookupWord(lookupTarget, surface)
      .then(result => { if (!cancelled) { setLookup(result); setLoading(false); } })
      .catch(err => {
        if (!cancelled) { console.error('Dictionary lookup failed:', err.message); setError('Lookup failed'); setLoading(false); }
      });

    return () => { cancelled = true; };
  }, [lookupTarget, surface]);

  // Contextual explanation — fires after dictionary resolves
  useEffect(() => {
    if (loading || !sentence) return;
    let cancelled = false;
    setExplaining(true);

    const reading = lookup?.reading || localReading;
    const sentenceText = sentence?.tokens?.map(t => t.surface_form).join('') ?? '';
    explainWord(lookupTarget, reading, sentenceText)
      .then(text => { if (!cancelled) { setExplanation(text); setExplaining(false); } })
      .catch(() => { if (!cancelled) setExplaining(false); });

    return () => { cancelled = true; };
  }, [loading, lookupTarget, sentence]);

  function handleOverlayClick(e) {
    if (e.target === e.currentTarget) onClose();
  }

  function handleAdd() {
    const reading = lookup?.reading || localReading;
    const exampleSentence = sentence?.tokens?.map(t => t.surface_form).join('') ?? '';
    const exampleTranslation = sentence?.translation ?? '';

    onRequestAdd({
      word:               lookupTarget,
      dictionaryForm:     lookup?.dictionaryForm ?? lookupTarget,
      reading,
      meanings:           lookup?.found ? lookup.meanings : [],
      pos:                lookup?.found ? (lookup.pos ?? []) : [],
      exampleSentence,
      exampleTranslation,
    });
  }

  const displayReading = lookup?.reading || localReading;
  const posList        = lookup?.found ? (lookup.pos ?? []) : [];
  const displayDict    = (lookup?.found && lookup.dictionaryForm && lookup.dictionaryForm !== surface)
    ? lookup.dictionaryForm
    : baseForm;

  return (
    <div className="overlay" onClick={handleOverlayClick} role="dialog" aria-modal="true">
      <div className="modal">
        <button className="modal-x" onClick={onClose} aria-label="Close">✕</button>

        <div className="modal-word-row">
          <div className="modal-word-left">
            <span className="modal-surface">{surface}</span>
            {displayDict !== surface && (
              <span className="modal-base">{displayDict}</span>
            )}
          </div>
          <button className="speak-btn" onClick={() => speakOne(lookupTarget)} aria-label="Listen">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
            </svg>
          </button>
        </div>

        {displayReading && (
          <p className="modal-reading">{displayReading}</p>
        )}

        {grammarLabel && (
          <p className="modal-grammar-label">{grammarLabel}</p>
        )}

        {posList.length > 0 && (
          <div className="modal-pos-row">
            {posList.map((p, i) => (
              <span key={i} className="modal-pos-chip">{p}</span>
            ))}
          </div>
        )}

        <div className="modal-defs">
          {loading ? (
            <p className="def-loading">Looking up…</p>
          ) : error ? (
            <p className="def-error">{error}</p>
          ) : lookup?.found ? (
            <ol className="modal-def-list">
              {lookup.meanings.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ol>
          ) : (
            <p className="def-empty">No definition found</p>
          )}
        </div>

        {(explaining || explanation) && (
          <div className="modal-explanation">
            {explaining ? (
              <p className="explanation-loading">…</p>
            ) : (
              <p className="explanation-text">{explanation}</p>
            )}
          </div>
        )}

        <button
          className="btn-save"
          onClick={handleAdd}
          disabled={isAdded}
        >
          {isAdded ? '✓ Added to Flashcards' : 'Add to Flashcards'}
        </button>
      </div>
    </div>
  );
}
