import { useState, useEffect } from 'react';
import { lookupWord } from '../utils/jisho';
import { toHiragana } from '../utils/japanese';

export default function WordModal({ token, onClose, onSave, isSaved }) {
  const [lookup, setLookup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(isSaved);

  const surface = token.surface_form;
  const baseForm =
    token.basic_form && token.basic_form !== '*' ? token.basic_form : surface;
  const localReading = toHiragana(token.reading);

  useEffect(() => setSaved(isSaved), [isSaved]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLookup(null);

    lookupWord(baseForm).then((result) => {
      if (!cancelled) {
        setLookup(result);
        setLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [baseForm]);

  function handleOverlayClick(e) {
    if (e.target === e.currentTarget) onClose();
  }

  function handleSave() {
    const reading = lookup?.reading || localReading;
    const meaning =
      lookup?.meanings?.length
        ? lookup.meanings.join('; ')
        : 'No definition found';
    onSave({ word: baseForm, reading, meaning });
    setSaved(true);
  }

  const displayReading = lookup?.reading || localReading;
  const meanings = lookup?.meanings ?? [];

  return (
    <div className="overlay" onClick={handleOverlayClick} role="dialog" aria-modal="true">
      <div className="modal">
        <button className="modal-x" onClick={onClose} aria-label="Close">✕</button>

        <div className="modal-word-row">
          <span className="modal-surface">{surface}</span>
          {baseForm !== surface && (
            <span className="modal-base">{baseForm}</span>
          )}
        </div>

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
