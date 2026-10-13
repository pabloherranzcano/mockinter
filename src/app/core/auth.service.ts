import { Injectable, computed, inject, signal } from '@angular/core';
import { Session } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';
import { Profile } from './models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private sb = inject(SupabaseService).client;

  readonly session = signal<Session | null>(null);
  readonly profile = signal<Profile | null>(null);
  readonly isAdmin = computed(() => this.profile()?.role === 'admin');
  readonly ready: Promise<void>;

  constructor() {
    this.ready = this.init();
    this.sb.auth.onAuthStateChange((_event, session) => {
      const changedUser = session?.user.id !== this.session()?.user.id;
      this.session.set(session);
      if (!session) this.profile.set(null);
      else if (changedUser) void this.loadProfile();
    });
  }

  private async init() {
    const { data } = await this.sb.auth.getSession();
    this.session.set(data.session);
    if (data.session) await this.loadProfile();
  }

  async loadProfile() {
    const uid = this.session()?.user.id;
    if (!uid) return;
    const { data, error } = await this.sb.from('profiles').select('*').eq('id', uid).single();
    if (!error) this.profile.set(data as Profile);
  }

  async signIn(email: string, password: string) {
    const { error } = await this.sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    await this.loadProfile();
  }

  async signUp(email: string, password: string) {
    const { data, error } = await this.sb.auth.signUp({
      email, password, options: { emailRedirectTo: location.origin + '/' },
    });
    if (error) throw error;
    return { needsConfirmation: !data.session };
  }

  async signInWithGoogle() {
    const { error } = await this.sb.auth.signInWithOAuth({
      provider: 'google', options: { redirectTo: location.origin + '/' },
    });
    if (error) throw error;
  }

  async resetPassword(email: string) {
    const { error } = await this.sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + '/ajustes' });
    if (error) throw error;
  }

  async signOut() {
    await this.sb.auth.signOut();
    this.profile.set(null);
  }

  async updateProfile(patch: Partial<Pick<Profile, 'display_name' | 'target_role' | 'level' | 'english' | 'onboarded'>>) {
    const uid = this.session()?.user.id;
    if (!uid) return;
    const { data, error } = await this.sb.from('profiles').update(patch).eq('id', uid).select('*').single();
    if (error) throw error;
    this.profile.set(data as Profile);
  }

  async updatePassword(password: string) {
    const { error } = await this.sb.auth.updateUser({ password });
    if (error) throw error;
  }

  async deleteAccount() {
    const { error } = await this.sb.rpc('delete_my_account');
    if (error) throw error;
    await this.sb.auth.signOut();
    this.profile.set(null);
  }
}
