/**
 * In-memory session bridge for Supabase REST when browser storage is blocked.
 * SupabaseContext updates this on auth changes; fetch wrapper and profile fallback read from here.
 */
import type { Session } from '@supabase/supabase-js';

export type UserProfileRow = {
  id: string;
  auth_user_id: string | null;
  company_id: string | null;
  role: string | null;
  is_active: boolean | null;
  full_name?: string | null;
  phone?: string | null;
};

let bridgeSession: Session | null = null;
let bridgeAccessToken: string | null = null;
let bridgeUserId: string | null = null;

export function setBridgeSession(session: Session | null): void {
  bridgeSession = session;
  bridgeAccessToken = session?.access_token ?? null;
  bridgeUserId = session?.user?.id ?? null;
}

export function getBridgeSession(): Session | null {
  return bridgeSession;
}

export function getBridgeAccessToken(): string | null {
  return bridgeAccessToken;
}

export function getBridgeUserId(): string | null {
  return bridgeUserId;
}

/** Resolved API base (same-origin on erp.dincouture.pk, /supabase in dev). Set from supabase.ts at init. */
let resolvedSupabaseUrl = '';
let resolvedAnonKey = '';

export function setResolvedSupabaseConfig(url: string, anonKey: string): void {
  resolvedSupabaseUrl = url.replace(/\/$/, '');
  resolvedAnonKey = anonKey;
}

export function getResolvedSupabaseUrl(): string {
  return resolvedSupabaseUrl;
}

export function getResolvedAnonKey(): string {
  return resolvedAnonKey;
}

/**
 * Fetch public.users row without going through GoTrue storage (direct REST).
 */
export async function fetchUserProfileRow(
  userId: string,
  accessToken: string
): Promise<{ data: UserProfileRow | null; error: Error | null }> {
  const base = getResolvedSupabaseUrl();
  const anon = getResolvedAnonKey();
  if (!base || !anon || !accessToken) {
    return { data: null, error: new Error('Missing Supabase URL, anon key, or access token') };
  }

  const orFilter = `(id.eq.${userId},auth_user_id.eq.${userId})`;
  const url =
    `${base}/rest/v1/users?select=id,auth_user_id,company_id,role,is_active,full_name,phone` +
    `&or=${encodeURIComponent(orFilter)}&limit=1`;

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        apikey: anon,
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return {
        data: null,
        error: new Error(text || `Profile fetch failed (${res.status})`),
      };
    }

    const rows = (await res.json()) as UserProfileRow[];
    const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
    return { data: row, error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e : new Error(String(e)) };
  }
}
