/**
 * Direct GoTrue password grant when browser storage blocks signInWithPassword persistence.
 */
import type { AuthError, Session, User } from '@supabase/supabase-js';
import { clearStaleSupabaseAuthStorage, isPlainUnauthorizedBody } from './clearStaleSupabaseAuth';
import { getResolvedAnonKey, getResolvedSupabaseUrl } from './supabase';

type GoTrueTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  expires_at?: number;
  token_type?: string;
  user?: User;
  error?: string;
  error_description?: string;
  msg?: string;
};

function mapTokenResponseToSession(body: GoTrueTokenResponse): Session | null {
  const access_token = body.access_token;
  const user = body.user;
  if (!access_token || !user) return null;
  const expires_in = body.expires_in ?? 3600;
  const expires_at = body.expires_at ?? Math.floor(Date.now() / 1000) + expires_in;
  return {
    access_token,
    refresh_token: body.refresh_token ?? '',
    expires_in,
    expires_at,
    token_type: (body.token_type ?? 'bearer') as 'bearer',
    user,
  };
}

function toAuthError(status: number, body: GoTrueTokenResponse, fallback?: string): AuthError {
  const message =
    body.error_description ||
    body.msg ||
    body.error ||
    fallback ||
    `Login failed (${status})`;
  return {
    name: 'AuthApiError',
    message,
    status,
  } as AuthError;
}

export type PasswordGrantResult = {
  data: { session: Session; user: User } | null;
  error: AuthError | null;
};

export async function loginWithPasswordGrant(
  email: string,
  password: string,
): Promise<PasswordGrantResult> {
  const base = getResolvedSupabaseUrl();
  const anon = getResolvedAnonKey();
  if (!base || !anon) {
    return {
      data: null,
      error: { name: 'AuthError', message: 'Missing Supabase URL or anon key', status: 500 } as AuthError,
    };
  }

  const tokenUrl = `${base.replace(/\/$/, '')}/auth/v1/token?grant_type=password`;
  try {
    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        apikey: anon,
        Authorization: `Bearer ${anon}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    const text = await res.text();
    if (isPlainUnauthorizedBody(text) || (res.status === 401 && !text.trim().startsWith('{'))) {
      const cleared = clearStaleSupabaseAuthStorage();
      console.warn(
        '[ERP Mobile] Auth Unauthorized (non-JSON). Cleared stale tokens:',
        cleared.length,
        'url=',
        base,
        '— ensure VITE_SUPABASE_URL and anon key both target the same Kong (api-stage vs api.ndmcore.com). Restart Vite after .env changes.',
      );
      return {
        data: null,
        error: {
          name: 'AuthApiError',
          message:
            'Unauthorized — Supabase URL/anon key mismatch (staging key on production API, or vice versa). Cleared stale session; restart Vite and retry.',
          status: 401,
        } as AuthError,
      };
    }

    let body: GoTrueTokenResponse = {};
    try {
      body = text ? (JSON.parse(text) as GoTrueTokenResponse) : {};
    } catch {
      return {
        data: null,
        error: toAuthError(res.status, {}, `Login failed: non-JSON response (${text.slice(0, 80)})`),
      };
    }

    if (!res.ok) {
      return { data: null, error: toAuthError(res.status, body) };
    }

    const session = mapTokenResponseToSession(body);
    if (!session) {
      return {
        data: null,
        error: { name: 'AuthError', message: 'Invalid token response', status: 500 } as AuthError,
      };
    }

    return { data: { session, user: session.user }, error: null };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (/Unexpected token ['"]?U['"]?|Unauthorized.*JSON/i.test(message)) {
      clearStaleSupabaseAuthStorage();
      return {
        data: null,
        error: {
          name: 'AuthApiError',
          message:
            'Unauthorized — URL/key mismatch. Cleared stale session; set VITE_SUPABASE_URL=https://api-stage.ndmcore.com and matching anon key, then restart Vite.',
          status: 401,
        } as AuthError,
      };
    }
    if (typeof console !== 'undefined' && /fetch|network/i.test(message)) {
      const tail = anon.length >= 8 ? anon.slice(-8) : '(short)';
      console.warn('[ERP Mobile] password grant failed:', message, 'url=', base, 'anon…', tail);
    }
    return {
      data: null,
      error: { name: 'AuthRetryableFetchError', message, status: 0 } as AuthError,
    };
  }
}
