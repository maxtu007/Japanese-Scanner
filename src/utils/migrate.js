/**
 * One-time migration from localStorage to Supabase.
 * Runs after first login if localStorage data exists.
 * Guarded by 'japan-scanner-migrated' flag — safe to call on every login.
 */
import { supabase } from './supabase';

const MIGRATION_FLAG = 'japan-scanner-migrated';

export async function migrateLocalStorageToSupabase() {
  if (localStorage.getItem(MIGRATION_FLAG)) return;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  console.log('[migrate] Starting localStorage → Supabase migration');

  await migrateWords(user.id);
  await migrateDecks(user.id);
  await migrateHistory(user.id);

  localStorage.setItem(MIGRATION_FLAG, '1');
  console.log('[migrate] Done');
}

// ── Words ─────────────────────────────────────────────────────────────────────

async function migrateWords(userId) {
  try {
    const raw = localStorage.getItem('japan-scanner-words');
    const words = raw ? JSON.parse(raw) : [];
    if (words.length === 0) return;

    const rows = words.map(w => ({
      user_id: userId,
      word:    w.word,
      reading: w.reading || '',
      meaning: w.meaning || '',
    }));

    const { error } = await supabase.from('saved_words').upsert(rows, {
      onConflict:      'user_id,word',
      ignoreDuplicates: true,
    });
    if (error) console.error('[migrate] words:', error);
    else console.log(`[migrate] Migrated ${words.length} saved words`);
  } catch (e) {
    console.error('[migrate] words failed:', e);
  }
}

// ── Decks ─────────────────────────────────────────────────────────────────────

async function migrateDecks(userId) {
  try {
    const raw = localStorage.getItem('japan-scanner-decks');
    const decks = raw ? JSON.parse(raw) : [];
    if (decks.length === 0) return;

    for (const deck of decks) {
      // Insert deck (skip "default" id — let Supabase generate UUID)
      const { data: inserted, error: deckErr } = await supabase
        .from('decks')
        .insert({ user_id: userId, name: deck.name })
        .select('id')
        .single();
      if (deckErr) { console.error('[migrate] deck insert:', deckErr); continue; }

      const cards = (deck.cards ?? []).map(c => ({
        deck_id:     inserted.id,
        word:        c.word,
        reading:     c.reading || '',
        meanings:    c.meanings ?? [],
        added_at:    c.addedAt   || new Date().toISOString(),
        due_date:    c.dueDate   || null,
        interval:    c.interval  || 0,
        ease_factor: c.easeFactor || 2.5,
        reviews:     c.reviews   || 0,
      }));

      if (cards.length > 0) {
        const { error: cardErr } = await supabase.from('deck_cards').upsert(cards, {
          onConflict:      'deck_id,word',
          ignoreDuplicates: true,
        });
        if (cardErr) console.error('[migrate] cards insert:', cardErr);
      }
    }

    console.log(`[migrate] Migrated ${decks.length} decks`);
  } catch (e) {
    console.error('[migrate] decks failed:', e);
  }
}

// ── History ───────────────────────────────────────────────────────────────────

async function migrateHistory(userId) {
  try {
    const raw = localStorage.getItem('japan-scanner-history');
    const history = raw ? JSON.parse(raw) : null;
    if (!history?.folders?.length) return;

    const BUCKET = 'scan-thumbnails';

    for (const folder of history.folders) {
      // Create folder in Supabase
      const { data: inserted, error: folderErr } = await supabase
        .from('scan_folders')
        .insert({
          user_id:    userId,
          name:       folder.name,
          is_default: folder.id === 'default',
        })
        .select('id')
        .single();
      if (folderErr) { console.error('[migrate] folder insert:', folderErr); continue; }

      const folderId = inserted.id;

      for (const scan of (folder.scans ?? [])) {
        const scanId = scan.id || crypto.randomUUID();

        // Upload thumbnail
        let thumbnailUrl = '';
        if (scan.thumbnail && scan.thumbnail.startsWith('data:')) {
          try {
            const blob = await (await fetch(scan.thumbnail)).blob();
            const path = `${userId}/${scanId}.jpg`;
            const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, blob, {
              contentType: 'image/jpeg',
              upsert:      true,
            });
            if (!upErr) {
              thumbnailUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
            }
          } catch (e) {
            console.warn('[migrate] thumbnail upload failed for scan', scanId, e);
          }
        }

        const { error: scanErr } = await supabase.from('scan_history').upsert({
          id:            scanId,
          user_id:       userId,
          folder_id:     folderId,
          name:          scan.name || '(Untitled)',
          thumbnail_url: thumbnailUrl,
          japanese:      scan.japanese || '',
          translation:   scan.translation || '',
          token_blocks:  scan.tokenBlocks || [],
          created_at:    scan.createdAt || new Date().toISOString(),
        }, { onConflict: 'id', ignoreDuplicates: true });
        if (scanErr) console.error('[migrate] scan insert:', scanErr);
      }
    }

    console.log('[migrate] Migrated history');
  } catch (e) {
    console.error('[migrate] history failed:', e);
  }
}
