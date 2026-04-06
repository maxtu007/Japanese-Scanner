-- Japan Scanner — Supabase Schema
-- Run this in the Supabase SQL Editor.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── saved_words ───────────────────────────────────────────────────────────────
CREATE TABLE public.saved_words (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  word       TEXT NOT NULL,
  reading    TEXT NOT NULL DEFAULT '',
  meaning    TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.saved_words ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own words" ON public.saved_words
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE UNIQUE INDEX saved_words_user_word_idx ON public.saved_words(user_id, word);

-- ── decks ─────────────────────────────────────────────────────────────────────
CREATE TABLE public.decks (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.decks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own decks" ON public.decks
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── deck_cards ────────────────────────────────────────────────────────────────
CREATE TABLE public.deck_cards (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id     UUID NOT NULL REFERENCES public.decks(id) ON DELETE CASCADE,
  word        TEXT NOT NULL,
  reading     TEXT NOT NULL DEFAULT '',
  meanings    JSONB NOT NULL DEFAULT '[]',
  added_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  due_date    TIMESTAMPTZ,
  interval    INTEGER NOT NULL DEFAULT 0,
  ease_factor FLOAT NOT NULL DEFAULT 2.5,
  reviews     INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE public.deck_cards ENABLE ROW LEVEL SECURITY;
-- RLS via deck ownership join (no user_id on deck_cards directly)
CREATE POLICY "Users manage own deck cards" ON public.deck_cards
  FOR ALL TO authenticated
  USING (deck_id IN (SELECT id FROM public.decks WHERE user_id = auth.uid()))
  WITH CHECK (deck_id IN (SELECT id FROM public.decks WHERE user_id = auth.uid()));
CREATE UNIQUE INDEX deck_cards_deck_word_idx ON public.deck_cards(deck_id, word);
CREATE INDEX deck_cards_deck_due_idx ON public.deck_cards(deck_id, due_date);

-- ── scan_folders ──────────────────────────────────────────────────────────────
CREATE TABLE public.scan_folders (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.scan_folders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own folders" ON public.scan_folders
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── scan_history ──────────────────────────────────────────────────────────────
CREATE TABLE public.scan_history (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  folder_id     UUID REFERENCES public.scan_folders(id) ON DELETE SET NULL,
  name          TEXT NOT NULL DEFAULT '(Scan)',
  thumbnail_url TEXT NOT NULL DEFAULT '',
  japanese      TEXT NOT NULL DEFAULT '',
  translation   TEXT NOT NULL DEFAULT '',
  token_blocks  JSONB NOT NULL DEFAULT '[]',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.scan_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own scans" ON public.scan_history
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX scan_history_user_created_idx ON public.scan_history(user_id, created_at DESC);
CREATE INDEX scan_history_folder_idx ON public.scan_history(folder_id);


-- ── Storage bucket + RLS (run these after creating the bucket in Dashboard) ───
-- Storage > New bucket: name = scan-thumbnails, Public = ON

-- (No RLS needed for public bucket — path-based obscurity via UUID is sufficient.
--  If you later switch to private, add these policies:)
-- CREATE POLICY "Users upload own thumbnails" ON storage.objects FOR INSERT TO authenticated
--   WITH CHECK (bucket_id = 'scan-thumbnails' AND (storage.foldername(name))[1] = auth.uid()::text);
-- CREATE POLICY "Users read own thumbnails" ON storage.objects FOR SELECT TO authenticated
--   USING (bucket_id = 'scan-thumbnails' AND (storage.foldername(name))[1] = auth.uid()::text);
-- CREATE POLICY "Users delete own thumbnails" ON storage.objects FOR DELETE TO authenticated
--   USING (bucket_id = 'scan-thumbnails' AND (storage.foldername(name))[1] = auth.uid()::text);
