const KEY = 'japan-scanner-decks';

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
}

function persist(decks) {
  localStorage.setItem(KEY, JSON.stringify(decks));
  return decks;
}

export function loadDecks() {
  const decks = load();
  if (decks.length === 0) {
    return persist([{
      id: 'default',
      name: 'Default Deck',
      cards: [],
      createdAt: new Date().toISOString(),
    }]);
  }
  return decks;
}

export function createDeck(name) {
  const decks = load();
  const deck = {
    id: crypto.randomUUID(),
    name,
    cards: [],
    createdAt: new Date().toISOString(),
  };
  decks.push(deck);
  return persist(decks);
}

export function addCardToDeck(deckId, card) {
  const decks = load();
  const deck = decks.find(d => d.id === deckId);
  if (!deck) return decks;
  if (!deck.cards.some(c => c.word === card.word)) {
    deck.cards.push({ ...card, id: crypto.randomUUID(), addedAt: new Date().toISOString() });
  }
  return persist(decks);
}

export function updateCardInDeck(deckId, cardId, updates) {
  const decks = load();
  const deck = decks.find(d => d.id === deckId);
  if (!deck) return decks;
  const i = deck.cards.findIndex(c => c.id === cardId);
  if (i !== -1) deck.cards[i] = { ...deck.cards[i], ...updates };
  return persist(decks);
}

export function deleteDeck(deckId) {
  return persist(load().filter(d => d.id !== deckId));
}

export function deleteCardFromDeck(deckId, cardId) {
  const decks = load();
  const deck = decks.find(d => d.id === deckId);
  if (deck) deck.cards = deck.cards.filter(c => c.id !== cardId);
  return persist(decks);
}

export function isWordInAnyDeck(word) {
  return load().some(d => d.cards.some(c => c.word === word));
}
