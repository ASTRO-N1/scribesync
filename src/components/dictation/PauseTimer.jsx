// src/components/dictation/PauseTimer.jsx
import { useEffect, useState } from 'react';

export default function PauseTimer({ endTime, totalDurationMs, isSpeaking = false }) {
  const [remainingSec, setRemainingSec] = useState(0);
  const [percentage, setPercentage] = useState(100);

  useEffect(() => {
    if (!endTime) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const diff = Math.max(0, endTime - now);
      setRemainingSec(Number((diff / 1000).toFixed(1)));

      if (totalDurationMs && totalDurationMs > 0) {
        setPercentage(Math.max(0, Math.min(100, (diff / totalDurationMs) * 100)));
      }

      if (diff <= 0) {
        clearInterval(interval);
      }
    }, 40);

    return () => clearInterval(interval);
  }, [endTime, totalDurationMs]);

  return (
    <div className="pause-timer-container">
      <div className="pause-timer-header">
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {isSpeaking ? '🎙️ Dictating — write as you listen' : '✍️ Writing pause'}
        </span>
        <span style={{ color: 'var(--color-accent-light)', fontWeight: 'var(--weight-bold)', fontFamily: 'var(--font-mono)' }}>
          {remainingSec}s
        </span>
      </div>
      <div className="pause-timer-track">
        <div
          className="pause-timer-fill"
          style={{ width: `${percentage}%`, transition: 'width 0.04s linear' }}
        />
      </div>
    </div>
  );
}
