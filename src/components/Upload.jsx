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
    <div className="upload-container">
      <p className="upload-subtitle">
        Upload an image containing Japanese text.
      </p>

      <div
        className={`upload-zone${dragOver ? ' drag-over' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
        aria-label="Upload image"
      >
        <div className="upload-icon">↑</div>
        <p className="upload-label">Drop image here or click to upload</p>
        <p className="upload-hint">PNG or JPG · max 5 MB</p>
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
