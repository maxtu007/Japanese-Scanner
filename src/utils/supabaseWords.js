import { supabase } from './supabase';

export async function loadSavedWords() {
  const { data, error } = await supabase
    .from('saved_words')
    .select('word, reading, meaning')
    .order('created_at', { ascending: false });
  if (error) { console.error('[words] load:', error); return []; }
  return data;
}

export async function saveWord(entry) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase
    .from('saved_words')
    .upsert(
      { user_id: user.id, word: entry.word, reading: entry.reading || '', meaning: entry.meaning || '' },
      { onConflict: 'user_id,word', ignoreDuplicates: true }
    );
  if (error) console.error('[words] save:', error);
  return loadSavedWords();
}

export async function removeWord(word) {
  const { error } = await supabase
    .from('saved_words')
    .delete()
    .eq('word', word);
  if (error) console.error('[words] remove:', error);
  return loadSavedWords();
}
