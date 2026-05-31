import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { supabase } from '../lib/supabase';
import { resolveSupabaseApiUrl } from '../lib/resolveSupabaseApiUrl';
import type { StorageBucket } from './storageDisplayUrl';

const env =
  typeof import.meta !== 'undefined' && (import.meta as { env?: Record<string, string> }).env
    ? (import.meta as { env: Record<string, string> }).env
    : ({} as Record<string, string>);

function storageApiBase(): string {
  return resolveSupabaseApiUrl(String(env.VITE_SUPABASE_URL ?? ''), {
    isNativeCapacitor: true,
    isDev: Boolean(env.DEV),
  }).replace(/\/$/, '');
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function uploadViaNativeFetch(
  url: string,
  token: string,
  anonKey: string,
  body: ArrayBuffer,
  contentType: string,
  upsert: boolean,
): Promise<{ ok: boolean; status: number; message: string }> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: anonKey,
      'Content-Type': contentType || 'application/octet-stream',
      'cache-control': '3600',
      ...(upsert ? { 'x-upsert': 'true' } : {}),
    },
    body,
  });
  const text = await response.text().catch(() => '');
  let message = text.slice(0, 200);
  if (!message) message = `Upload failed (${response.status})`;
  try {
    const parsed = JSON.parse(text) as { message?: string; error?: string };
    message = parsed.message ?? parsed.error ?? message;
  } catch {
    /* plain text */
  }
  return { ok: response.ok, status: response.status, message };
}

async function uploadViaCapacitorHttp(
  url: string,
  token: string,
  anonKey: string,
  body: ArrayBuffer,
  contentType: string,
  upsert: boolean,
): Promise<{ ok: boolean; status: number; message: string }> {
  const response = await CapacitorHttp.request({
    method: 'POST',
    url,
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: anonKey,
      'Content-Type': contentType || 'application/octet-stream',
      'cache-control': '3600',
      ...(upsert ? { 'x-upsert': 'true' } : {}),
    },
    data: arrayBufferToBase64(body),
  });
  let message = `Upload failed (${response.status})`;
  try {
    const parsed =
      typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
    if (parsed && typeof parsed === 'object' && 'message' in parsed) {
      message = String((parsed as { message?: string }).message ?? message);
    } else if (typeof response.data === 'string' && response.data.trim()) {
      message = response.data.slice(0, 200);
    }
  } catch {
    /* ignore */
  }
  return { ok: response.status >= 200 && response.status < 300, status: response.status, message };
}

/**
 * Storage upload when WebView fetch to Supabase storage fails (sale attachments, etc.).
 */
export async function nativeStorageObjectUpload(
  bucket: StorageBucket,
  path: string,
  body: ArrayBuffer,
  contentType: string,
  upsert: boolean,
): Promise<{ error: string | null }> {
  if (!Capacitor.isNativePlatform()) {
    return { error: 'nativeStorageObjectUpload is native-only' };
  }

  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  const anonKey = String(env.VITE_SUPABASE_ANON_KEY ?? '').trim();
  if (!token || !anonKey) {
    return { error: 'You must be logged in to upload files.' };
  }

  const base = storageApiBase();
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  const url = `${base}/storage/v1/object/${encodeURIComponent(bucket)}/${encodedPath}`;

  try {
    let result = await uploadViaNativeFetch(url, token, anonKey, body, contentType, upsert);
    if (!result.ok) {
      result = await uploadViaCapacitorHttp(url, token, anonKey, body, contentType, upsert);
    }
    return result.ok ? { error: null } : { error: result.message };
  } catch (e) {
    try {
      const result = await uploadViaCapacitorHttp(url, token, anonKey, body, contentType, upsert);
      return result.ok ? { error: null } : { error: result.message };
    } catch (inner) {
      return { error: String((inner as Error)?.message ?? e ?? 'Upload failed') };
    }
  }
}
