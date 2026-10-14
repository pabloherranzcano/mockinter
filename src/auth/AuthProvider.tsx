import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Profile } from '../lib/models';

type ProfilePatch = Partial<Pick<Profile, 'display_name' | 'target_role' | 'level' | 'english' | 'onboarded'>>;

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  isAdmin: boolean;
  /** true cuando ya sabemos si hay sesión (y, si la hay, tenemos el perfil). */
  ready: boolean;
  setProfile: (p: Profile) => void;
  signIn: (email: string, password: string) => Promise<Profile | null>;
  signUp: (email: string, password: string) => Promise<{ needsConfirmation: boolean }>;
  signInWithGoogle: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (patch: ProfilePatch) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function loadProfile(uid: string): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', uid).single();
  return error ? null : (data as Profile);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ready, setReady] = useState(false);
  const currentUid = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      currentUid.current = data.session?.user.id ?? null;
      if (data.session) setProfile(await loadProfile(data.session.user.id));
      if (!cancelled) setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      const uid = s?.user.id ?? null;
      if (uid === currentUid.current) return;
      currentUid.current = uid;
      if (!uid) setProfile(null);
      // Fuera del callback para no bloquear el cliente de auth
      else setTimeout(() => loadProfile(uid).then(setProfile), 0);
    });
    return () => { cancelled = true; sub.subscription.unsubscribe(); };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    currentUid.current = data.user.id;
    const p = await loadProfile(data.user.id);
    setSession(data.session); setProfile(p);
    return p;
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email, password, options: { emailRedirectTo: window.location.origin + '/' },
    });
    if (error) throw error;
    if (data.session && data.user) {
      currentUid.current = data.user.id;
      setSession(data.session); setProfile(await loadProfile(data.user.id));
    }
    return { needsConfirmation: !data.session };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + '/' } });
    if (error) throw error;
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/settings' });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    currentUid.current = null;
    setSession(null); setProfile(null);
  }, []);

  const updateProfile = useCallback(async (patch: ProfilePatch) => {
    const uid = currentUid.current;
    if (!uid) return;
    const { data, error } = await supabase.from('profiles').update(patch).eq('id', uid).select('*').single();
    if (error) throw error;
    setProfile(data as Profile);
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
  }, []);

  const deleteAccount = useCallback(async () => {
    const { error } = await supabase.rpc('delete_my_account');
    if (error) throw error;
    await signOut();
  }, [signOut]);

  const value = useMemo<AuthContextValue>(() => ({
    session, profile, isAdmin: profile?.role === 'admin', ready, setProfile,
    signIn, signUp, signInWithGoogle, resetPassword, signOut, updateProfile, updatePassword, deleteAccount,
  }), [session, profile, ready, signIn, signUp, signInWithGoogle, resetPassword, signOut, updateProfile, updatePassword, deleteAccount]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
