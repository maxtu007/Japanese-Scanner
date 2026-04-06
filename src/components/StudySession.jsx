import { useState } from 'react';
import { isDue, scheduleCard } from '../utils/srs';
import { updateCardInDeck } from '../utils/supabaseDecks';
import { speakOne } from '../utils/tts';

export default function StudySession({ deck, onDone, onBack }) {
  const initialQueue = deck.cards.filter(isDue).length > 0
    ? deck.cards.filter(isDue)
    : deck.cards;

  const [queue] = useState(initialQueue);
  const [current, setCurrent] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(false);

  const card = queue[current];

  function handleRating(rating) {
    const updates = scheduleCard(card, rating);
    // Fire-and-forget — UI advances immediately, DB syncs in background
    updateCardInDeck(deck.id, card.id, updates).catch(e =>
      console.error('[study] updateCard failed:', e)
    );

    if (current + 1 >= queue.length) {
      setDone(true);
      onDone();
    } else {
      setFlipped(false);
      setCurrent(i => i + 1);
    }
  }

  if (queue.length === 0) {
    return (
      <div className="study-session study-done-screen">
        <div className="study-header">
          <button className="study-back-btn" onClick={onBack}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
        </div>
        <div className="study-done-content">
          <div className="study-done-check">✓</div>
          <h2 className="study-done-title">Nothing due for review!</h2>
          <button className="study-back-deck-btn" onClick={onBack}>Back to Deck</button>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="study-session study-done-screen">
        <div className="study-header">
          <button className="study-back-btn" onClick={onBack}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
        </div>
        <div className="study-done-content">
          <div className="study-done-check">✓</div>
          <h2 className="study-done-title">Review complete!</h2>
          <button className="study-back-deck-btn" onClick={onBack}>Back to Deck</button>
        </div>
      </div>
    );
  }

  const progress = (current / queue.length) * 100;

  return (
    <div className="study-session">
      <div className="study-header">
        <button className="study-back-btn" onClick={onBack}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <span className="study-deck-name">Review {deck.name}</span>
        <div style={{ width: 32 }} />
      </div>

      <div className="study-progress-wrap">
        <div className="study-progress-track">
          <div className="study-progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <span className="study-counter">{current + 1}/{queue.length}</span>
      </div>

      <div
        className={`study-card${flipped ? ' flipped' : ''}`}
        onClick={() => { if (!flipped) setFlipped(true); }}
      >
        {!flipped ? (
          <div className="study-card-front">
            <span className="study-card-word">{card.word}</span>
            <button
              className="speak-btn-card"
              onClick={(e) => { e.stopPropagation(); speakOne(card.word); }}
              aria-label="Listen"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
              </svg>
            </button>
            <span className="study-card-hint">Tap to see the pronunciation and meaning</span>
          </div>
        ) : (
          <div className="study-card-back">
            <div className="study-card-back-word-row">
              <span className="study-card-word-sm">{card.word}</span>
              <button
                className="speak-btn"
                onClick={() => speakOne(card.word)}
                aria-label="Listen"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                </svg>
              </button>
            </div>
            {card.reading && (
              <p className="study-card-reading">{card.reading}</p>
            )}
            <div className="study-card-sep" />
            <p className="study-card-meaning-text">
              {card.meanings?.[0] || ''}
            </p>
            {card.meanings?.slice(1, 3).map((m, i) => (
              <p key={i} className="study-card-meaning-alt">{m}</p>
            ))}
            {card.exampleSentence && (
              <div className="study-card-example">
                <p className="study-card-example-jp">{card.exampleSentence}</p>
                {card.exampleTranslation && (
                  <p className="study-card-example-en">{card.exampleTranslation}</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {flipped ? (
        <div className="study-ratings">
          <button className="rating-btn rating-again" onClick={() => handleRating(1)}>Again</button>
          <button className="rating-btn rating-hard" onClick={() => handleRating(2)}>Hard</button>
          <button className="rating-btn rating-good" onClick={() => handleRating(3)}>Good</button>
          <button className="rating-btn rating-easy" onClick={() => handleRating(4)}>Easy</button>
        </div>
      ) : (
        <div className="study-ratings-placeholder" />
      )}
    </div>
  );
}
