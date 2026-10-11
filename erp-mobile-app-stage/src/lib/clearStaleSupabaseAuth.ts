/**
 * Clear persisted Supabase auth keys when Kong returns plain "Unauthorized"
 * (usually staging anon key against production API, or the reverse).
 */
import { getBrowserStorage } from './safeBrowserStorage';

const AUTH_KEY_RE = /^(sb-|supabase\.auth\.token)/i;

export function clearStaleSupabaseAuthStorage(): string[] {
  const removed: string[] = [];
  for (const kind of ['local', 'session'] as const) {
    const store = getBrowserStorage(kind);
    if (!store) continue;
    try {
      const keys: string[] = [];
      for (let i = 0; i < store.length; i++) {
        const k = store.key(i);
        if (k) keys.push(k);
      }
      for (const k of keys) {
        if (AUTH_KEY_RE.test(k) || k.includes('auth-token')) {
          store.removeItem(k);
          removed.push(`${kind}:${k}`);
        }
      }
    } catch {
      /* ignore */
    }
  }
  return removed;
}

export function isPlainUnauthorizedBody(text: string): boolean {
  return /^\s*Unauthorized\s*$/i.test(text.trim());
}
