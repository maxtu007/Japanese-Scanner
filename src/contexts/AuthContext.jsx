import { createContext, useContext, useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { supabase } from '../utils/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]           = useState(null);
  const [session, setSession]     = useState(null);
  const [loading, setLoading]     = useState(true);
  const [oauthError, setOauthError] = useState(null);
  const [oauthPending, setOauthPending] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if (session) {
        setOauthPending(false);
        setOauthError(null);
      }
    });

    // Handle OAuth deep link callback (Google sign-in)
    let listenerHandle;
    async function setupUrlListener() {
      if (!Capacitor.isNativePlatform()) return;
      const { App: CapApp } = await import('@capacitor/app');
      const { Browser } = await import('@capacitor/browser');
      listenerHandle = await CapApp.addListener('appUrlOpen', async ({ url }) => {
        if (!url.startsWith('com.unblur.app://')) return;
        await Browser.close();
        setOauthPending(true);
        setOauthError(null);
        // PKCE flow: exchange code for session
        const code = new URLSearchParams(url.split('?')[1] || '').get('code');
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(url);
          if (error) {
            console.error('[auth] exchangeCodeForSession failed:', error.message);
            setOauthError(error.message);
            setOauthPending(false);
          }
          return;
        }
        // Implicit flow fallback: set session from hash tokens
        const hash = new URLSearchParams(url.split('#')[1] || '');
        const access_token = hash.get('access_token');
        const refresh_token = hash.get('refresh_token');
        if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({ access_token, refresh_token });
          if (error) {
            console.error('[auth] setSession failed:', error.message);
            setOauthError(error.message);
            setOauthPending(false);
          }
          return;
        }
        // URL received but no recognizable params
        setOauthError('Sign-in failed — no auth code received. Please try again.');
        setOauthPending(false);
      });
    }
    setupUrlListener();

    return () => {
      subscription.unsubscribe();
      listenerHandle?.remove();
    };
  }, []);

  async function signUp(email, password) {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    return data;
  }

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }

  async function resetPassword(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw error;
  }

  async function deleteAccount() {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) throw new Error('Not signed in');
    const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
    const res = await fetch(`${API_BASE}/api/account`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Failed to delete account');
    // Sign out locally after server deletion
    await supabase.auth.signOut();
  }

  async function signInWithApple() {
    const { SignInWithApple } = await import('@capacitor-community/apple-sign-in');

    // Generate a random nonce and its SHA-256 hash (Apple requires hashed nonce)
    const rawNonce = Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map(b => b.toString(16).padStart(2, '0')).join('');
    const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rawNonce));
    const hashedNonce = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0')).join('');

    const result = await SignInWithApple.authorize({
      clientId: 'com.unblur.app',
      redirectURI: 'https://vhbldjadabdbweyzjldb.supabase.co/auth/v1/callback',
      scopes: 'email name',
      nonce: hashedNonce,
    });

    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: result.response.identityToken,
      nonce: rawNonce,
    });
    if (error) throw error;
  }

  async function signInWithGoogle() {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'com.unblur.app://login',
        skipBrowserRedirect: true,
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error) throw error;
    setOauthError(null);
    // Use Capacitor Browser (SFSafariViewController) — iOS fires appUrlOpen
    // for custom URL scheme redirects from SFSafariViewController
    const { Browser } = await import('@capacitor/browser');
    await Browser.open({ url: data.url, presentationStyle: 'fullscreen' });
  }

  return (
    <AuthContext.Provider value={{ user, session, signUp, signIn, signOut, resetPassword, deleteAccount, signInWithApple, signInWithGoogle, loading, oauthError, oauthPending, setOauthError }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
