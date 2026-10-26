// src/components/auth/AuthModal.jsx
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

export default function AuthModal({ isOpen, onClose, onSuccess }) {
  const { isConfigured, signIn, signUp } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setIsSubmitting(true);

    try {
      if (!isConfigured) {
        throw new Error('Supabase is not configured yet. Add VITE_SUPABASE_URL in .env.local to enable cloud sync.');
      }

      if (isLogin) {
        await signIn(email, password);
        onSuccess?.('Signed in successfully!');
        onClose();
      } else {
        await signUp(email, password);
        setSuccessMsg('Account created! Please check your email inbox to confirm your account.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Authentication error.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box animate-scaleIn">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
          <h2 className="modal-title" style={{ margin: 0 }}>
            {isLogin ? 'Sign In to ScribeSync' : 'Create Free Account'}
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
          Sync your handwriting pace profile and dictation history across multiple devices.
        </p>

        {!isConfigured && (
          <div style={{
            background: 'rgba(245, 158, 11, 0.12)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-3) var(--space-4)',
            fontSize: 'var(--text-xs)',
            color: 'var(--color-warning)',
            marginBottom: 'var(--space-4)',
          }}>
            ℹ️ Running in <strong>Guest Offline Mode</strong>. All handwriting profiles and pacing are automatically saved locally on this browser. To enable cloud sync, supply your Supabase project keys in <code>.env.local</code>.
          </div>
        )}

        {errorMsg && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-3)',
            fontSize: 'var(--text-xs)',
            color: 'var(--color-error)',
            marginBottom: 'var(--space-4)',
          }}>
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div style={{
            background: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-3)',
            fontSize: 'var(--text-xs)',
            color: 'var(--color-success)',
            marginBottom: 'var(--space-4)',
          }}>
            {successMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div className="slider-group">
            <label className="slider-label" htmlFor="auth-email">Email Address</label>
            <input
              id="auth-email"
              type="email"
              className="form-select"
              style={{ cursor: 'text' }}
              placeholder="student@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="slider-group">
            <label className="slider-label" htmlFor="auth-password">Password</label>
            <input
              id="auth-password"
              type="password"
              className="form-select"
              style={{ cursor: 'text' }}
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg"
            disabled={isSubmitting || !isConfigured}
            style={{ width: '100%', marginTop: 'var(--space-2)' }}
          >
            {isSubmitting ? 'Processing…' : isLogin ? 'Sign In' : 'Sign Up'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 'var(--space-4)', fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
          {isLogin ? (
            <span>
              Don't have an account?{' '}
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setIsLogin(false)}
                style={{ color: 'var(--color-primary-light)' }}
              >
                Sign up
              </button>
            </span>
          ) : (
            <span>
              Already have an account?{' '}
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setIsLogin(true)}
                style={{ color: 'var(--color-primary-light)' }}
              >
                Sign in
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
