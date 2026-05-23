/**
 * Recover from revoked / missing Supabase refresh tokens (e.g. iOS cold start).
 * Clears local auth + counter vault and routes app to login via erp-auth-signed-out.
 */

import { supabase, isSupabaseConfigured } from './supabase';

let recoveryInFlight: Promise<void> | null = null;

function messageFromError(err: unknown): string {
  if (!err) return '';
  if (typeof err === 'string') return err.toLowerCase();
  if (typeof err === 'object') {
    const o = err as { message?: string; code?: string };
    if (typeof o.message === 'string') return o.message.toLowerCase();
    if (typeof o.code === 'string') return o.code.toLowerCase().replace(/_/g, ' ');
  }
  return String(err).toLowerCase();
}

/** True when GoTrue rejects the stored refresh token (server revoked, rotated, or missing). */
export function isStaleRefreshTokenError(err: unknown): boolean {
  if (!err) return false;
  if (typeof err === 'object') {
    const code = (err as { code?: string }).code;
    if (code === 'refresh_token_not_found' || code === 'invalid_refresh_token') return true;
  }
  const m = messageFromError(err);
  return (
    m.includes('refresh token not found') ||
    m.includes('refresh_token_not_found') ||
    m.includes('invalid refresh token') ||
    m.includes('invalid_refresh_token') ||
    m.includes('already used') ||
    m.includes('revoked')
  );
}

/** Idempotent: sign out locally, prune counter vault, dispatch erp-auth-signed-out via supabase listener. */
export async function recoverStaleAuthSession(): Promise<void> {
  if (!isSupabaseConfigured) return;
  if (recoveryInFlight) return recoveryInFlight;
  recoveryInFlight = (async () => {
    try {
      await supabase.auth.signOut({ scope: 'local' });
      try {
        const { maintainCounterVaultTokens } = await import('./counterVaultMaintenance');
        await maintainCounterVaultTokens();
      } catch {
        /* ignore */
      }
    } catch {
      /* ignore */
    } finally {
      recoveryInFlight = null;
    }
  })();
  return recoveryInFlight;
}

/** Run once at client init before App auth bootstrap. */
export async function recoverStaleAuthSessionFromBootstrap(): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.auth.getSession();
  if (error && isStaleRefreshTokenError(error)) {
    await recoverStaleAuthSession();
  }
}

/** Capacitor forwards console.error as ⚡️ [error] — suppress known stale-token noise on native. */
export function installNativeStaleTokenConsoleFilter(): void {
  if (typeof console === 'undefined' || typeof window === 'undefined') return;
  const prev = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    const first = args[0];
    if (isStaleRefreshTokenError(first)) {
      void recoverStaleAuthSession();
      return;
    }
    if (typeof first === 'string') {
      try {
        const parsed = JSON.parse(first) as unknown;
        if (isStaleRefreshTokenError(parsed)) {
          void recoverStaleAuthSession();
          return;
        }
      } catch {
        /* not JSON */
      }
    }
    prev(...args);
  };
}
