// src/components/calibration/CalibrationModal.jsx
import { SAMPLE_CALIBRATION_TEXT } from '../../constants';

export default function CalibrationModal({
  isOpen,
  onClose,
  onStartCalibration,
  onSkipCalibration,
}) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box animate-scaleIn">
        <h2 className="modal-title">
          <span>✍️</span> Handwriting Calibration
        </h2>
        <p className="modal-subtitle">
          Everyone writes at a different pace. Take 60 seconds to calibrate your natural handwriting speed so ScribeSync knows your exact rhythm before you start.
        </p>

        <div style={{
          background: 'var(--color-bg-input)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--space-4)',
          marginBottom: 'var(--space-5)',
        }}>
          <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)', marginBottom: 'var(--space-2)', color: 'var(--color-primary-light)' }}>
            How it works:
          </h4>
          <ol style={{ paddingLeft: 'var(--space-4)', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.8 }}>
            <li>Have a real pen and paper ready in front of you.</li>
            <li>ScribeSync will read a few short test phrases (both simple and technical words).</li>
            <li>Write along on paper. Whenever your pen finishes, press <strong>Spacebar</strong> or click <strong>Ready</strong>.</li>
            <li>The AI measures your stroke latency and calculates your WPM, technical slowdown ratio, and optimal chunk lengths.</li>
          </ol>
        </div>

        <div style={{
          background: 'rgba(6, 182, 212, 0.08)',
          border: '1px solid rgba(6, 182, 212, 0.2)',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--space-3) var(--space-4)',
          fontSize: 'var(--text-xs)',
          color: 'var(--color-accent-light)',
          marginBottom: 'var(--space-6)',
        }}>
          💡 <strong>Prefer to start right away?</strong> You can skip this — ScribeSync comes pre-loaded with an intelligent 22 WPM adult handwriting model and will adapt on the fly anyway!
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onSkipCalibration}
          >
            Use Smart Defaults (22 WPM)
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              onStartCalibration(SAMPLE_CALIBRATION_TEXT);
              onClose();
            }}
          >
            Start 60-Sec Calibration Run 🚀
          </button>
        </div>
      </div>
    </div>
  );
}
