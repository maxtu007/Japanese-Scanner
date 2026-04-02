import { useState, useEffect } from 'react';
import { lookupWord } from '../utils/jisho';
import { toHiragana } from '../utils/japanese';
import { explainWord } from '../utils/explain';

export default function WordModal({ token, sentence, onClose, onSave, isSaved }) {
  const [lookup,      setLookup]      = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [added,       setAdded]       = useState(isSaved);
  const [explanation, setExplanation] = useState(null);
  const [explaining,  setExplaining]  = useState(false);

  const surface      = token.surface_form;
  const baseForm     = token.basic_form && token.basic_form !== '*' ? token.basic_form : surface;
  const lookupTarget = token.lookupTarget ?? baseForm;
  const grammarLabel = token.grammarLabel ?? null;
  const localReading = toHiragana(token.reading);

  useEffect(() => setAdded(isSaved), [isSaved]);

  // Dictionary lookup
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLookup(null);
    setError(null);
    setExplanation(null);

    lookupWord(lookupTarget, surface)
      .then(result => {
        if (!cancelled) { setLookup(result); setLoading(false); }
      })
      .catch(err => {
        if (!cancelled) {
          console.error('Dictionary lookup failed:', err.message);
          setError('Lookup failed');
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [lookupTarget, surface]);

  // Contextual explanation — fires after dictionary resolves
  useEffect(() => {
    if (loading || !sentence) return;
    let cancelled = false;
    setExplaining(true);

    const reading = lookup?.reading || localReading;
    explainWord(lookupTarget, reading, sentence)
      .then(text => {
        if (!cancelled) { setExplanation(text); setExplaining(false); }
      })
      .catch(() => {
        if (!cancelled) setExplaining(false);
      });

    return () => { cancelled = true; };
  }, [loading, lookupTarget, sentence]);

  function handleOverlayClick(e) {
    if (e.target === e.currentTarget) onClose();
  }

  function handleAdd() {
    const reading = lookup?.reading || localReading;
    onSave({
      id:             (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString()),
      word:           lookupTarget,
      dictionaryForm: lookup?.dictionaryForm ?? lookupTarget,
      reading,
      meanings:       lookup?.found ? lookup.meanings : [],
      pos:            lookup?.found ? lookup.pos : [],
      savedAt:        new Date().toISOString(),
    });
    setAdded(true);
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

        {/* Word + base form */}
        <div className="modal-word-row">
          <span className="modal-surface">{surface}</span>
          {displayDict !== surface && (
            <span className="modal-base">{displayDict}</span>
          )}
        </div>

        {/* Reading */}
        {displayReading && (
          <p className="modal-reading">{displayReading}</p>
        )}

        {/* Grammar label */}
        {grammarLabel && (
          <p className="modal-grammar-label">{grammarLabel}</p>
        )}

        {/* POS chips */}
        {posList.length > 0 && (
          <div className="modal-pos-row">
            {posList.map((p, i) => (
              <span key={i} className="modal-pos-chip">{p}</span>
            ))}
          </div>
        )}

        {/* Definitions */}
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

        {/* Contextual explanation */}
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
          disabled={added}
        >
          {added ? '✓ Added' : 'Add Word'}
        </button>
      </div>
    </div>
  );
}
