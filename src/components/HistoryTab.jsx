import { useState } from 'react';
import {
  loadHistory,
  createFolder,
  renameFolder,
  deleteFolder,
  renameScan,
  moveScan,
  deleteScan,
} from '../utils/historyStorage';

function formatDate(isoStr) {
  const d = new Date(isoStr);
  const date = d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();
  return `${date} · ${time}`;
}

// Returns flat list of all scans across all folders
function getAllScans(history) {
  return history.folders.flatMap(f =>
    f.scans.map(s => ({ ...s, folderName: f.name, folderId: f.id }))
  );
}

export default function HistoryTab({ onOpenScan }) {
  const [history, setHistory] = useState(() => loadHistory());
  const [expandedFolders, setExpandedFolders] = useState(new Set(['default']));
  const [menuOpen, setMenuOpen] = useState(false);

  // Dialog state machine
  // type: 'create-folder' | 'rename-folder' | 'rename-scan' | 'move-scan' | 'delete-folder' | 'delete-scan'
  // folderId / scanId: null = need to pick; string = already chosen
  const [dialog, setDialog] = useState(null);
  const [inputValue, setInputValue] = useState('');

  function refresh(updated) {
    setHistory(updated);
  }

  function toggleFolder(id) {
    setExpandedFolders(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  }

  function openMenu() {
    setMenuOpen(true);
  }

  function closeMenu() {
    setMenuOpen(false);
  }

  function openAction(type) {
    closeMenu();
    setInputValue('');
    setDialog({ type, folderId: null, scanId: null, targetFolderId: null });
  }

  function closeDialog() {
    setDialog(null);
    setInputValue('');
  }

  // ── Dialog handlers ──

  function handleCreateFolder() {
    const name = inputValue.trim();
    if (!name) return;
    refresh(createFolder(name));
    closeDialog();
  }

  function handlePickFolderForRename(folderId) {
    const folder = history.folders.find(f => f.id === folderId);
    setInputValue(folder?.name ?? '');
    setDialog(d => ({ ...d, folderId }));
  }

  function handleRenameFolder() {
    const name = inputValue.trim();
    if (!name || !dialog.folderId) return;
    refresh(renameFolder(dialog.folderId, name));
    closeDialog();
  }

  function handlePickScanForRename(scanId) {
    const scan = getAllScans(history).find(s => s.id === scanId);
    setInputValue(scan?.name ?? '');
    setDialog(d => ({ ...d, scanId }));
  }

  function handleRenameScan() {
    const name = inputValue.trim();
    if (!name || !dialog.scanId) return;
    refresh(renameScan(dialog.scanId, name));
    closeDialog();
  }

  function handlePickScanForMove(scanId) {
    setDialog(d => ({ ...d, scanId }));
  }

  function handlePickTargetFolder(targetFolderId) {
    refresh(moveScan(dialog.scanId, targetFolderId));
    closeDialog();
  }

  function handlePickFolderForDelete(folderId) {
    setDialog(d => ({ ...d, folderId }));
  }

  function handleDeleteFolder() {
    if (!dialog.folderId) return;
    refresh(deleteFolder(dialog.folderId));
    closeDialog();
  }

  function handlePickScanForDelete(scanId) {
    setDialog(d => ({ ...d, scanId }));
  }

  function handleDeleteScan() {
    if (!dialog.scanId) return;
    refresh(deleteScan(dialog.scanId));
    closeDialog();
  }

  // ── Dialog content renderer ──

  function renderDialog() {
    if (!dialog) return null;
    const { type, folderId, scanId } = dialog;
    const allScans = getAllScans(history);

    // CREATE FOLDER
    if (type === 'create-folder') {
      return (
        <DialogShell title="Create Folder" onClose={closeDialog}>
          <input
            className="hist-dialog-input"
            placeholder="Folder name"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            autoFocus
            onKeyDown={e => { if (e.key === 'Enter') handleCreateFolder(); if (e.key === 'Escape') closeDialog(); }}
          />
          <div className="hist-dialog-actions">
            <button className="btn-ghost" onClick={closeDialog}>Cancel</button>
            <button className="btn-accent" onClick={handleCreateFolder}>Create</button>
          </div>
        </DialogShell>
      );
    }

    // RENAME FOLDER
    if (type === 'rename-folder') {
      if (!folderId) {
        return (
          <DialogShell title="Edit Folder Name" onClose={closeDialog}>
            <div className="hist-pick-list">
              {history.folders.map(f => (
                <button key={f.id} className="hist-pick-item" onClick={() => handlePickFolderForRename(f.id)}>
                  <FolderIcon /> {f.name}
                </button>
              ))}
            </div>
          </DialogShell>
        );
      }
      return (
        <DialogShell title="Edit Folder Name" onClose={closeDialog}>
          <input
            className="hist-dialog-input"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            autoFocus
            onKeyDown={e => { if (e.key === 'Enter') handleRenameFolder(); if (e.key === 'Escape') closeDialog(); }}
          />
          <div className="hist-dialog-actions">
            <button className="btn-ghost" onClick={closeDialog}>Cancel</button>
            <button className="btn-accent" onClick={handleRenameFolder}>Save</button>
          </div>
        </DialogShell>
      );
    }

    // RENAME SCAN
    if (type === 'rename-scan') {
      if (!scanId) {
        return (
          <DialogShell title="Edit Lesson Name" onClose={closeDialog}>
            <div className="hist-pick-list">
              {allScans.length === 0 && <p className="hist-pick-empty">No lessons yet.</p>}
              {allScans.map(s => (
                <button key={s.id} className="hist-pick-item" onClick={() => handlePickScanForRename(s.id)}>
                  <ScanIcon /><span className="hist-pick-item-text">{s.name}</span>
                </button>
              ))}
            </div>
          </DialogShell>
        );
      }
      return (
        <DialogShell title="Edit Lesson Name" onClose={closeDialog}>
          <input
            className="hist-dialog-input"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            autoFocus
            onKeyDown={e => { if (e.key === 'Enter') handleRenameScan(); if (e.key === 'Escape') closeDialog(); }}
          />
          <div className="hist-dialog-actions">
            <button className="btn-ghost" onClick={closeDialog}>Cancel</button>
            <button className="btn-accent" onClick={handleRenameScan}>Save</button>
          </div>
        </DialogShell>
      );
    }

    // MOVE SCAN
    if (type === 'move-scan') {
      if (!scanId) {
        return (
          <DialogShell title="Move Lesson" onClose={closeDialog}>
            <div className="hist-pick-list">
              {allScans.length === 0 && <p className="hist-pick-empty">No lessons yet.</p>}
              {allScans.map(s => (
                <button key={s.id} className="hist-pick-item" onClick={() => handlePickScanForMove(s.id)}>
                  <ScanIcon /><span className="hist-pick-item-text">{s.name}</span>
                  <span className="hist-pick-item-sub">{s.folderName}</span>
                </button>
              ))}
            </div>
          </DialogShell>
        );
      }
      return (
        <DialogShell title="Move to Folder" onClose={closeDialog}>
          <div className="hist-pick-list">
            {history.folders.map(f => (
              <button key={f.id} className="hist-pick-item" onClick={() => handlePickTargetFolder(f.id)}>
                <FolderIcon /> {f.name}
              </button>
            ))}
          </div>
        </DialogShell>
      );
    }

    // DELETE FOLDER
    if (type === 'delete-folder') {
      if (!folderId) {
        const deletable = history.folders.filter(f => f.id !== 'default');
        return (
          <DialogShell title="Delete Folder" onClose={closeDialog}>
            {deletable.length === 0 ? (
              <p className="hist-pick-empty">No custom folders to delete.</p>
            ) : (
              <div className="hist-pick-list">
                {deletable.map(f => (
                  <button key={f.id} className="hist-pick-item danger" onClick={() => handlePickFolderForDelete(f.id)}>
                    <TrashIcon /> {f.name}
                  </button>
                ))}
              </div>
            )}
            <div className="hist-dialog-actions">
              <button className="btn-ghost" onClick={closeDialog}>Cancel</button>
            </div>
          </DialogShell>
        );
      }
      const folderName = history.folders.find(f => f.id === folderId)?.name;
      const scanCount = history.folders.find(f => f.id === folderId)?.scans.length ?? 0;
      return (
        <DialogShell title="Delete Folder" onClose={closeDialog}>
          <p className="hist-dialog-msg">
            Delete <strong>{folderName}</strong>?
            {scanCount > 0 && <> Its {scanCount} lesson{scanCount !== 1 ? 's' : ''} will move to Default Folder.</>}
          </p>
          <div className="hist-dialog-actions">
            <button className="btn-ghost" onClick={closeDialog}>Cancel</button>
            <button className="btn-danger" onClick={handleDeleteFolder}>Delete</button>
          </div>
        </DialogShell>
      );
    }

    // DELETE SCAN
    if (type === 'delete-scan') {
      if (!scanId) {
        return (
          <DialogShell title="Delete Lesson" onClose={closeDialog}>
            <div className="hist-pick-list">
              {allScans.length === 0 && <p className="hist-pick-empty">No lessons yet.</p>}
              {allScans.map(s => (
                <button key={s.id} className="hist-pick-item danger" onClick={() => handlePickScanForDelete(s.id)}>
                  <TrashIcon /><span className="hist-pick-item-text">{s.name}</span>
                </button>
              ))}
            </div>
            <div className="hist-dialog-actions">
              <button className="btn-ghost" onClick={closeDialog}>Cancel</button>
            </div>
          </DialogShell>
        );
      }
      const scanName = allScans.find(s => s.id === scanId)?.name;
      return (
        <DialogShell title="Delete Lesson" onClose={closeDialog}>
          <p className="hist-dialog-msg">
            Delete <strong>{scanName}</strong>? This cannot be undone.
          </p>
          <div className="hist-dialog-actions">
            <button className="btn-ghost" onClick={closeDialog}>Cancel</button>
            <button className="btn-danger" onClick={handleDeleteScan}>Delete</button>
          </div>
        </DialogShell>
      );
    }

    return null;
  }

  const totalScans = history.folders.reduce((n, f) => n + f.scans.length, 0);

  return (
    <div className="history-tab">
      {/* Header */}
      <div className="history-header">
        <h1 className="history-title">History</h1>
        <button className="history-menu-btn" onClick={openMenu} aria-label="Options">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="5" r="1.8"/>
            <circle cx="12" cy="12" r="1.8"/>
            <circle cx="12" cy="19" r="1.8"/>
          </svg>
        </button>
      </div>

      {/* Folder list */}
      <div className="history-folders">
        {totalScans === 0 && (
          <p className="history-empty">No scans yet. Scan a page to get started!</p>
        )}
        {history.folders.map(folder => {
          if (folder.scans.length === 0 && history.folders.length > 1 && folder.id !== 'default') return null;
          const expanded = expandedFolders.has(folder.id);
          return (
            <div key={folder.id} className="history-folder">
              <button
                className={`history-folder-header${expanded ? ' expanded' : ''}`}
                onClick={() => toggleFolder(folder.id)}
              >
                <svg className="folder-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  {expanded
                    ? <polyline points="18 15 12 9 6 15"/>
                    : <polyline points="6 9 12 15 18 9"/>}
                </svg>
                <span className="folder-name">{folder.name}</span>
                <span className="folder-count">{folder.scans.length}</span>
              </button>

              {expanded && folder.scans.length > 0 && (
                <div className="history-scan-list">
                  {folder.scans.map(scan => (
                    <button
                      key={scan.id}
                      className="history-scan-card tappable"
                      onClick={() => onOpenScan?.(scan)}
                    >
                      {scan.thumbnail ? (
                        <img className="scan-thumb" src={scan.thumbnail} alt="" />
                      ) : (
                        <div className="scan-thumb scan-thumb-placeholder">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <rect x="3" y="3" width="18" height="18" rx="2"/>
                            <path d="M3 9h18M9 21V9"/>
                          </svg>
                        </div>
                      )}
                      <div className="scan-info">
                        <div className="scan-title">{scan.name}</div>
                        <div className="scan-date">{formatDate(scan.createdAt)}</div>
                        {scan.japanese && (
                          <div className="scan-preview">{scan.japanese.slice(0, 80)}</div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {expanded && folder.scans.length === 0 && (
                <p className="folder-empty">No lessons in this folder.</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Three-dots menu */}
      {menuOpen && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && closeMenu()}>
          <div className="hist-menu-card">
            <MenuRow icon={<FolderPlusIcon />} label="Create Folder" onClick={() => openAction('create-folder')} />
            <MenuRow icon={<PencilIcon />} label="Edit Folder Name" onClick={() => openAction('rename-folder')} />
            <MenuRow icon={<PencilIcon />} label="Edit Lesson Name" onClick={() => openAction('rename-scan')} />
            <MenuRow icon={<MoveIcon />} label="Move Lesson" onClick={() => openAction('move-scan')} />
            <MenuRow icon={<TrashIcon />} label="Delete Folder" danger onClick={() => openAction('delete-folder')} />
            <MenuRow icon={<TrashIcon />} label="Delete Lesson" danger onClick={() => openAction('delete-scan')} />
          </div>
        </div>
      )}

      {/* Action dialogs */}
      {dialog && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && closeDialog()}>
          {renderDialog()}
        </div>
      )}
    </div>
  );
}

// ── Small helper components ──

function DialogShell({ title, onClose, children }) {
  return (
    <div className="hist-dialog">
      <div className="hist-dialog-header">
        <span className="hist-dialog-title">{title}</span>
        <button className="modal-x" onClick={onClose}>✕</button>
      </div>
      {children}
    </div>
  );
}

function MenuRow({ icon, label, danger, onClick }) {
  return (
    <button className={`hist-menu-row${danger ? ' danger' : ''}`} onClick={onClick}>
      <span className={`hist-menu-icon${danger ? ' danger' : ''}`}>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

// Icons
function FolderPlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
      <line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/>
    </svg>
  );
}
function FolderIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
    </svg>
  );
}
function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  );
}
function MoveIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
      <path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
    </svg>
  );
}
function ScanIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>
    </svg>
  );
}
