const KEY = 'japan-scanner-history';

function defaultHistory() {
  return { folders: [{ id: 'default', name: 'Default Folder', scans: [] }] };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultHistory();
    return JSON.parse(raw);
  } catch {
    return defaultHistory();
  }
}

function save(history) {
  localStorage.setItem(KEY, JSON.stringify(history));
  return history;
}

export function loadHistory() {
  return load();
}

export function addScan({ name, thumbnail, japanese, translation, tokenBlocks }) {
  const history = load();
  const folder = history.folders.find(f => f.id === 'default') ?? history.folders[0];
  folder.scans.unshift({
    id: crypto.randomUUID(),
    name: name || '(Untitled)',
    thumbnail: thumbnail || '',
    japanese: japanese || '',
    translation: translation || '',
    tokenBlocks: tokenBlocks || [],
    createdAt: new Date().toISOString(),
  });
  return save(history);
}

export function createFolder(name) {
  const history = load();
  history.folders.push({ id: crypto.randomUUID(), name, scans: [] });
  return save(history);
}

export function renameFolder(folderId, name) {
  const history = load();
  const folder = history.folders.find(f => f.id === folderId);
  if (folder) folder.name = name;
  return save(history);
}

export function deleteFolder(folderId) {
  const history = load();
  const idx = history.folders.findIndex(f => f.id === folderId);
  if (idx === -1) return history;
  const [removed] = history.folders.splice(idx, 1);
  // Move orphaned scans to default folder
  const def = history.folders.find(f => f.id === 'default') ?? history.folders[0];
  if (def && removed.scans.length > 0) {
    def.scans.unshift(...removed.scans);
  }
  return save(history);
}

export function renameScan(scanId, name) {
  const history = load();
  for (const folder of history.folders) {
    const scan = folder.scans.find(s => s.id === scanId);
    if (scan) { scan.name = name; break; }
  }
  return save(history);
}

export function moveScan(scanId, targetFolderId) {
  const history = load();
  let scan = null;
  for (const folder of history.folders) {
    const idx = folder.scans.findIndex(s => s.id === scanId);
    if (idx !== -1) { [scan] = folder.scans.splice(idx, 1); break; }
  }
  if (scan) {
    const target = history.folders.find(f => f.id === targetFolderId);
    if (target) target.scans.unshift(scan);
  }
  return save(history);
}

export function deleteScan(scanId) {
  const history = load();
  for (const folder of history.folders) {
    const idx = folder.scans.findIndex(s => s.id === scanId);
    if (idx !== -1) { folder.scans.splice(idx, 1); break; }
  }
  return save(history);
}
