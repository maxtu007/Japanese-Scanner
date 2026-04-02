import { useState } from 'react';
import { loadDecks, createDeck, addCardToDeck } from '../utils/deckStorage';

export default function AddToDeckModal({ card, onClose, onAdded }) {
  const [decks, setDecks] = useState(() => loadDecks());
  const [creatingNew, setCreatingNew] = useState(false);
  const [newDeckName, setNewDeckName] = useState('');

  function handleSelectDeck(deckId) {
    const updated = addCardToDeck(deckId, card);
    onAdded(updated);
    onClose();
  }

  function handleCreateDeck() {
    const name = newDeckName.trim();
    if (!name) return;
    let updated = createDeck(name);
    const newDeck = updated[updated.length - 1];
    updated = addCardToDeck(newDeck.id, card);
    onAdded(updated);
    onClose();
  }

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="add-deck-sheet">
        <h2 className="add-deck-title">Add "{card.word}" to Flashcards</h2>

        <p className="add-deck-section-label">Select a deck:</p>

        <div className="add-deck-list">
          {decks.map(deck => (
            <button key={deck.id} className="add-deck-option" onClick={() => handleSelectDeck(deck.id)}>
              <span className="add-deck-option-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="3" width="9" height="13" rx="1.5"/><rect x="7" y="8" width="9" height="13" rx="1.5"/>
                </svg>
              </span>
              <span className="add-deck-option-name">{deck.name}</span>
              <span className="add-deck-option-arrow">›</span>
            </button>
          ))}
        </div>

        <div className="add-deck-divider" />

        {creatingNew ? (
          <div className="add-deck-new-row">
            <input
              className="add-deck-new-input"
              placeholder="Deck name…"
              value={newDeckName}
              onChange={e => setNewDeckName(e.target.value)}
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') handleCreateDeck(); if (e.key === 'Escape') setCreatingNew(false); }}
            />
            <button className="add-deck-confirm-btn" onClick={handleCreateDeck}>Create</button>
          </div>
        ) : (
          <button className="add-deck-new-btn" onClick={() => setCreatingNew(true)}>
            <span className="add-deck-new-plus">+</span>
            Create New Deck
          </button>
        )}

        <button className="add-deck-cancel" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}
