import { createContext, useContext, useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { supabase } from '../utils/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

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
        // PKCE flow: exchange code for session
        const code = new URLSearchParams(url.split('?')[1] || '').get('code');
        if (code) {
          await supabase.auth.exchangeCodeForSession(url);
          return;
        }
        // Implicit flow fallback: set session from hash tokens
        const hash = new URLSearchParams(url.split('#')[1] || '');
        const access_token = hash.get('access_token');
        const refresh_token = hash.get('refresh_token');
        if (access_token && refresh_token) {
          await supabase.auth.setSession({ access_token, refresh_token });
        }
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
      },
    });
    if (error) throw error;
    // Use system Safari (not SFSafariViewController) so custom URL scheme redirect works
    window.open(data.url, '_system');
  }

  return (
    <AuthContext.Provider value={{ user, session, signUp, signIn, signOut, resetPassword, signInWithApple, signInWithGoogle, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
