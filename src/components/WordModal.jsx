import { useState, useEffect } from 'react';
import { lookupWord } from '../utils/jisho';
import { toHiragana } from '../utils/japanese';

export default function WordModal({ token, onClose, onSave, isSaved }) {
  const [lookup,  setLookup]  = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [saved,   setSaved]   = useState(isSaved);

  const surface      = token.surface_form;
  const baseForm     = token.basic_form && token.basic_form !== '*' ? token.basic_form : surface;
  const lookupTarget = token.lookupTarget ?? baseForm;
  const grammarLabel = token.grammarLabel ?? null;
  const localReading = toHiragana(token.reading);

  useEffect(() => setSaved(isSaved), [isSaved]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLookup(null);
    setError(null);

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

  function handleOverlayClick(e) {
    if (e.target === e.currentTarget) onClose();
  }

  function handleSave() {
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
    setSaved(true);
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
          <span className="modal-surface">{surface}</span>
          {displayDict !== surface && (
            <span className="modal-base">{displayDict}</span>
          )}
        </div>

        {grammarLabel && (
          <p className="modal-grammar-label">{grammarLabel}</p>
        )}

        {displayReading && (
          <p className="modal-reading">{displayReading}</p>
        )}

        <div className="modal-defs">
          {loading ? (
            <p className="def-loading">Looking up…</p>
          ) : error ? (
            <p className="def-error">{error}</p>
          ) : lookup?.found ? (
            <ul>
              {lookup.meanings.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          ) : (
            <p className="def-empty">No definition found</p>
          )}
        </div>

        {posList.length > 0 && (
          <div className="modal-pos-row">
            {posList.map((p, i) => (
              <span key={i} className="modal-pos-chip">{p}</span>
            ))}
          </div>
        )}

        <button
          className="btn-save"
          onClick={handleSave}
          disabled={saved}
        >
          {saved ? '✓ Saved' : 'Save Word'}
        </button>
      </div>
    </div>
  );
}
