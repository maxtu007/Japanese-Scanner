import { supabase } from './supabase';

const BUCKET = 'scan-thumbnails';

// ── Thumbnail helpers ─────────────────────────────────────────────────────────

async function uploadThumbnail(userId, scanId, base64DataUrl) {
  if (!base64DataUrl) return '';
  try {
    const res  = await fetch(base64DataUrl);
    const blob = await res.blob();
    const path = `${userId}/${scanId}.jpg`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
      contentType: 'image/jpeg',
      upsert:      true,
    });
    if (error) { console.error('[history] thumbnail upload:', error); return ''; }
    return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  } catch (e) {
    console.error('[history] thumbnail upload failed:', e);
    return '';
  }
}

async function deleteThumbnail(thumbnailUrl) {
  if (!thumbnailUrl) return;
  try {
    // Extract path from URL: .../object/public/scan-thumbnails/{path}
    const marker = `/object/public/${BUCKET}/`;
    const idx    = thumbnailUrl.indexOf(marker);
    if (idx === -1) return;
    const path = thumbnailUrl.slice(idx + marker.length);
    await supabase.storage.from(BUCKET).remove([path]);
  } catch (e) {
    console.error('[history] thumbnail delete failed:', e);
  }
}

// ── Internal: fetch full history shape ────────────────────────────────────────

async function fetchHistory() {
  const [foldersRes, orphansRes] = await Promise.all([
    supabase
      .from('scan_folders')
      .select('*, scan_history(*)')
      .order('created_at', { ascending: true }),
    // Pick up any scans orphaned by folder deletion (folder_id IS NULL)
    supabase
      .from('scan_history')
      .select('*')
      .is('folder_id', null)
      .order('created_at', { ascending: false }),
  ]);

  if (foldersRes.error) { console.error('[history] fetch folders:', foldersRes.error); }

  const folders = (foldersRes.data ?? []).map(folder => ({
    id:        folder.id,
    name:      folder.name,
    isDefault: folder.is_default,
    scans:     (folder.scan_history ?? [])
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .map(normalizeScan),
  }));

  // Merge orphaned scans into the default/first folder (safety net)
  const orphans = (orphansRes.data ?? []).map(normalizeScan);
  if (orphans.length > 0 && folders.length > 0) {
    const def = folders.find(f => f.isDefault) ?? folders[0];
    def.scans.unshift(...orphans);
  }

  return { folders };
}

function normalizeScan(row) {
  return {
    id:          row.id,
    name:        row.name,
    thumbnail:   row.thumbnail_url,  // map → .thumbnail for component compatibility
    japanese:    row.japanese,
    translation: row.translation,
    tokenBlocks: row.token_blocks ?? [],
    createdAt:   row.created_at,
    folderId:    row.folder_id,
  };
}

// ── Ensure user has a default folder ─────────────────────────────────────────

async function ensureDefaultFolder(userId) {
  const { count } = await supabase
    .from('scan_folders')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  if (count === 0) {
    await supabase.from('scan_folders').insert({
      user_id:    userId,
      name:       'Default Folder',
      is_default: true,
    });
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function loadHistory() {
  const { data: { user } } = await supabase.auth.getUser();
  await ensureDefaultFolder(user.id);
  return fetchHistory();
}

export async function addScan({ name, thumbnail, japanese, translation, tokenBlocks }) {
  const { data: { user } } = await supabase.auth.getUser();

  // Find the default folder
  const { data: folders } = await supabase
    .from('scan_folders')
    .select('id')
    .eq('user_id', user.id)
    .eq('is_default', true)
    .limit(1);
  const folderId = folders?.[0]?.id ?? null;

  const scanId = crypto.randomUUID();
  const thumbnailUrl = await uploadThumbnail(user.id, scanId, thumbnail);

  const { error } = await supabase.from('scan_history').insert({
    id:           scanId,
    user_id:      user.id,
    folder_id:    folderId,
    name:         name || '(Untitled)',
    thumbnail_url: thumbnailUrl,
    japanese:     japanese || '',
    translation:  translation || '',
    token_blocks: tokenBlocks || [],
  });
  if (error) console.error('[history] addScan:', error);
  return fetchHistory();
}

export async function createFolder(name) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from('scan_folders').insert({ user_id: user.id, name, is_default: false });
  if (error) console.error('[history] createFolder:', error);
  return fetchHistory();
}

export async function renameFolder(folderId, name) {
  const { error } = await supabase.from('scan_folders').update({ name }).eq('id', folderId);
  if (error) console.error('[history] renameFolder:', error);
  return fetchHistory();
}

export async function deleteFolder(folderId) {
  const { data: { user } } = await supabase.auth.getUser();

  // Move scans to the default folder before deleting
  const { data: defaultFolders } = await supabase
    .from('scan_folders')
    .select('id')
    .eq('user_id', user.id)
    .eq('is_default', true)
    .limit(1);
  const defaultId = defaultFolders?.[0]?.id;
  if (defaultId && defaultId !== folderId) {
    await supabase.from('scan_history')
      .update({ folder_id: defaultId })
      .eq('folder_id', folderId);
  }

  const { error } = await supabase.from('scan_folders').delete().eq('id', folderId);
  if (error) console.error('[history] deleteFolder:', error);
  return fetchHistory();
}

export async function renameScan(scanId, name) {
  const { error } = await supabase.from('scan_history').update({ name }).eq('id', scanId);
  if (error) console.error('[history] renameScan:', error);
  return fetchHistory();
}

export async function moveScan(scanId, targetFolderId) {
  const { error } = await supabase.from('scan_history').update({ folder_id: targetFolderId }).eq('id', scanId);
  if (error) console.error('[history] moveScan:', error);
  return fetchHistory();
}

export async function deleteScan(scanId) {
  // Get thumbnail URL before deleting
  const { data } = await supabase.from('scan_history').select('thumbnail_url').eq('id', scanId).single();
  await deleteThumbnail(data?.thumbnail_url);
  const { error } = await supabase.from('scan_history').delete().eq('id', scanId);
  if (error) console.error('[history] deleteScan:', error);
  return fetchHistory();
}
