// src/components/layout/Header.jsx
import { useAuth } from '../../context/AuthContext';

export default function Header({ profile, onOpenProfile, onOpenAuth, onOpenCalibration }) {
  const { user, signOut, isConfigured } = useAuth();

  return (
    <header className="header">
      <div className="header-inner">
        <a href="/" className="logo">
          <div className="logo-icon" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
          </div>
          <span className="logo-text">
            Scribe<span>Sync</span>
          </span>
        </a>

        <div className="header-actions">
          {/* Handwriting Speed / Calibration status */}
          <button
            className="profile-pill-btn"
            onClick={onOpenProfile}
            title="View your handwriting pace and cognitive tuning"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.8 }}>
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
            <span>Pace:</span>
            <span className="speed-tag">
              {profile.is_calibrated ? `${profile.handwriting_wpm} WPM` : 'Default 22 WPM'}
            </span>
          </button>

          {!profile.is_calibrated && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={onOpenCalibration}
              title="Calibrate your handwriting speed"
            >
              ⚡ Quick Calibrate
            </button>
          )}

          {/* User / Cloud status */}
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={onOpenProfile}
              >
                👤 {user.email?.split('@')[0]}
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={signOut}
                title="Sign out"
              >
                Sign out
              </button>
            </div>
          ) : (
            <button
              className="btn btn-ghost btn-sm"
              onClick={onOpenAuth}
              title={isConfigured ? 'Sign in to sync your profile across devices' : 'Guest mode (active)'}
            >
              {isConfigured ? 'Sign in' : '💾 Local Profile'}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
