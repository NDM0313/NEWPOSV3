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
    const status = (err as { status?: number; statusCode?: number }).status
      ?? (err as { statusCode?: number }).statusCode;
    const name = (err as { name?: string }).name ?? '';
    const m = messageFromError(err);
    // GoTrue rejects refresh-token requests with HTTP 400/401 (AuthApiError). Body shapes vary
    // (`invalid_grant`, `invalid_refresh_token`, etc.) — match by status + auth-related hint
    // so we break the loop even when the message isn't one of the strings below.
    if ((status === 400 || status === 401) && /AuthApi/i.test(name)) {
      if (/refresh|grant|jwt|session|token|invalid/i.test(m)) return true;
    }
  }
  const m = messageFromError(err);
  return (
    m.includes('refresh token not found') ||
    m.includes('refresh_token_not_found') ||
    m.includes('invalid refresh token') ||
    m.includes('invalid_refresh_token') ||
    m.includes('invalid_grant') ||
    m.includes('already used') ||
    m.includes('revoked')
  );
}

/**
 * Circuit breaker — returns true after 3 refresh failures within 5s so callers can force
 * recovery even if the server starts returning a brand-new error shape we don't recognise.
 */
let consecutiveRefreshFailures = 0;
let lastRefreshFailureAt = 0;
export function noteRefreshFailure(): boolean {
  const now = Date.now();
  if (now - lastRefreshFailureAt > 5000) consecutiveRefreshFailures = 0;
  consecutiveRefreshFailures += 1;
  lastRefreshFailureAt = now;
  return consecutiveRefreshFailures >= 3;
}

export function resetRefreshFailureCount(): void {
  consecutiveRefreshFailures = 0;
  lastRefreshFailureAt = 0;
}

/** Idempotent: sign out locally, prune counter vault, dispatch erp-auth-signed-out via supabase listener. */
export async function recoverStaleAuthSession(options?: { allowGlobalRecovery?: boolean }): Promise<void> {
  if (!isSupabaseConfigured) return;
  if (options?.allowGlobalRecovery === false) return;
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
