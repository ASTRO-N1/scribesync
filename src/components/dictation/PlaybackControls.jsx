// src/components/dictation/PlaybackControls.jsx
import { DICTATION_STATES } from '../../constants';

export default function PlaybackControls({
  state,
  onReady,
  onReplay,
  onSkip,
  onPauseResume,
}) {
  const isPaused = state === DICTATION_STATES.PAUSED_BY_USER;
  const isSpeaking = state === DICTATION_STATES.SPEAKING;

  const canPressReady =
    state === DICTATION_STATES.PAUSED_WAITING ||
    state === DICTATION_STATES.WAITING_READY ||
    state === DICTATION_STATES.SPEAKING;

  return (
    <div className="playback-controls">
      {/* Replay */}
      <button
        type="button"
        className="btn btn-secondary btn-icon"
        onClick={onReplay}
        title="Replay chunk (Press R)"
      >
        ↺
      </button>

      {/* Pause/Resume */}
      <button
        type="button"
        className="btn btn-secondary btn-icon"
        onClick={onPauseResume}
        title={isPaused ? 'Resume (Press P)' : 'Pause (Press P)'}
      >
        {isPaused ? '▶' : '⏸'}
      </button>

      {/* Ready CTA */}
      <button
        type="button"
        className="btn-ready"
        onClick={onReady}
        disabled={!canPressReady}
        title="Ready / Next chunk (Press Space)"
      >
        ✓ Done Writing (Space)
      </button>

      {/* Skip */}
      <button
        type="button"
        className="btn btn-secondary btn-icon"
        onClick={onSkip}
        title="Skip chunk (Press →)"
      >
        ⏭
      </button>
    </div>
  );
}
