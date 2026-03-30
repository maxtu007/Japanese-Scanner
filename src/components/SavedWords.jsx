export default function SavedWords({ words, onClose, onRemove }) {
  function handleOverlayClick(e) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div className="overlay" onClick={handleOverlayClick} role="dialog" aria-modal="true">
      <div className="saved-modal">
        <div className="saved-header">
          <h2>Saved Words</h2>
          <button className="modal-x" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {words.length === 0 ? (
          <p className="saved-empty">
            No saved words yet. Tap a word while reading to save it.
          </p>
        ) : (
          <ul className="saved-list">
            {words.map((w) => (
              <li key={w.word} className="saved-item">
                <div className="saved-info">
                  <span className="saved-word">{w.word}</span>
                  {w.reading && (
                    <span className="saved-reading">{w.reading}</span>
                  )}
                  <span className="saved-meaning">{w.meaning}</span>
                </div>
                <button
                  className="btn-rm"
                  onClick={() => onRemove(w.word)}
                  aria-label={`Remove ${w.word}`}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
