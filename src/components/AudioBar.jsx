import { useState, useEffect, useRef } from 'react';
import { speakFrom, cancel, getResumeIdx, setInterruptListener } from '../utils/tts';

function fmt(s) {
  const clamped = Math.max(0, Math.floor(s));
  return `${Math.floor(clamped / 60)}:${String(clamped % 60).padStart(2, '0')}`;
}

export default function AudioBar({ sentences }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  // resumeIdx tracks which sentence to start from on next play
  const [resumeIdx, setResumeIdx] = useState(0);
  const timerRef = useRef(null);
  const elapsedRef = useRef(0);

  // When speakOne() interrupts full-text playback: pause (keep progress + elapsed)
  useEffect(() => {
    setInterruptListener(() => {
      clearInterval(timerRef.current);
      setResumeIdx(getResumeIdx());
      setPlaying(false);
      // progress and elapsed intentionally NOT reset
    });
    return () => setInterruptListener(null);
  }, []);

  // Full reset when a new scan is loaded (sentences reference only changes on new tokenBlocks)
  useEffect(() => {
    cancel();
    clearInterval(timerRef.current);
    setPlaying(false);
    setProgress(0);
    setElapsed(0);
    elapsedRef.current = 0;
    setResumeIdx(0);
  }, [sentences]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancel();
      clearInterval(timerRef.current);
    };
  }, []);

  function toggle() {
    if (playing) {
      // Pause: save position then stop speech
      const savedIdx = getResumeIdx();
      cancel();
      clearInterval(timerRef.current);
      setResumeIdx(savedIdx);
      setPlaying(false);
      return;
    }

    // Play / Resume
    const startIdx = resumeIdx;

    // Only reset progress + elapsed if starting fresh from the beginning
    if (startIdx === 0) {
      setProgress(0);
      setElapsed(0);
      elapsedRef.current = 0;
    }

    timerRef.current = setInterval(() => {
      elapsedRef.current += 1;
      setElapsed(elapsedRef.current);
    }, 1000);

    setPlaying(true);

    speakFrom(sentences, startIdx, {
      onProgress: (r) => setProgress(r),
      onEnd: () => {
        setPlaying(false);
        clearInterval(timerRef.current);
        setResumeIdx(0); // finished — next press starts fresh
      },
    });
  }

  // Estimate total time: ~5.5 chars/sec at rate 0.9
  const totalChars = sentences.reduce((sum, s) => sum + s.length, 0);
  const estimatedSecs = Math.max(5, Math.round(totalChars / 5.5));

  return (
    <div className="audio-bar">
      <button className="audio-play-btn" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}>
        {playing ? (
          <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
            <rect x="5" y="4" width="4" height="16" rx="1"/>
            <rect x="15" y="4" width="4" height="16" rx="1"/>
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
            <polygon points="6 3 20 12 6 21"/>
          </svg>
        )}
      </button>

      <span className="audio-time">{fmt(elapsed)}</span>

      <div className="audio-track">
        <div className="audio-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>

      <span className="audio-time">{fmt(estimatedSecs)}</span>
    </div>
  );
}
