import { useState, useEffect } from 'react';
import { lookupWord } from '../utils/jisho';
import { toHiragana } from '../utils/japanese';

export default function WordModal({ token, onClose, onSave, isSaved }) {
  const [lookup,  setLookup]  = useState(null);
  const [loading, setLoading] = useState(true);
  const [saved,   setSaved]   = useState(isSaved);

  const surface      = token.surface_form;
  const baseForm     = token.basic_form && token.basic_form !== '*' ? token.basic_form : surface;
  // lookupTarget is the explicit contract from chunkResolver; fall back to baseForm for
  // legacy or fallback-merged spans that may not carry the field.
  const lookupTarget = token.lookupTarget ?? baseForm;
  const grammarLabel = token.grammarLabel ?? null;
  const localReading = toHiragana(token.reading);

  useEffect(() => setSaved(isSaved), [isSaved]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLookup(null);

    // Primary lookup: use the explicit lookupTarget (base verb for te-constructions,
    // full expression for postpositionals, lemma for everything else).
    lookupWord(lookupTarget)
      .then(result => {
        // Grammar label fallback: if primary lookup fails and there is a grammarLabel
        // that differs from the primary target, try looking up the label itself.
        if (!result && grammarLabel && grammarLabel !== lookupTarget) {
          return lookupWord(grammarLabel);
        }
        return result;
      })
      .then(result => {
        // Surface fallback: last resort so the modal always has something to show.
        if (!result && lookupTarget !== surface) {
          return lookupWord(surface);
        }
        return result;
      })
      .then(result => {
        if (!cancelled) {
          setLookup(result);
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [lookupTarget, grammarLabel, surface]);

  function handleOverlayClick(e) {
    if (e.target === e.currentTarget) onClose();
  }

  function handleSave() {
    const reading = lookup?.reading || localReading;
    onSave({
      id:             (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString()),
      word:           lookupTarget,
      dictionaryForm: lookup?.word ?? lookupTarget,
      reading,
      meanings:       lookup?.meanings ?? [],
      pos:            lookup?.pos ?? [],
      savedAt:        new Date().toISOString(),
    });
    setSaved(true);
  }

  const displayReading = lookup?.reading || localReading;
  const meanings       = lookup?.meanings ?? [];
  const posList        = lookup?.pos ?? [];
  // Prefer the Jisho-resolved canonical form; fall back to kuromoji basic_form
  const displayDict    = (lookup?.word && lookup.word !== surface) ? lookup.word : baseForm;

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
          ) : meanings.length > 0 ? (
            <ul>
              {meanings.map((m, i) => (
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
