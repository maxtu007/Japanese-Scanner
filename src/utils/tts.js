// Web Speech API wrapper for Japanese TTS

let _sentences = [];
let _idx = 0;
let _onProgress = null;
let _onEnd = null;
let _active = false;
let _onInterrupt = null; // called when speakOne() interrupts an active speakAll

function _speak() {
  if (!_active || _idx >= _sentences.length) {
    _active = false;
    _onEnd?.();
    return;
  }

  const u = new SpeechSynthesisUtterance(_sentences[_idx]);
  u.lang = 'ja-JP';
  u.rate = 0.9;

  u.onend = () => {
    _idx++;
    _onProgress?.(_idx / _sentences.length);
    _speak();
  };

  u.onerror = (e) => {
    if (e.error === 'interrupted' || e.error === 'canceled') return;
    _idx++;
    _speak();
  };

  window.speechSynthesis.speak(u);
}

/**
 * Speak an array of sentences end-to-end.
 * onProgress(ratio) fires after each sentence completes.
 * onEnd() fires when all sentences finish.
 */
export function speakAll(sentences, { onProgress, onEnd } = {}) {
  _cancelInternal();
  _sentences = sentences.filter(s => s.trim().length > 0);
  _idx = 0;
  _onProgress = onProgress ?? null;
  _onEnd = onEnd ?? null;
  _active = true;
  _speak();
}

/**
 * Resume (or start) playback from a specific sentence index.
 * Use this after a pause so the progress bar continues from where it left off.
 */
export function speakFrom(sentences, idx, { onProgress, onEnd } = {}) {
  _cancelInternal();
  _sentences = sentences.filter(s => s.trim().length > 0);
  _idx = Math.max(0, Math.min(idx, _sentences.length - 1));
  _onProgress = onProgress ?? null;
  _onEnd = onEnd ?? null;
  _active = true;
  _speak();
}

/** Speak a single word / phrase. Pauses (not stops) any active speakAll. */
export function speakOne(text) {
  if (_active) {
    // Notify AudioBar to enter paused state (keeps progress + elapsed)
    _active = false;
    _onProgress = null;
    _onEnd = null;
    _onInterrupt?.();
  }
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'ja-JP';
  u.rate = 0.85;
  window.speechSynthesis.speak(u);
}

/** Cancel all speech and clear state. Does NOT reset _idx — call getResumeIdx() before this if needed. */
export function cancel() {
  _cancelInternal();
}

/** Returns the index of the next sentence to speak (useful for saving resume position). */
export function getResumeIdx() {
  return _idx;
}

/**
 * Register a callback that fires when speakOne() interrupts an active speakAll.
 * AudioBar uses this to switch to paused state without resetting progress.
 */
export function setInterruptListener(fn) {
  _onInterrupt = fn;
}

// Internal cancel — does not fire _onInterrupt
function _cancelInternal() {
  _active = false;
  _onProgress = null;
  _onEnd = null;
  window.speechSynthesis.cancel();
}
