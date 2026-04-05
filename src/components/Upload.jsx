import { useState, useRef } from 'react';

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = ['image/png', 'image/jpeg'];

export default function Upload({ onFile }) {
  const [dragOver, setDragOver] = useState(false);
  const [fileError, setFileError] = useState(null);
  const inputRef = useRef(null);

  function validate(file) {
    if (!ACCEPT.includes(file.type)) return 'Please upload a PNG or JPG image.';
    if (file.size > MAX_BYTES) return 'Image must be under 5 MB.';
    return null;
  }

  function handleFile(file) {
    const err = validate(file);
    if (err) { setFileError(err); return; }
    setFileError(null);
    onFile(file);
  }

  function onDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function onInputChange(e) {
    const file = e.target.files[0];
    if (file) handleFile(file);
    e.target.value = '';
  }

  return (
    <div className="upload-bar-wrap">
      <div
        className={`upload-bar${dragOver ? ' drag-over' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
        aria-label="Upload image"
      >
        <div className="upload-bar-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="#4c6ef5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
        </div>
        <div className="upload-bar-text">
          <div className="upload-bar-label">Upload an image</div>
          <div className="upload-bar-hint">PNG · JPG · max 5 MB</div>
        </div>
        <div className="upload-bar-browse">
          Browse
          <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"/>
            <polyline points="13 6 19 12 13 18"/>
          </svg>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".png,.jpg,.jpeg"
          onChange={onInputChange}
          style={{ display: 'none' }}
        />
      </div>
      {fileError && <p className="file-error">{fileError}</p>}
    </div>
  );
}
