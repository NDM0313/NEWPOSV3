import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { supabase } from '../lib/supabase';
import { MIN_IMAGE_BLOB_BYTES } from './imageBlobValidation';
import { debugLog, debugLogWarn } from '../lib/mobileDebugLog';
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

function encodeStoragePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/');
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

function guessMimeFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif') return 'image/gif';
  return 'image/jpeg';
}

function bytesFromCapacitorResponse(data: unknown): ArrayBuffer | null {
  if (data == null) return null;
  if (data instanceof ArrayBuffer) return data;
  if (typeof data === 'string' && data.length > 0) {
    try {
      const bin = atob(data);
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out.buffer;
    } catch {
      return null;
    }
  }
  return null;
}

async function fetchBytesViaNativeFetch(
  url: string,
  token: string | null,
  anonKey: string,
): Promise<ArrayBuffer | null> {
  try {
    const headers: Record<string, string> = { apikey: anonKey };
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(url, {
      method: 'GET',
      headers,
    });
    if (!response.ok) {
      debugLogWarn('nativeStorage', `fetch GET ${response.status}`, url.split('?')[0]);
      return null;
    }
    const buf = await response.arrayBuffer();
    if (buf.byteLength > 0 && buf.byteLength < MIN_IMAGE_BLOB_BYTES) {
      const preview = new TextDecoder().decode(buf.slice(0, Math.min(32, buf.byteLength)));
      debugLogWarn(
        'nativeStorage',
        'fetch tiny body',
        `status=${response.status} bytes=${buf.byteLength} preview=${preview}`,
      );
    }
    return buf;
  } catch {
    return null;
  }
}

async function fetchBytesViaCapacitorHttp(
  url: string,
  token: string | null,
  anonKey: string,
): Promise<ArrayBuffer | null> {
  try {
    const headers: Record<string, string> = { apikey: anonKey };
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await CapacitorHttp.request({
      method: 'GET',
      url,
      headers,
      responseType: 'arraybuffer',
    });
    if (response.status < 200 || response.status >= 300) {
      debugLogWarn('nativeStorage', `CapacitorHttp GET ${response.status}`, url.split('?')[0]);
      return null;
    }
    const buf = bytesFromCapacitorResponse(response.data);
    if (buf) {
      debugLog('nativeStorage', 'CapacitorHttp arraybuffer ok', { bytes: buf.byteLength });
      return buf;
    }
    if (typeof response.data === 'string' && response.data.length > 0) {
      const mime = guessMimeFromPath(url);
      return base64ToBlob(response.data, mime).arrayBuffer();
    }
  } catch {
    /* try blob responseType */
  }

  try {
    const headers: Record<string, string> = { apikey: anonKey };
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await CapacitorHttp.request({
      method: 'GET',
      url,
      headers,
      responseType: 'blob',
    });
    if (response.status < 200 || response.status >= 300) {
      debugLogWarn('nativeStorage', `CapacitorHttp blob GET ${response.status}`, url.split('?')[0]);
      return null;
    }
    if (response.data instanceof Blob) {
      const buf = await response.data.arrayBuffer();
      if (buf.byteLength > 0 && buf.byteLength < MIN_IMAGE_BLOB_BYTES) {
        const preview = new TextDecoder().decode(buf.slice(0, Math.min(32, buf.byteLength)));
        debugLogWarn(
          'nativeStorage',
          'CapacitorHttp blob tiny body',
          `status=${response.status} bytes=${buf.byteLength} preview=${preview}`,
        );
      }
      return buf;
    }
  } catch {
    return null;
  }
  return null;
}

async function fetchUrlToArrayBuffer(
  url: string,
  token: string | null,
  anonKey: string,
): Promise<ArrayBuffer | null> {
  let buf = await fetchBytesViaNativeFetch(url, token, anonKey);
  if (buf?.byteLength) return buf;
  buf = await fetchBytesViaCapacitorHttp(url, token, anonKey);
  return buf?.byteLength ? buf : null;
}

/**
 * Download a private storage object on native APK when WebView supabase-js download fails.
 * Uses the same ERP proxy + CapacitorHttp pattern as uploads.
 */
export async function nativeStorageObjectDownload(
  bucket: StorageBucket,
  path: string,
): Promise<{ data: Blob | null; error: string | null }> {
  if (!Capacitor.isNativePlatform()) {
    return { data: null, error: 'nativeStorageObjectDownload is native-only' };
  }

  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token ?? null;
  const anonKey = String(env.VITE_SUPABASE_ANON_KEY ?? '').trim();
  if (!token || !anonKey) {
    return { data: null, error: 'Not logged in.' };
  }

  const base = storageApiBase();
  const encodedPath = encodeStoragePath(path);
  const url = `${base}/storage/v1/object/${encodeURIComponent(bucket)}/${encodedPath}`;

  debugLog('nativeStorage', 'nativeStorageObjectDownload', { bucket, path, base });

  const buf = await fetchUrlToArrayBuffer(url, token, anonKey);
  if (!buf) {
    debugLogWarn('nativeStorage', 'download 0 bytes', `${bucket}/${path}`);
    return { data: null, error: 'Native storage download failed.' };
  }
  if (buf.byteLength < MIN_IMAGE_BLOB_BYTES) {
    const preview = new TextDecoder().decode(buf.slice(0, Math.min(32, buf.byteLength)));
    debugLogWarn(
      'nativeStorage',
      'object on server is tiny (re-upload photo)',
      `${path} bytes=${buf.byteLength} preview=${preview}`,
    );
  }
  debugLog('nativeStorage', 'download ok', { path, bytes: buf.byteLength });
  return { data: new Blob([buf], { type: guessMimeFromPath(path) }), error: null };
}

/** Fetch any URL (e.g. signed storage URL) to Blob — avoids WebView img HTTPS/CORS issues. */
export async function nativeFetchUrlToBlob(url: string): Promise<Blob | null> {
  if (!Capacitor.isNativePlatform() || !url.startsWith('http')) return null;
  const anonKey = String(env.VITE_SUPABASE_ANON_KEY ?? '').trim();
  const isSigned = /[?&]token=/.test(url);
  let token: string | null = null;
  if (!isSigned) {
    const { data: { session } } = await supabase.auth.getSession();
    token = session?.access_token ?? null;
  }
  const buf = await fetchUrlToArrayBuffer(url, token, anonKey);
  if (!buf) return null;
  return new Blob([buf], { type: guessMimeFromPath(url) });
}
