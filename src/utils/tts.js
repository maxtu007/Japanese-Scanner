// TTS — uses native AVSpeechSynthesizer via Capacitor plugin on iOS,
// falls back to Web Speech API on desktop/web.
// window.speechSynthesis routes through the accessibility system in WKWebView
// and produces no audio — the native plugin is required for iOS.

import { Capacitor } from '@capacitor/core';
import { TextToSpeech } from '@capacitor-community/text-to-speech';

const IS_NATIVE = Capacitor.isNativePlatform();

// ── State ─────────────────────────────────────────────────────────────────────
let _active = false;
let _cancelFlag = { cancelled: false }; // object so inner async loops can see mutations
let _idx = 0;
let _onInterrupt = null;

// ── Native (iOS) sequential speaker ──────────────────────────────────────────
async function _speakNative(sentences, startIdx, { onProgress, onEnd } = {}) {
  const flag = _cancelFlag;
  _idx = startIdx;

  for (let i = startIdx; i < sentences.length; i++) {
    if (flag.cancelled) break;
    _idx = i;
    try {
      await TextToSpeech.speak({
        text:     sentences[i],
        lang:     'ja-JP',
        rate:     0.9,
        pitch:    1.0,
        volume:   1.0,
        category: 'playback',
      });
    } catch (_) {
      // interrupted by stop() — exit loop cleanly
      break;
    }
    if (flag.cancelled) break;
    _idx = i + 1;
    onProgress?.(_idx / sentences.length);
  }

  if (!flag.cancelled) {
    _active = false;
    onEnd?.();
  }
}

// ── Web Speech API fallback (desktop) ─────────────────────────────────────────
let _webSentences = [];
let _webOnProgress = null;
let _webOnEnd = null;

function _webSpeak() {
  if (!_active || _idx >= _webSentences.length) {
    _active = false;
    _webOnEnd?.();
    return;
  }

  const u = new SpeechSynthesisUtterance(_webSentences[_idx]);
  u.lang = 'ja-JP';
  u.rate = 0.9;

  u.onend = () => {
    _idx++;
    _webOnProgress?.(_idx / _webSentences.length);
    _webSpeak();
  };

  u.onerror = (e) => {
    if (e.error === 'interrupted' || e.error === 'canceled') return;
    _idx++;
    _webSpeak();
  };

  window.speechSynthesis.speak(u);
}

// ── Public API ────────────────────────────────────────────────────────────────

export function speakFrom(sentences, startIdx, { onProgress, onEnd } = {}) {
  _cancelInternal();

  const filtered = sentences.filter(s => s.trim().length > 0);
  if (!filtered.length) { onEnd?.(); return; }

  _active = true;
  _idx = Math.max(0, Math.min(startIdx, filtered.length - 1));

  if (IS_NATIVE) {
    _cancelFlag = { cancelled: false };
    _speakNative(filtered, _idx, { onProgress, onEnd });
  } else {
    _webSentences = filtered;
    _webOnProgress = onProgress ?? null;
    _webOnEnd = onEnd ?? null;
    _webSpeak();
  }
}

export function speakOne(text) {
  if (_active) {
    _active = false;
    _cancelFlag.cancelled = true;
    _webOnProgress = null;
    _webOnEnd = null;
    _onInterrupt?.();
  }

  if (IS_NATIVE) {
    TextToSpeech.stop().catch(() => {});
    TextToSpeech.speak({ text, lang: 'ja-JP', rate: 0.85, pitch: 1.0, volume: 1.0, category: 'playback' }).catch(() => {});
  } else {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ja-JP';
    u.rate = 0.85;
    window.speechSynthesis.speak(u);
  }
}

export function cancel() {
  _cancelInternal();
}

export function getResumeIdx() {
  return _idx;
}

export function setInterruptListener(fn) {
  _onInterrupt = fn;
}

function _cancelInternal() {
  _active = false;
  _cancelFlag.cancelled = true;
  _webOnProgress = null;
  _webOnEnd = null;
  if (IS_NATIVE) {
    TextToSpeech.stop().catch(() => {});
  } else {
    window.speechSynthesis.cancel();
  }
}
