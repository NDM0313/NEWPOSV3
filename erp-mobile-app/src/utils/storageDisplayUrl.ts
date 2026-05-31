import { Capacitor } from '@capacitor/core';
import { supabase } from '../lib/supabase';
import { resolveSupabaseApiUrl } from '../lib/resolveSupabaseApiUrl';

export const STORAGE_BUCKETS = [
  'product-images',
  'sale-attachments',
  'purchase-attachments',
  'payment-attachments',
  'expense-receipts',
] as const;

export type StorageBucket = (typeof STORAGE_BUCKETS)[number];

export interface StorageRef {
  bucket: StorageBucket;
  path: string;
}

const env =
  typeof import.meta !== 'undefined' && (import.meta as { env?: Record<string, string> }).env
    ? (import.meta as { env: Record<string, string> }).env
    : ({} as Record<string, string>);

const isNativeCapacitor = Capacitor.isNativePlatform();
const isDevBuild = Boolean(env.DEV);
const isDevBrowser =
  isDevBuild && typeof window !== 'undefined' && !isNativeCapacitor;

let devStorageProxyHintLogged = false;
/** Set on first 503 in dev browser — skip parallel sign storms until page reload. */
let devStorageUpstreamUnavailable = false;
let nativeStorageSignWarnLogged = false;

const NATIVE_SIGN_MAX_CONCURRENT = 6;
let nativeSignInFlight = 0;
const nativeSignQueue: Array<() => void> = [];

function runWithNativeSignThrottle<T>(fn: () => Promise<T>): Promise<T> {
  if (!isNativeCapacitor) return fn();
  return new Promise((resolve, reject) => {
    const run = () => {
      nativeSignInFlight += 1;
      fn()
        .then(resolve, reject)
        .finally(() => {
          nativeSignInFlight -= 1;
          const next = nativeSignQueue.shift();
          if (next) next();
        });
    };
    if (nativeSignInFlight < NATIVE_SIGN_MAX_CONCURRENT) run();
    else nativeSignQueue.push(run);
  });
}

function logNativeStorageSignFailureOnce(bucket: string, err: unknown): void {
  if (!isNativeCapacitor || isDevBuild || nativeStorageSignWarnLogged) return;
  nativeStorageSignWarnLogged = true;
  const status = (err as { status?: number; statusCode?: number }).status
    ?? (err as { statusCode?: number }).statusCode;
  const msg = String((err as { message?: string }).message ?? err ?? 'sign failed');
  console.warn('[StorageUrl] native sign failed (once per session)', bucket, status ?? '', msg);
}

/**
 * Module-level cache so the same `bucket/path` is signed at most once per TTL window —
 * without this every parent re-render re-runs `createSignedUrl` and hammers Storage with
 * 404s when the underlying file no longer exists (see erp.dincouture.pk production log).
 */
type SignedUrlCacheEntry = { url: string | null; expiresAt: number };
const signedUrlCache = new Map<string, SignedUrlCacheEntry>();
/** In-flight sign requests — parallel ProductImage mounts share one promise per path. */
const signedUrlInflight = new Map<string, Promise<string | null>>();
const SIGNED_URL_NEGATIVE_TTL_MS = 5 * 60 * 1000;
const SIGNED_URL_POSITIVE_TTL_MS = 50 * 60 * 1000;

function readCache(key: string): SignedUrlCacheEntry | null {
  const entry = signedUrlCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    signedUrlCache.delete(key);
    return null;
  }
  return entry;
}

function writeCache(key: string, url: string | null, ttlMs: number): void {
  signedUrlCache.set(key, { url, expiresAt: Date.now() + ttlMs });
}

function isNotFoundError(err: unknown): boolean {
  if (!err) return false;
  const status = (err as { status?: number; statusCode?: number }).status
    ?? (err as { statusCode?: number }).statusCode;
  if (status === 404) return true;
  const msg = String((err as { message?: string }).message ?? '').toLowerCase();
  return /not.*found|object.*not.*exist/i.test(msg);
}

function isUpstreamUnavailableError(err: unknown): boolean {
  if (!err) return false;
  const status = (err as { status?: number; statusCode?: number }).status
    ?? (err as { statusCode?: number }).statusCode;
  if (status === 502 || status === 503) return true;
  const msg = String((err as { message?: string }).message ?? '').toLowerCase();
  return /service unavailable|name resolution failed|bad gateway/i.test(msg);
}

function isAuthError(err: unknown): boolean {
  if (!err) return false;
  const status = (err as { status?: number; statusCode?: number }).status
    ?? (err as { statusCode?: number }).statusCode;
  if (status === 401 || status === 403) return true;
  const msg = String((err as { message?: string }).message ?? '').toLowerCase();
  return /jwt|not authenticated|unauthorized|invalid token|session/i.test(msg);
}

const SESSION_RETRY_MS = 150;
const SESSION_RETRY_COUNT = 3;

