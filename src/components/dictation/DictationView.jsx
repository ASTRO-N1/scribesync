// src/components/dictation/DictationView.jsx
import { DICTATION_STATES } from '../../constants';
import ChunkDisplay from './ChunkDisplay';
import PauseTimer from './PauseTimer';
import PlaybackControls from './PlaybackControls';
import BufferingView from './BufferingView';

export default function DictationView({
  state,
  currentChunk,
  currentIndex,
  totalChunks,
  progressPct,
  pauseStartTime,
  pauseEndTime,
  realtimeInsight,
  isCalibration,
  bufferState,
  onStartImmediately,
  onReady,
  onReplay,
  onSkip,
  onPauseResume,
  onStop,
}) {
  const isBuffering = state === DICTATION_STATES.BUFFERING;
  const isSpeaking = state === DICTATION_STATES.SPEAKING;
  const isPaused = state === DICTATION_STATES.PAUSED_BY_USER;
  const isAutoWaiting = state === DICTATION_STATES.PAUSED_WAITING;
  const isManualWaiting = state === DICTATION_STATES.WAITING_READY;

  const totalPauseDurationMs = pauseEndTime && pauseStartTime
    ? pauseEndTime - pauseStartTime
    : 3000;

  return (
    <div className="dictation-overlay">
      <div className="dictation-panel">
        {isBuffering ? (
          <BufferingView
            bufferState={bufferState}
            onStartImmediately={onStartImmediately}
            onStop={onStop}
            isCalibration={isCalibration}
          />
        ) : (
          <>
            {/* Top bar */}
            <div className="dictation-header-bar">
              <div className="chunk-meta-info">
                <span style={{ fontWeight: 'var(--weight-bold)', color: 'var(--color-primary-light)' }}>
                  {isCalibration ? '⚡ CALIBRATION RUN' : 'DICTATING'}
                </span>
                <span>•</span>
                <span>Chunk {currentIndex + 1} of {totalChunks}</span>

                {/* Live Background Buffer Badge */}
                {bufferState && (
                  <div
                    className={`buffer-status-badge ${
                      bufferState.isAllBuffered ? 'complete' : 'buffering'
                    }`}
                    title={
                      bufferState.isAllBuffered
                        ? 'All audio clips pre-cached in memory for zero-latency response'
                        : `Pre-generating audio in background: ${bufferState.bufferedCount} of ${totalChunks} ready`
                    }
                  >
                    {!bufferState.isAllBuffered && <span className="pulse-dot" />}
                    {bufferState.isAllBuffered ? (
                      <span>⚡ 100% Buffered</span>
                    ) : (
                      <span>⚡ Buffer: {bufferState.bufferedCount}/{totalChunks}</span>
                    )}
                  </div>
                )}
              </div>

              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={onStop}
                title="Stop & exit (Esc)"
              >
                ✕ Exit
              </button>
            </div>

            {/* Audio Waveform while speaking */}
            {isSpeaking ? (
              <div className="waveform">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={i}
                    className="waveform-bar"
                    style={{ height: `${20 + (i % 3) * 10}px` }}
                  />
                ))}
              </div>
            ) : (
              <div style={{ height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', letterSpacing: '0.05em' }}>
                  {isPaused ? '⏸ PAUSED' : '✍️ WRITE AT YOUR OWN PACE'}
                </span>
              </div>
            )}

            {/* Chunk Text Display */}
            <ChunkDisplay
              chunk={currentChunk}
              isSpeaking={isSpeaking}
            />

            {/* Real-time AI Adaptation Banner */}
            {realtimeInsight && (
              <div className="realtime-adaptation-banner animate-fadeInDown">
                <span>🧠</span>
                <span>{realtimeInsight}</span>
              </div>
            )}

            {/* Dynamic Handwriting & Pause Timer (Starts on first word dictated) */}
            {(isSpeaking || isAutoWaiting) && pauseEndTime && (
              <PauseTimer
                endTime={pauseEndTime}
                totalDurationMs={totalPauseDurationMs}
                isSpeaking={isSpeaking}
              />
            )}

            {/* Manual waiting indicator */}
            {isManualWaiting && (
              <div className="dictation-status-pill animate-pulse">
                <span>✍️</span>
                <span>Write this down. Press <strong>Spacebar</strong> or click <strong>Done Writing</strong> when your pen lifts.</span>
              </div>
            )}

            {/* Paused by user indicator */}
            {isPaused && (
              <div className="dictation-status-pill" style={{ color: 'var(--color-warning)', borderColor: 'rgba(245,158,11,0.3)' }}>
                <span>⏸</span>
                <span>Paused. Press <strong>P</strong> or click Resume to continue.</span>
              </div>
            )}

            {/* Controls */}
            <PlaybackControls
              state={state}
              onReady={onReady}
              onReplay={onReplay}
              onSkip={onSkip}
              onPauseResume={onPauseResume}
            />

            {/* Overall progress */}
            <div className="overall-progress">
              <div className="progress-label">
                <span>Session Progress</span>
                <span>{progressPct}%</span>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${progressPct}%` }} />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
