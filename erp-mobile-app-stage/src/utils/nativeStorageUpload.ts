import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { supabase } from '../lib/supabase';
import { debugLog, debugLogWarn } from '../lib/mobileDebugLog';
import { resolveSupabaseApiUrl } from '../lib/resolveSupabaseApiUrl';
import type { StorageBucket } from './storageDisplayUrl';

const env =
  typeof import.meta !== 'undefined' && (import.meta as { env?: Record<string, string> }).env
    ? (import.meta as { env: Record<string, string> }).env
    : ({} as Record<string, string>);

export type NativeStorageUploadResult = {
  error: string | null;
  status?: number;
  sentBytes?: number;
};

function storageApiBase(): string {
  return resolveSupabaseApiUrl(String(env.VITE_SUPABASE_URL ?? ''), {
    isNativeCapacitor: true,
    isDev: Boolean(env.DEV),
  }).replace(/\/$/, '');
}

function buildObjectUploadUrl(bucket: StorageBucket, path: string): string {
  const base = storageApiBase();
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  return `${base}/storage/v1/object/${encodeURIComponent(bucket)}/${encodedPath}`;
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

function parseUploadResponse(status: number, text: string): { ok: boolean; message: string } {
  if (status < 200 || status >= 300) {
    let message = text.slice(0, 200) || `Upload failed (${status})`;
    try {
      const parsed = JSON.parse(text) as { message?: string; error?: string };
      message = parsed.message ?? parsed.error ?? message;
    } catch {
      /* plain */
    }
    return { ok: false, message };
  }
  if (!text.trim()) return { ok: true, message: '' };
  try {
    const parsed = JSON.parse(text) as {
      message?: string;
      error?: string;
      statusCode?: string | number;
      Key?: string;
    };
    if (parsed.error || parsed.statusCode) {
      return { ok: false, message: parsed.message ?? parsed.error ?? text.slice(0, 200) };
    }
    return { ok: true, message: '' };
  } catch {
    return { ok: true, message: '' };
  }
}

function uploadHeaders(
  token: string,
  anonKey: string,
  contentType: string,
  upsert: boolean,
  byteLength: number,
): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    apikey: anonKey,
    'Content-Type': contentType || 'application/octet-stream',
    'Content-Length': String(byteLength),
    'cache-control': '3600',
    ...(upsert ? { 'x-upsert': 'true' } : {}),
  };
}

/** XHR + Blob avoids Capacitor bridge JSON-stringifying ArrayBuffer bodies. */
async function uploadViaXhr(
  url: string,
  token: string,
  anonKey: string,
  body: ArrayBuffer,
  contentType: string,
  upsert: boolean,
): Promise<{ ok: boolean; status: number; message: string }> {
  const blob = new Blob([body], { type: contentType || 'application/octet-stream' });
  const headers = uploadHeaders(token, anonKey, contentType, upsert, body.byteLength);

  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.onload = () => {
      const parsed = parseUploadResponse(xhr.status, xhr.responseText ?? '');
      resolve({ ok: parsed.ok, status: xhr.status, message: parsed.message });
    };
    xhr.onerror = () => resolve({ ok: false, status: 0, message: 'XHR upload failed' });
    xhr.send(blob);
  });
}

async function uploadViaNativeFetch(
  url: string,
  token: string,
  anonKey: string,
  body: ArrayBuffer,
  contentType: string,
  upsert: boolean,
): Promise<{ ok: boolean; status: number; message: string }> {
  const blob = new Blob([body], { type: contentType || 'application/octet-stream' });
  const response = await fetch(url, {
    method: 'POST',
    headers: uploadHeaders(token, anonKey, contentType, upsert, body.byteLength),
    body: blob,
  });
  const text = await response.text().catch(() => '');
  const parsed = parseUploadResponse(response.status, text);
  return { ok: parsed.ok, status: response.status, message: parsed.message };
}

/** Capacitor native: decode base64 `data` as raw request body bytes (not JSON string). */
async function uploadViaCapacitorHttp(
  url: string,
  token: string,
  anonKey: string,
  body: ArrayBuffer,
  contentType: string,
  upsert: boolean,
): Promise<{ ok: boolean; status: number; message: string }> {
  // Runtime supports base64 body decode on native; public types omit it — use loose cast.
  const response = await CapacitorHttp.request({
    method: 'POST',
    url,
    headers: uploadHeaders(token, anonKey, contentType, upsert, body.byteLength),
    data: arrayBufferToBase64(body),
    responseType: 'text',
    dataType: 'base64',
  } as never);

  const text =
    typeof response.data === 'string'
      ? response.data
      : response.data != null
        ? JSON.stringify(response.data).slice(0, 200)
        : '';
  const parsed = parseUploadResponse(response.status, text);
  return { ok: parsed.ok, status: response.status, message: parsed.message };
}

async function runNativeBinaryUpload(
  url: string,
  token: string,
  anonKey: string,
  body: ArrayBuffer,
  contentType: string,
  upsert: boolean,
): Promise<{ ok: boolean; status: number; message: string }> {
  let result = await uploadViaXhr(url, token, anonKey, body, contentType, upsert);
  if (result.ok) {
    debugLog('nativeStorage', 'upload xhr ok', `status=${result.status} bytes=${body.byteLength}`);
    return result;
  }
  debugLogWarn('nativeStorage', `upload xhr ${result.status}`, result.message);

  result = await uploadViaNativeFetch(url, token, anonKey, body, contentType, upsert);
  if (result.ok) {
    debugLog('nativeStorage', 'upload fetch-blob ok', `status=${result.status} bytes=${body.byteLength}`);
    return result;
  }
  debugLogWarn('nativeStorage', `upload fetch ${result.status}`, result.message);

  result = await uploadViaCapacitorHttp(url, token, anonKey, body, contentType, upsert);
  if (result.ok) {
    debugLog('nativeStorage', 'upload CapacitorHttp base64 ok', `status=${result.status}`);
  } else {
    debugLogWarn('nativeStorage', `upload CapacitorHttp ${result.status}`, result.message);
  }
  return result;
}

/**
 * Storage upload when WebView fetch to Supabase storage fails (sale attachments, product images, etc.).
 */
export async function nativeStorageObjectUpload(
  bucket: StorageBucket,
  path: string,
  body: ArrayBuffer,
  contentType: string,
  upsert: boolean,
): Promise<NativeStorageUploadResult> {
  if (!Capacitor.isNativePlatform()) {
    return { error: 'nativeStorageObjectUpload is native-only', sentBytes: body.byteLength };
  }

  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  const anonKey = String(env.VITE_SUPABASE_ANON_KEY ?? '').trim();
  if (!token || !anonKey) {
    return { error: 'You must be logged in to upload files.', sentBytes: body.byteLength };
  }

  const url = buildObjectUploadUrl(bucket, path);
  debugLog('nativeStorage', 'nativeStorageObjectUpload', { bucket, path, bytes: body.byteLength });

  try {
    const result = await runNativeBinaryUpload(url, token, anonKey, body, contentType, upsert);
    return result.ok
      ? { error: null, status: result.status, sentBytes: body.byteLength }
      : { error: result.message, status: result.status, sentBytes: body.byteLength };
  } catch (e) {
    return {
      error: String((e as Error)?.message ?? e ?? 'Upload failed'),
      sentBytes: body.byteLength,
    };
  }
}
