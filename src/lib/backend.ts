// Accounts and saving. Two interchangeable backends:
//  - Supabase (cloud): used when VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.
//    Real email sign-up, password reset, data synced across devices.
//  - Local (this device): accounts and data in browser storage, passwords hashed
//    with PBKDF2. Lets the app work before cloud keys exist.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { State } from './types';

export interface User { id: string; email: string; name: string }

export interface Backend {
  kind: 'cloud' | 'device';
  current(): Promise<User | null>;
  signUp(email: string, password: string, name: string): Promise<User>;
  signIn(email: string, password: string): Promise<User>;
  signOut(): Promise<void>;
  resetPassword(email: string): Promise<string>;
  load(user: User): Promise<State | null>;
  save(user: User, state: State): Promise<void>;
  /** Erase the account's saved data and sign out. */
  deleteAccount(user: User): Promise<void>;
}

export class AuthError extends Error {}

const validEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
export function checkCredentials(email: string, password: string, name?: string) {
  if (name !== undefined && !name.trim()) throw new AuthError('Please enter your name.');
  if (!validEmail(email.trim())) throw new AuthError('Please enter a valid email address.');
  if (password.length < 8) throw new AuthError('Password needs at least 8 characters.');
}

const b64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf)));

/** PBKDF2-SHA256, 120k iterations. Used for local passwords and for profile PINs. */
export async function hashSecret(secret: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: 120_000 }, key, 256);
  return b64(bits);
}
export const newSalt = () => b64(crypto.getRandomValues(new Uint8Array(16)).buffer);

const store = {
  get<T>(k: string): T | null { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : null; } catch { return null; } },
  set(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage blocked */ } },
  del(k: string) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};

interface LocalUser extends User { salt: string; hash: string }

class LocalBackend implements Backend {
  kind = 'device' as const;
  private users() { return store.get<Record<string, LocalUser>>('ritsu:users') ?? {}; }
  async current() {
    const id = store.get<string>('ritsu:auth');
    const u = Object.values(this.users()).find((x) => x.id === id);
    return u ? { id: u.id, email: u.email, name: u.name } : null;
  }
  async signUp(email: string, password: string, name: string) {
    checkCredentials(email, password, name);
    const key = email.trim().toLowerCase();
    const users = this.users();
    if (users[key]) throw new AuthError('An account with this email already exists on this device. Try signing in.');
    const salt = newSalt();
    const u: LocalUser = { id: `u_${crypto.randomUUID()}`, email: key, name: name.trim(), salt, hash: await hashSecret(password, salt) };
    store.set('ritsu:users', { ...users, [key]: u });
    store.set('ritsu:auth', u.id);
    return { id: u.id, email: u.email, name: u.name };
  }
  async signIn(email: string, password: string) {
    const u = this.users()[email.trim().toLowerCase()];
    if (!u || (await hashSecret(password, u.salt)) !== u.hash) throw new AuthError('Email or password is not right.');
    store.set('ritsu:auth', u.id);
    return { id: u.id, email: u.email, name: u.name };
  }
  async signOut() { store.del('ritsu:auth'); }
  async resetPassword() {
    return 'Accounts on this device cannot reset passwords by email. Connect cloud saving to enable password reset.';
  }
  async load(user: User) { return store.get<State>(`ritsu:data:${user.id}`); }
  async save(user: User, state: State) {
    try { localStorage.setItem(`ritsu:data:${user.id}`, JSON.stringify(state)); }
    catch { throw new AuthError('This device is out of storage space, so the last change was not saved. Download a backup, then remove some old photos.'); }
  }
  async deleteAccount(user: User) {
    const users = this.users();
    delete users[user.email];
    store.set('ritsu:users', users);
    store.del(`ritsu:data:${user.id}`);
    store.del('ritsu:auth');
  }
}

class SupabaseBackend implements Backend {
  kind = 'cloud' as const;
  constructor(private sb: SupabaseClient) {}
  private toUser(u: { id: string; email?: string; user_metadata?: Record<string, unknown> }): User {
    return { id: u.id, email: u.email ?? '', name: String(u.user_metadata?.name ?? '') };
  }
  async current() {
    const { data } = await this.sb.auth.getSession();
    return data.session ? this.toUser(data.session.user) : null;
  }
  async signUp(email: string, password: string, name: string) {
    checkCredentials(email, password, name);
    const { data, error } = await this.sb.auth.signUp({ email: email.trim(), password, options: { data: { name: name.trim() } } });
    if (error) throw new AuthError(error.message);
    if (!data.session) throw new AuthError('Check your email to confirm your account, then sign in.');
    return this.toUser(data.session.user);
  }
  async signIn(email: string, password: string) {
    const { data, error } = await this.sb.auth.signInWithPassword({ email: email.trim(), password });
    if (error || !data.user) throw new AuthError('Email or password is not right.');
    return this.toUser(data.user);
  }
  async signOut() { await this.sb.auth.signOut(); }
  async resetPassword(email: string) {
    if (!validEmail(email.trim())) throw new AuthError('Enter your email address first.');
    const { error } = await this.sb.auth.resetPasswordForEmail(email.trim());
    if (error) throw new AuthError(error.message);
    return 'We sent a password reset link to your email.';
  }
  async load(user: User) {
    const { data, error } = await this.sb.from('ritsu_family_data').select('data').eq('user_id', user.id).maybeSingle();
    if (error) throw new AuthError(`Could not load your data: ${error.message}`);
    return (data?.data as State | undefined) ?? null;
  }
  async save(user: User, state: State) {
    const { error } = await this.sb.from('ritsu_family_data').upsert({ user_id: user.id, data: state, updated_at: new Date().toISOString() });
    if (error) throw new AuthError(`Could not save: ${error.message}`);
  }
  async deleteAccount(user: User) {
    const { error } = await this.sb.from('ritsu_family_data').delete().eq('user_id', user.id);
    if (error) throw new AuthError(`Could not delete: ${error.message}`);
    await this.sb.auth.signOut();
  }
}

let instance: Backend | null = null;
export function backend(): Backend {
  if (instance) return instance;
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  instance = url && key ? new SupabaseBackend(createClient(url, key)) : new LocalBackend();
  return instance;
}

/** Checks that a parsed backup file looks like Ritsu data before it replaces anything. */
export function parseBackup(text: string): State {
  let v: unknown;
  try { v = JSON.parse(text); } catch { throw new AuthError('That file is not a Ritsu backup.'); }
  const s = (v as { ritsu?: number; state?: State })?.state ?? (v as State);
  const ok = s && typeof s === 'object' && Array.isArray(s.accounts) && s.accounts.length > 0 && Array.isArray(s.members) && s.members.length > 0
    && Array.isArray(s.transactions) && Array.isArray(s.rules);
  if (!ok) throw new AuthError('That file is not a Ritsu backup.');
  return s;
}

// Demo data is kept separately from any account.
export const demoStore = {
  load: () => store.get<State>('ritsu:demo'),
  save: (s: State) => store.set('ritsu:demo', s),
};
