// src/components/profile/ProfileModal.jsx
import { useAuth } from '../../context/AuthContext';

export default function ProfileModal({
  isOpen,
  onClose,
  profile,
  onRecalibrate,
  onResetCalibration,
}) {
  const { user } = useAuth();
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box animate-scaleIn">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
          <h2 className="modal-title" style={{ margin: 0 }}>
            <span>👤</span> Handwriting Profile
          </h2>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <p className="modal-subtitle">
          Your learned writing fingerprint and cognitive capacities. ScribeSync uses these to dynamically chunk text and time dictation pauses.
        </p>

        {/* Profile Stats Matrix */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
          <div className="stat-box">
            <div className="stat-value">{profile.handwriting_wpm} WPM</div>
            <div className="stat-label">Handwriting Pace</div>
          </div>
          <div className="stat-box">
            <div className="stat-value">{profile.ms_per_char} ms</div>
            <div className="stat-label">Time Per Letterform</div>
          </div>
          <div className="stat-box">
            <div className="stat-value">{profile.easy_chunk_capacity} words</div>
            <div className="stat-label">Simple Chunk Target</div>
          </div>
          <div className="stat-box">
            <div className="stat-value">{profile.hard_chunk_capacity} words</div>
            <div className="stat-label">Technical Chunk Target</div>
          </div>
        </div>

        {/* Overall Activity */}
        <div style={{
          background: 'var(--color-bg-input)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--space-4)',
          marginBottom: 'var(--space-6)',
        }}>
          <h4 style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 'var(--space-3)' }}>
            Practice History
          </h4>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-2)' }}>
            <span style={{ color: 'var(--color-text-secondary)' }}>Total Sessions:</span>
            <strong>{profile.total_sessions || 0}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-2)' }}>
            <span style={{ color: 'var(--color-text-secondary)' }}>Total Words Practiced:</span>
            <strong>{profile.total_words_practiced || 0} words</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)' }}>
            <span style={{ color: 'var(--color-text-secondary)' }}>Storage:</span>
            <span style={{ color: user ? 'var(--color-success)' : 'var(--color-accent-light)' }}>
              {user ? `Cloud (Supabase: ${user.email})` : 'Offline Browser Storage'}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              if (window.confirm('Reset handwriting profile back to standard adult defaults?')) {
                onResetCalibration();
                onClose();
              }
            }}
          >
            Reset to Default
          </button>

          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => {
              onClose();
              onRecalibrate();
            }}
          >
            ⚡ Recalibrate Handwriting Pace
          </button>
        </div>
      </div>
    </div>
  );
}
