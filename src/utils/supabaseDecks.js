import { supabase } from './supabase';

// ── Internal: fetch all decks with nested cards for current user ──────────────
async function fetchDecks() {
  const { data, error } = await supabase
    .from('decks')
    .select('*, deck_cards(*)')
    .order('created_at', { ascending: true });
  if (error) { console.error('[decks] fetch:', error); return []; }

  return data.map(deck => ({
    id:        deck.id,
    name:      deck.name,
    createdAt: deck.created_at,
    cards:     (deck.deck_cards ?? []).map(normalizeCard).sort((a, b) => new Date(a.addedAt) - new Date(b.addedAt)),
  }));
}

// Normalize DB snake_case → camelCase to match old localStorage shape
function normalizeCard(c) {
  return {
    id:          c.id,
    word:        c.word,
    reading:     c.reading,
    meanings:    c.meanings ?? [],
    addedAt:     c.added_at,
    dueDate:     c.due_date ?? null,
    interval:    c.interval,
    easeFactor:  c.ease_factor,
    reviews:     c.reviews,
  };
}

// ── Ensure user has at least one deck (auto-create Default Deck if empty) ─────
async function ensureDefaultDeck(userId) {
  const { count } = await supabase
    .from('decks')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  if (count === 0) {
    await supabase.from('decks').insert({ user_id: userId, name: 'Default Deck' });
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function loadDecks() {
  const { data: { user } } = await supabase.auth.getUser();
  await ensureDefaultDeck(user.id);
  return fetchDecks();
}

export async function createDeck(name) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from('decks').insert({ user_id: user.id, name });
  if (error) console.error('[decks] create:', error);
  return fetchDecks();
}

export async function addCardToDeck(deckId, card) {
  const { error } = await supabase.from('deck_cards').upsert(
    {
      deck_id:     deckId,
      word:        card.word,
      reading:     card.reading || '',
      meanings:    card.meanings ?? [],
    },
    { onConflict: 'deck_id,word', ignoreDuplicates: true }
  );
  if (error) console.error('[decks] addCard:', error);
  return fetchDecks();
}

export async function updateCardInDeck(deckId, cardId, updates) {
  // Convert camelCase updates back to snake_case for DB
  const dbUpdates = {};
  if (updates.dueDate    !== undefined) dbUpdates.due_date    = updates.dueDate;
  if (updates.interval   !== undefined) dbUpdates.interval    = updates.interval;
  if (updates.easeFactor !== undefined) dbUpdates.ease_factor = updates.easeFactor;
  if (updates.reviews    !== undefined) dbUpdates.reviews     = updates.reviews;

  const { error } = await supabase
    .from('deck_cards')
    .update(dbUpdates)
    .eq('id', cardId);
  if (error) console.error('[decks] updateCard:', error);
}

export async function deleteCardFromDeck(deckId, cardId) {
  const { error } = await supabase.from('deck_cards').delete().eq('id', cardId);
  if (error) console.error('[decks] deleteCard:', error);
  return fetchDecks();
}

export async function deleteDeck(deckId) {
  const { error } = await supabase.from('decks').delete().eq('id', deckId);
  if (error) console.error('[decks] deleteDeck:', error);
  return fetchDecks();
}

export async function isWordInAnyDeck(word) {
  const { count, error } = await supabase
    .from('deck_cards')
    .select('id', { count: 'exact', head: true })
    .eq('word', word);
  if (error) return false;
  return count > 0;
}
