import { useState } from 'react';
import { loadDecks, createDeck } from '../utils/deckStorage';
import { isDue } from '../utils/srs';
import StudySession from './StudySession';

export default function FlashcardsTab({ decks: initialDecks, onDecksChange }) {
  const [decks, setDecks] = useState(initialDecks ?? loadDecks());
  const [search, setSearch] = useState('');
  const [expandedDecks, setExpandedDecks] = useState(new Set(['default']));
  const [studying, setStudying] = useState(null); // deck object
  const [creatingDeck, setCreatingDeck] = useState(false);
  const [newDeckName, setNewDeckName] = useState('');

  function updateDecks(updated) {
    setDecks(updated);
    onDecksChange?.(updated);
  }

  function toggleDeck(id) {
    setExpandedDecks(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  }

  function handleCreateDeck() {
    const name = newDeckName.trim();
    if (!name) return;
    updateDecks(createDeck(name));
    setNewDeckName('');
    setCreatingDeck(false);
  }

  function handleStudyDone(updatedDecks) {
    updateDecks(updatedDecks);
    setStudying(null);
  }

  const q = search.trim().toLowerCase();
  const filtered = q
    ? decks.map(d => ({
        ...d,
        cards: d.cards.filter(c =>
          c.word.includes(q) ||
          (c.reading && c.reading.includes(q)) ||
          c.meanings?.some(m => m.toLowerCase().includes(q))
        ),
      })).filter(d => d.cards.length > 0)
    : decks;

  if (studying) {
    const liveDeck = decks.find(d => d.id === studying.id) ?? studying;
    return (
      <StudySession
        deck={liveDeck}
        onDone={handleStudyDone}
        onBack={() => setStudying(null)}
      />
    );
  }

  return (
    <div className="flashcards-tab">
      <div className="flashcards-header">
        <h1 className="flashcards-title">Flashcards</h1>
      </div>

      <div className="fc-search-wrap">
        <svg className="fc-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          className="fc-search"
          placeholder="Search saved words"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && (
          <button className="fc-search-clear" onClick={() => setSearch('')}>✕</button>
        )}
      </div>

      <div className="fc-decks-list">
        {filtered.length === 0 && (
          <p className="fc-empty">No words found.</p>
        )}
        {filtered.map(deck => {
          const dueCount = deck.cards.filter(isDue).length;
          const expanded = expandedDecks.has(deck.id);

          return (
            <div key={deck.id} className="fc-deck">
              <button
                className={`fc-deck-header${expanded ? ' expanded' : ''}`}
                onClick={() => toggleDeck(deck.id)}
              >
                <span className="fc-deck-chevron">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    {expanded
                      ? <polyline points="18 15 12 9 6 15"/>
                      : <polyline points="6 9 12 15 18 9"/>}
                  </svg>
                </span>
                <span className="fc-deck-name">{deck.name}</span>
                <span className="fc-deck-count">{deck.cards.length}</span>
              </button>

              {expanded && (
                <div className="fc-deck-body">
                  {deck.cards.length > 0 && (
                    <div className="fc-due-row">
                      <span className={`fc-due-label${dueCount === 0 ? ' caught-up' : ''}`}>
                        {dueCount > 0 ? `${dueCount} due for review` : 'All caught up!'}
                      </span>
                      <button className="fc-study-btn" onClick={() => setStudying(deck)}>
                        {dueCount > 0 ? 'Study' : 'Review all'} ›
                      </button>
                    </div>
                  )}

                  {deck.cards.length === 0 ? (
                    <p className="fc-deck-empty">No cards yet. Scan text and save words!</p>
                  ) : (
                    <div className="fc-cards-list">
                      {deck.cards.map((card, i) => (
                        <div key={card.id} className="fc-card-row">
                          <div className="fc-card-left">
                            <span className="fc-card-date">
                              {new Date(card.addedAt).toLocaleDateString('en-CA').replace(/-/g, '.')}
                            </span>
                            <span className="fc-card-word">{card.word}</span>
                            {card.reading && <span className="fc-card-reading">{card.reading}</span>}
                            {card.meanings?.[0] && <span className="fc-card-meaning">{card.meanings[0]}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button className="fc-fab" onClick={() => setCreatingDeck(true)} aria-label="New deck">+</button>

      {creatingDeck && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && setCreatingDeck(false)}>
          <div className="create-deck-modal">
            <h2 className="create-deck-title">New Deck</h2>
            <input
              className="create-deck-input"
              placeholder="Deck name"
              value={newDeckName}
              onChange={e => setNewDeckName(e.target.value)}
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') handleCreateDeck(); if (e.key === 'Escape') setCreatingDeck(false); }}
            />
            <div className="create-deck-actions">
              <button className="btn-ghost" onClick={() => setCreatingDeck(false)}>Cancel</button>
              <button className="btn-accent" onClick={handleCreateDeck}>Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