async function waitForAccessToken(): Promise<string | null> {
  for (let i = 0; i <= SESSION_RETRY_COUNT; i++) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) return session.access_token;
    if (i < SESSION_RETRY_COUNT) {
      await new Promise((r) => setTimeout(r, SESSION_RETRY_MS));
    }
  }
  return null;
}

function logDevStorageProxyHintOnce(): void {
  if (!isDevBrowser || devStorageProxyHintLogged) return;
  devStorageProxyHintLogged = true;
  console.warn(
    '[StorageUrl] Storage sign failed via dev proxy — check VPS storage-api / Kong (docker logs supabase-storage)',
  );
}

function isLocalDevHost(url: string): boolean {
  return /localhost|127\.0\.0\.1/i.test(url);
}

function productionStorageBase(): string {
  return resolveSupabaseApiUrl(String(env.VITE_SUPABASE_URL ?? ''), {
    isNativeCapacitor,
    isDev: isDevBuild,
  });
}

/** Parse full URL, bucket/path ref, or legacy path-only (product-images). */
export function resolveStorageRef(rawUrl: string): StorageRef | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  for (const bucket of STORAGE_BUCKETS) {
    const slashRef = `${bucket}/`;
    if (trimmed.startsWith(slashRef) && !trimmed.includes('://')) {
      const path = trimmed.slice(slashRef.length).split('?')[0].trim();
      return path ? { bucket, path } : null;
    }
    const idx = trimmed.indexOf(`/${bucket}/`);
    if (idx >= 0) {
      const path = trimmed.slice(idx + bucket.length + 2).split('?')[0].trim();
      return path ? { bucket, path } : null;
    }
  }

  if (!trimmed.includes('://') && !trimmed.startsWith('/') && trimmed.includes('/')) {
    return { bucket: 'product-images', path: trimmed.split('?')[0] };
  }

  return null;
}

/** Persist in DB: bucket/path (no localhost host). */
export function storageRefForPersistence(bucket: StorageBucket, path: string): string {
  return `${bucket}/${path}`;
}

/** Rewrite signed URL host to ERP proxy; keep encoded path/query from Supabase intact. */
function rewriteSignedUrlForNative(signedUrl: string): string {
  const base = productionStorageBase().replace(/\/$/, '');
  if (!base) return signedUrl;
  const trimmed = signedUrl.trim();
  if (trimmed.startsWith(base)) return trimmed;
  return trimmed.replace(/^https:\/\/supabase\.dincouture\.pk/i, base);
}

async function createSignedUrlThrottled(
  bucket: StorageBucket,
  path: string,
  expiresSeconds: number,
): Promise<{ signedUrl?: string; error: unknown; authMissing?: boolean }> {
  return runWithNativeSignThrottle(async () => {
    const token = await waitForAccessToken();
    if (!token) {
      return { error: null, authMissing: true };
    }
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresSeconds);
    return { signedUrl: data?.signedUrl, error: error ?? null };
  });
}

function normalizePublicUrl(ref: StorageRef): string {
  if (isNativeCapacitor) {
    const base = productionStorageBase();
    if (base) return `${base}/storage/v1/object/public/${ref.bucket}/${ref.path}`;
  }
  const { data: pub } = supabase.storage.from(ref.bucket).getPublicUrl(ref.path);
  return pub.publicUrl || storageRefForPersistence(ref.bucket, ref.path);
}

async function tryProductImageRpc(
  path: string,
  expiresSeconds: number,
  cacheKey?: string,
): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc('get_product_image_signed_url', {
      p_path: path,
      p_expires_seconds: expiresSeconds,
    });
    if (error || !data?.ok) {
      if (isDevBuild && !devStorageProxyHintLogged) {
        console.warn('[StorageUrl] product RPC failed', error?.message ?? data?.error);
      }
      return null;
    }
    if (typeof data.signed_url === 'string' && data.signed_url) {
      return isNativeCapacitor ? rewriteSignedUrlForNative(data.signed_url) : data.signed_url;
    }
    if (typeof data.path === 'string' && data.path) {
      const { signedUrl, error: signErr } = await createSignedUrlThrottled(
        'product-images',
        data.path,
        expiresSeconds,
      );
      if (!signErr && signedUrl) {
        return isNativeCapacitor ? rewriteSignedUrlForNative(signedUrl) : signedUrl;
      }
      if (isUpstreamUnavailableError(signErr)) {
        logDevStorageProxyHintOnce();
        if (cacheKey) writeCache(cacheKey, null, SIGNED_URL_NEGATIVE_TTL_MS);
        return null;
      }
    }
  } catch (e) {
    if (isUpstreamUnavailableError(e)) {
      logDevStorageProxyHintOnce();
      if (cacheKey) writeCache(cacheKey, null, SIGNED_URL_NEGATIVE_TTL_MS);
      return null;
    }
    if (isDevBuild && !devStorageProxyHintLogged) console.warn('[StorageUrl] product RPC exception', e);
  }
  return null;
}

/**
 * Resolve a storage ref to a signed (or public) display URL.
 * On native: always rewrites host to VITE_SUPABASE_URL; never returns localhost.
 * Memoised per `bucket/path` to prevent retry storms on missing objects.
 */
