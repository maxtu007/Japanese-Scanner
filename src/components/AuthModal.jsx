import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function AuthModal({ onClose }) {
  const { signIn, signUp, resetPassword } = useAuth();
  const [tab, setTab]               = useState('login');
  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [error, setError]           = useState(null);
  const [loading, setLoading]       = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (tab === 'signup' && password !== confirmPass) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      if (tab === 'login') {
        await signIn(email, password);
      } else {
        await signUp(email, password);
      }
      onClose?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleForgot(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await resetPassword(email);
      setForgotSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function switchTab(t) {
    setTab(t);
    setError(null);
    setShowForgot(false);
    setForgotSent(false);
  }

  return (
    <div className="auth-overlay" onClick={e => e.target === e.currentTarget && onClose?.()}>
      <div className="auth-sheet">
        {onClose && (
          <button className="auth-close-btn" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        )}

        <div className="auth-logo-wrap">
          <div className="wordmark auth-wordmark">Un<em>blur</em></div>
          <p className="auth-tagline">Sync your words, decks, and history across devices.</p>
        </div>

        <div className="auth-tabs">
          <button className={`auth-tab${tab === 'login' ? ' active' : ''}`} onClick={() => switchTab('login')}>Log In</button>
          <button className={`auth-tab${tab === 'signup' ? ' active' : ''}`} onClick={() => switchTab('signup')}>Sign Up</button>
        </div>

        {showForgot ? (
          <form className="auth-form" onSubmit={handleForgot}>
            <p className="auth-forgot-hint">Enter your email and we'll send a reset link.</p>
            <input
              className="auth-input"
              type="email"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
            {error && <p className="auth-error">{error}</p>}
            {forgotSent
              ? <p className="auth-success">Check your email for a reset link.</p>
              : <button className="auth-submit-btn" type="submit" disabled={loading}>{loading ? 'Sending…' : 'Send Reset Link'}</button>
            }
            <button type="button" className="auth-link-btn" onClick={() => { setShowForgot(false); setForgotSent(false); setError(null); }}>
              Back to log in
            </button>
          </form>
        ) : (
          <form className="auth-form" onSubmit={handleSubmit}>
            <input
              className="auth-input"
              type="email"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
            <div className="auth-password-wrap">
              <input
                className="auth-input"
                type="password"
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                minLength={6}
              />
              {tab === 'login' && (
                <button type="button" className="auth-forgot-link" onClick={() => { setShowForgot(true); setError(null); }}>
                  Forgot password?
                </button>
              )}
            </div>
            {tab === 'signup' && (
              <input
                className="auth-input"
                type="password"
                placeholder="Confirm Password"
                value={confirmPass}
                onChange={e => setConfirmPass(e.target.value)}
                required
                autoComplete="new-password"
                minLength={6}
              />
            )}
            {error && <p className="auth-error">{error}</p>}
            <button className="auth-submit-btn" type="submit" disabled={loading}>
              {loading ? 'Please wait…' : tab === 'login' ? 'Log In' : 'Create Account'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
