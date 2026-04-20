import { useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { useAuth } from '../contexts/AuthContext';

export default function AuthModal({ onClose }) {
  const { signIn, signUp, resetPassword, signInWithApple, signInWithGoogle, oauthError, oauthPending, setOauthError } = useAuth();
  const [tab, setTab]               = useState('login');
  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [error, setError]           = useState(null);
  const [loading, setLoading]       = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [signUpEmailSent, setSignUpEmailSent] = useState(false);

  const isNative = Capacitor.isNativePlatform();

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
        onClose?.();
      } else {
        const data = await signUp(email, password);
        // If email confirmation is required, user.email_confirmed_at will be null
        if (data?.user && !data.user.email_confirmed_at) {
          setSignUpEmailSent(true);
        } else {
          onClose?.();
        }
      }
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

  async function handleApple() {
    setError(null);
    setLoading(true);
    try {
      await signInWithApple();
      onClose?.();
    } catch (err) {
      if (!err.message?.toLowerCase().includes('cancel')) setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setError(null);
    setOauthError(null);
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      if (!err.message?.toLowerCase().includes('cancel')) setError(err.message);
    } finally {
      setLoading(false); // reset immediately — session arrives via auth state change
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

        {isNative && (
          <div className="auth-social">
            <button className="auth-social-btn auth-apple-btn" onClick={handleApple} disabled={loading}>
              <svg className="auth-social-icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.7 9.05 7.4c1.39.07 2.35.74 3.16.8 1.21-.25 2.37-.96 3.66-.84 1.55.16 2.72.77 3.47 1.96-3.18 1.94-2.43 5.86.71 6.96-.51 1.36-1.19 2.7-3 4zm-3.12-17.6c.04 2.27-1.97 4.16-4.2 4-.09-2.18 2-4.19 4.2-4z"/>
              </svg>
              Continue with Apple
            </button>
            <button className="auth-social-btn auth-google-btn" onClick={handleGoogle} disabled={loading}>
              <svg className="auth-social-icon" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>
          </div>
        )}

        {isNative && <div className="auth-divider"><span>or</span></div>}

        {oauthPending && (
          <p className="auth-success" style={{textAlign:'center'}}>Signing you in…</p>
        )}
        {oauthError && (
          <p className="auth-error" style={{textAlign:'center'}}>{oauthError}</p>
        )}

        {signUpEmailSent ? (
          <div style={{textAlign:'center',padding:'16px 0'}}>
            <p className="auth-success" style={{fontSize:'15px',marginBottom:'8px'}}>Account created!</p>
            <p className="auth-tagline">Check your email to confirm your address, then log in.</p>
            <button type="button" className="auth-link-btn" style={{marginTop:'12px'}} onClick={() => { setSignUpEmailSent(false); setTab('login'); }}>
              Go to Log In
            </button>
          </div>
        ) : (<>
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
        </>)}
      </div>
    </div>
  );
}