export async function getStorageDisplayUrl(rawUrl: string): Promise<string | null> {
  if (!rawUrl || typeof rawUrl !== 'string') return null;

  const ref = resolveStorageRef(rawUrl);
  if (!ref) {
    if (isNativeCapacitor && isLocalDevHost(rawUrl)) return null;
    return rawUrl;
  }

  const cacheKey = `${ref.bucket}/${ref.path}`;
  const cached = readCache(cacheKey);
  if (cached) return cached.url;

  if (isDevBrowser && devStorageUpstreamUnavailable) {
    return null;
  }

  const inflight = signedUrlInflight.get(cacheKey);
  if (inflight) return inflight;

  const task = resolveStorageDisplayUrlNow(ref, cacheKey);
  signedUrlInflight.set(cacheKey, task);
  try {
    return await task;
  } finally {
    signedUrlInflight.delete(cacheKey);
  }
}

async function resolveStorageDisplayUrlNow(ref: StorageRef, cacheKey: string): Promise<string | null> {
  const expiresSeconds = 3600;
  let notFound = false;
  let upstreamUnavailable = false;
  let authError = false;

  try {
    const { signedUrl, error, authMissing } = await createSignedUrlThrottled(
      ref.bucket,
      ref.path,
      expiresSeconds,
    );
    if (authMissing) {
      return null;
    }
    if (!error && signedUrl) {
      const signed = isNativeCapacitor ? rewriteSignedUrlForNative(signedUrl) : signedUrl;
      if (isNativeCapacitor && isLocalDevHost(signed)) {
        writeCache(cacheKey, null, SIGNED_URL_NEGATIVE_TTL_MS);
        return null;
      }
      writeCache(cacheKey, signed, SIGNED_URL_POSITIVE_TTL_MS);
      return signed;
    }
    if (isNotFoundError(error)) notFound = true;
    if (isUpstreamUnavailableError(error)) upstreamUnavailable = true;
    if (isAuthError(error)) authError = true;
    if (!upstreamUnavailable && !authError) {
      if (isDevBuild) {
        console.warn('[StorageUrl] sign failed', ref.bucket, (error as { message?: string })?.message ?? 'no signedUrl');
      } else {
        logNativeStorageSignFailureOnce(ref.bucket, error);
      }
    }
  } catch (e) {
    if (isNotFoundError(e)) notFound = true;
    if (isUpstreamUnavailableError(e)) upstreamUnavailable = true;
    if (isAuthError(e)) authError = true;
    if (!upstreamUnavailable && !authError) {
      if (isDevBuild) console.warn('[StorageUrl] sign exception', ref.bucket, e);
      else logNativeStorageSignFailureOnce(ref.bucket, e);
    }
  }

  if (authError) {
    return null;
  }

  if (notFound || upstreamUnavailable) {
    if (upstreamUnavailable) {
      if (isDevBrowser) devStorageUpstreamUnavailable = true;
      logDevStorageProxyHintOnce();
    }
    writeCache(cacheKey, null, SIGNED_URL_NEGATIVE_TTL_MS);
    return null;
  }

  if (ref.bucket === 'product-images') {
    const rpcUrl = await tryProductImageRpc(ref.path, expiresSeconds, cacheKey);
    if (rpcUrl) {
      writeCache(cacheKey, rpcUrl, SIGNED_URL_POSITIVE_TTL_MS);
      return rpcUrl;
    }
  }

  if (isNativeCapacitor) {
    const pub = normalizePublicUrl(ref);
    if (pub && !isLocalDevHost(pub)) {
      writeCache(cacheKey, pub, SIGNED_URL_POSITIVE_TTL_MS);
      return pub;
    }
    writeCache(cacheKey, null, SIGNED_URL_NEGATIVE_TTL_MS);
    return null;
  }

  const pub = normalizePublicUrl(ref);
  writeCache(cacheKey, pub, SIGNED_URL_POSITIVE_TTL_MS);
  return pub;
}

/** Drop the cached entry for a path (e.g. after re-upload of the same file). */
export function invalidateStorageDisplayUrl(rawUrl: string): void {
  const ref = resolveStorageRef(rawUrl);
  if (!ref) return;
  signedUrlCache.delete(`${ref.bucket}/${ref.path}`);
}

/** Clear all signed URL cache (e.g. after login so negative cache does not stick). */
export function clearStorageDisplayUrlCache(): void {
  signedUrlCache.clear();
  signedUrlInflight.clear();
  devStorageUpstreamUnavailable = false;
  nativeStorageSignWarnLogged = false;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('erp-storage-cache-cleared'));
  }
}

export function getStoragePublicUrl(rawUrl: string): string {
  const ref = resolveStorageRef(rawUrl);
  if (!ref) return rawUrl;
  return normalizePublicUrl(ref);
}

export function extractProductImageStoragePath(rawUrl: string): string | null {
  const ref = resolveStorageRef(rawUrl);
  if (!ref) return null;
  if (ref.bucket === 'product-images') return ref.path;
  return null;
}
