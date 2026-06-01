import { Capacitor } from '@capacitor/core';
import { supabase } from '../lib/supabase';
import type { StorageBucket } from './storageDisplayUrl';
import { nativeStorageObjectUpload } from './nativeStorageUpload';
import {
  classifyStorageUploadError,
  isBucketNotFoundError,
  isStorageRlsError,
  messageFrom,
  storageErrorStatus,
} from './storageUploadErrors';

const env: Record<string, string | boolean | undefined> =
  typeof import.meta !== 'undefined' && (import.meta as { env?: Record<string, string | boolean> }).env
    ? (import.meta as { env: Record<string, string | boolean> }).env
    : {};

function isFetchLikeUploadFailure(err: unknown): boolean {
  const classified = classifyStorageUploadError(err);
  const combined = `${classified.userMessage} ${messageFrom(err)}`.toLowerCase();
  return /failed to fetch|network error|load failed|fetch failed/i.test(combined);
}

/** On native APK, retry upload via CapacitorHttp when WebView supabase-js storage POST fails. */
function shouldRetryWithNativeUpload(err: unknown): boolean {
  if (!Capacitor.isNativePlatform()) return false;
  if (isStorageRlsError(err) || isBucketNotFoundError(err)) return false;
  if (isFetchLikeUploadFailure(err)) return true;
  const status = storageErrorStatus(err);
  if (status == null || status === 0) return true;
  if (status >= 500) return true;
  return true;
}

async function tryNativeUpload(
  bucket: StorageBucket,
  path: string,
  body: ArrayBuffer,
  contentType: string,
  upsert: boolean,
): Promise<{ error: string | null; usedNativeFallback: boolean }> {
  const native = await nativeStorageObjectUpload(bucket, path, body, contentType, upsert);
  if (Boolean(env.DEV) && !native.error) {
    console.info('[storageUpload] native fallback used', bucket, path);
  }
  return { error: native.error, usedNativeFallback: true };
}

export type StorageObjectUploadResult = {
  error: string | null;
  usedNativeFallback: boolean;
};

/**
 * Upload one storage object: supabase-js first, then native CapacitorHttp on APK when needed.
 */
export async function uploadStorageObjectWithNativeFallback(
  bucket: StorageBucket,
  path: string,
  body: ArrayBuffer,
  contentType: string,
  options?: { upsert?: boolean; fileLabel?: string },
): Promise<StorageObjectUploadResult> {
  const upsert = options?.upsert ?? false;

  if (Capacitor.isNativePlatform() && body.byteLength > 0) {
    const native = await tryNativeUpload(bucket, path, body, contentType, upsert);
    if (!native.error) return native;
  }

  try {
    const { error } = await supabase.storage.from(bucket).upload(path, body, {
      contentType: contentType || 'application/octet-stream',
      upsert,
    });
    if (!error) return { error: null, usedNativeFallback: false };

    if (shouldRetryWithNativeUpload(error)) {
      return tryNativeUpload(bucket, path, body, contentType, upsert);
    }
    const classified = classifyStorageUploadError(error, options?.fileLabel ?? 'file');
    return { error: classified.userMessage, usedNativeFallback: false };
  } catch (err) {
    if (shouldRetryWithNativeUpload(err)) {
      return tryNativeUpload(bucket, path, body, contentType, upsert);
    }
    const classified = classifyStorageUploadError(err, options?.fileLabel ?? 'file');
    return { error: classified.userMessage, usedNativeFallback: false };
  }
}
