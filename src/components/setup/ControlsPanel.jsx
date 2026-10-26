// src/components/setup/ControlsPanel.jsx
import { LIMITS, KOKORO_VOICES } from '../../constants';

export default function ControlsPanel({
  settings,
  onSettingsChange,
  onStart,
  canStart,
  kokoroTTS = {},
  profile = {},
}) {
  const update = (key, value) => onSettingsChange({ ...settings, [key]: value });

  return (
    <div className="controls-card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
        <h2 className="card-title" style={{ margin: 0 }}>
          <span>⚙️</span> Dictation Pacing & Mode
        </h2>
        {profile?.is_calibrated ? (
          <div className="difficulty-badge easy">
            ✓ Calibrated to {profile.handwriting_wpm} WPM
          </div>
        ) : (
          <div className="difficulty-badge medium">
            Default Tuning (22 WPM)
          </div>
        )}
      </div>

      {/* Mode Selection */}
      <div className="mode-toggle">
        {[
          { id: 'adaptive', label: '🧠 Adaptive AI', sub: 'Learns as you write' },
          { id: 'manual', label: '✋ Manual Pacing', sub: 'Waits for Spacebar' },
          { id: 'auto', label: '⏱ Fixed Auto', sub: 'Strict timer cadence' },
        ].map(m => (
          <button
            key={m.id}
            type="button"
            className={`mode-toggle-btn ${settings.mode === m.id ? 'active' : ''}`}
            onClick={() => update('mode', m.id)}
          >
            <span>{m.label}</span>
            <small style={{ fontSize: '10px', opacity: 0.8 }}>{m.sub}</small>
          </button>
        ))}
      </div>

      <div className="mode-desc">
        {settings.mode === 'adaptive' && (
          <span>
            <strong>Adaptive AI Mode:</strong> Chunks dynamically (more words for simple text, fewer for complex technical terms). Auto-adjusts pauses and learns your handwriting speed continuously from replays and timing.
          </span>
        )}
        {settings.mode === 'manual' && (
          <span>
            <strong>Manual Mode:</strong> Speaks one chunk at a time and waits for you to finish writing. Press <strong>Space</strong> or click Ready whenever your pen finishes.
          </span>
        )}
        {settings.mode === 'auto' && (
          <span>
            <strong>Fixed Auto Mode:</strong> Speaks chunks with standard pauses between them without dynamic adjustments.
          </span>
        )}
      </div>

      {/* Controls Grid */}
      <div className="controls-grid">
        {/* Pause slider */}
        <div className="slider-group">
          <div className="slider-header">
            <span className="slider-label">Base Pause Duration</span>
            <span className="slider-value">{settings.pauseDuration}s</span>
          </div>
          <input
            type="range"
            className="slider-input"
            min={LIMITS.MIN_PAUSE}
            max={LIMITS.MAX_PAUSE}
            step={0.2}
            value={settings.pauseDuration}
            onChange={e => update('pauseDuration', Number(e.target.value))}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
            <span>1s (brisk)</span>
            <span>15s (deliberate)</span>
          </div>
        </div>

        {/* Speed slider */}
        <div className="slider-group">
          <div className="slider-header">
            <span className="slider-label">Dictation Speech Rate</span>
            <span className="slider-value">{settings.speakingSpeed}×</span>
          </div>
          <input
            type="range"
            className="slider-input"
            min={LIMITS.MIN_SPEED}
            max={LIMITS.MAX_SPEED}
            step={0.05}
            value={settings.speakingSpeed}
            onChange={e => update('speakingSpeed', Number(e.target.value))}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
            <span>0.6× (slow)</span>
            <span>1.8× (fast)</span>
          </div>
        </div>

        {/* Kokoro Voice Selection */}
        <div className="slider-group" style={{ gridColumn: '1 / -1' }}>
          <div className="slider-header">
            <span className="slider-label">Kokoro Neural Voice</span>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-accent-light)' }}>
              Kokoro-82M ONNX · 100% Free & Open-Source
            </span>
          </div>
          <div className="voice-select-wrapper">
            <select
              className="form-select"
              value={settings.voice}
              onChange={e => update('voice', e.target.value)}
            >
              <optgroup label="Kokoro-82M Neural Voices">
                {KOKORO_VOICES.map(v => (
                  <option key={v.id} value={v.id}>
                    🎙️ {v.label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="System Fallback">
                <option value="__fallback__">🌐 Browser Native Voice</option>
              </optgroup>
            </select>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                kokoroTTS?.testVoice?.(settings.voice, settings.speakingSpeed);
              }}
              disabled={!kokoroTTS?.isModelLoaded || kokoroTTS?.isSpeaking}
              title="Test Voice preview"
            >
              {kokoroTTS?.isSpeaking ? '🔊 Speaking…' : '🔊 Test Voice'}
            </button>
          </div>
        </div>
      </div>

      <div className="controls-footer">
        <button
          id="start-dictation-btn"
          className="btn btn-primary btn-lg"
          onClick={onStart}
          disabled={!canStart || !kokoroTTS?.isModelLoaded}
          style={{ minWidth: '240px' }}
        >
          {!kokoroTTS?.isModelLoaded ? 'Loading Kokoro Model…' : '▶ Start Dictation Session'}
        </button>
      </div>
    </div>
  );
}
