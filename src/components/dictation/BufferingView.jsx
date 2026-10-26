// src/components/dictation/BufferingView.jsx
import React from 'react';

export default function BufferingView({
  bufferState,
  onStartImmediately,
  onStop,
  isCalibration,
}) {
  const {
    bufferedCount = 0,
    targetCount = 5,
    totalCount = 0,
    currentBufferingText = '',
  } = bufferState || {};

  const targetPct = targetCount > 0 ? Math.min(100, Math.round((bufferedCount / targetCount) * 100)) : 0;
  const totalPct = totalCount > 0 ? Math.min(100, Math.round((bufferedCount / totalCount) * 100)) : 0;
  const canStartNow = bufferedCount >= 1;

  return (
    <div className="buffering-view animate-fadeIn">
      {/* Top Header */}
      <div className="dictation-header-bar">
        <div className="chunk-meta-info">
          <span className="buffer-meta-tag">
            {isCalibration ? '⚡ CALIBRATION PIPELINE' : '⚡ AUDIO BUFFER PIPELINE'}
          </span>
          <span>•</span>
          <span style={{ color: 'var(--color-primary-light)', fontSize: 'var(--text-xs)' }}>
            Zero-Latency Audio
          </span>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={onStop}
          title="Cancel & Exit (Esc)"
        >
          ✕ Cancel
        </button>
      </div>

      {/* Hero Visual Area */}
      <div className="buffering-hero">
        <div className="buffering-glow-orb">
          <div className="buffering-pulse-rings" />
          <div className="waveform buffering-mini-wave">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="waveform-bar"
                style={{
                  height: `${14 + (i % 3) * 8}px`,
                  animationDuration: `${0.6 + (i % 3) * 0.2}s`,
                }}
              />
            ))}
          </div>
        </div>

        <div className="buffering-text-group">
          <h2 className="buffering-title">Pre-buffering Audio Chunks</h2>
          <p className="buffering-desc">
            Synthesizing the first {targetCount} chunks into memory so playback starts instantly
            without any waiting after pressing Spacebar. The remaining chunks will convert in the background.
          </p>
        </div>
      </div>

      {/* Progress Box */}
      <div className="buffering-progress-box">
        <div className="buffering-progress-header">
          <span className="buffering-status-label">
            <span className="pulse-dot" />
            Buffer Ready: {bufferedCount} of {targetCount} initial chunks
          </span>
          <span className="buffering-pct-badge">{targetPct}%</span>
        </div>

        <div className="buffering-progress-track">
          <div
            className="buffering-progress-fill"
            style={{ width: `${targetPct}%` }}
          />
        </div>

        {totalCount > targetCount && (
          <div className="buffering-overall-hint">
            <span>Overall document: {bufferedCount}/{totalCount} chunks ({totalPct}%)</span>
            <span className="buffering-subtext">Background converter active</span>
          </div>
        )}
      </div>

      {/* Current synthesizing chunk preview */}
      {currentBufferingText && (
        <div className="buffering-preview-card">
          <div className="buffering-preview-label">Currently synthesizing:</div>
          <div className="buffering-preview-text">
            &ldquo;{currentBufferingText.length > 90
              ? currentBufferingText.slice(0, 90) + '…'
              : currentBufferingText}&rdquo;
          </div>
        </div>
      )}

      {/* Visual Chunk Pips */}
      {totalCount > 0 && (
        <div className="chunk-pips-container">
          <div className="chunk-pips-label">
            Pipeline Queue Status:
            {totalCount > 20 && (
              <span style={{ marginLeft: 'var(--space-2)', color: 'var(--color-primary-light)' }}>
                (Showing first 20 of {totalCount} chunks)
              </span>
            )}
          </div>
          <div className="chunk-pips-grid">
            {Array.from({ length: Math.min(20, totalCount) }).map((_, idx) => {
              const isReady = idx < bufferedCount;
              const isCurrent = idx === bufferedCount;
              const isTargetZone = idx < targetCount;

              let pipClass = 'pip-queued';
              if (isReady) pipClass = 'pip-ready';
              else if (isCurrent) pipClass = 'pip-generating';
              else if (isTargetZone) pipClass = 'pip-target';

              return (
                <div
                  key={idx}
                  className={`chunk-pip ${pipClass}`}
                  title={`Chunk ${idx + 1}: ${isReady ? 'Ready in memory' : isCurrent ? 'Converting now' : 'Queued'}`}
                >
                  {idx + 1}
                </div>
              );
            })}
            {totalCount > 20 && (
              <div
                className="chunk-pip pip-queued"
                style={{ padding: '0 8px', fontSize: '10px', minWidth: 'auto' }}
                title={`${totalCount - 20} additional chunks queued for background synthesis`}
              >
                +{totalCount - 20} more
              </div>
            )}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="buffering-actions">
        <button
          type="button"
          className="btn btn-primary btn-ready"
          onClick={onStartImmediately}
          disabled={!canStartNow}
          title={canStartNow ? 'Start dictation now with already-buffered chunks' : 'Buffering initial audio...'}
        >
          {canStartNow
            ? `⚡ Start Dictating Now (${bufferedCount} Ready)`
            : '⏳ Buffering Audio Pipeline…'}
        </button>
      </div>
    </div>
  );
}
