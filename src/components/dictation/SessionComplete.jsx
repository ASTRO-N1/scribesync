// src/components/dictation/SessionComplete.jsx

export default function SessionComplete({
  stats,
  isCalibration,
  calibratedProfile,
  onStartWithAI,
  onRestart,
  onClose,
}) {
  const { totalChunks, replayCount, avgReadySec, totalWords, changes } = stats;

  return (
    <div className="dictation-overlay">
      <div className="dictation-panel animate-scaleIn">
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3.2rem', marginBottom: 'var(--space-2)' }}>
            {isCalibration ? '🎯' : '🎉'}
          </div>

          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-3xl)', fontWeight: 'var(--weight-extrabold)', marginBottom: 'var(--space-1)' }}>
            {isCalibration ? 'Calibration Complete!' : 'Dictation Complete!'}
          </h2>

          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-5)' }}>
            {isCalibration
              ? 'Your handwriting pace fingerprint has been measured and calibrated.'
              : 'Great writing session! Your adaptive pacing model has been refined.'}
          </p>

          {/* Stats Grid */}
          <div className="session-stats-grid">
            {isCalibration && calibratedProfile ? (
              <>
                <div className="stat-box">
                  <div className="stat-value">{calibratedProfile.handwriting_wpm}</div>
                  <div className="stat-label">Measured WPM</div>
                </div>
                <div className="stat-box">
                  <div className="stat-value">{calibratedProfile.easy_chunk_capacity}w</div>
                  <div className="stat-label">Simple Chunk Size</div>
                </div>
                <div className="stat-box">
                  <div className="stat-value">{calibratedProfile.hard_chunk_capacity}w</div>
                  <div className="stat-label">Technical Chunk Size</div>
                </div>
              </>
            ) : (
              <>
                <div className="stat-box">
                  <div className="stat-value">{totalChunks}</div>
                  <div className="stat-label">Chunks Completed</div>
                </div>
                <div className="stat-box">
                  <div className="stat-value">{totalWords || '—'}</div>
                  <div className="stat-label">Words Written</div>
                </div>
                <div className="stat-box">
                  <div className="stat-value">{replayCount}</div>
                  <div className="stat-label">Replays Needed</div>
                </div>
              </>
            )}
          </div>

          {/* Learned Insights Section */}
          {changes && changes.length > 0 && (
            <div className="learned-insights-box">
              <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)', color: 'var(--color-primary-light)', marginBottom: 'var(--space-2)' }}>
                🧠 What ScribeSync learned about your rhythm:
              </h4>
              <ul style={{ paddingLeft: 'var(--space-4)', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
                {changes.map((c, i) => (
                  <li key={i}>{c.text || c}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center', marginTop: 'var(--space-4)' }}>
            {isCalibration ? (
              <button
                type="button"
                className="btn btn-primary btn-lg"
                onClick={onStartWithAI}
              >
                🚀 Continue to AI Dictation Mode
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={onClose}
                >
                  ← Back to Editor
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={onRestart}
                >
                  Dictate Another Text
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
