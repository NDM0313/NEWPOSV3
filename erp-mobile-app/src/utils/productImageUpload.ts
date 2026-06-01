import { Capacitor } from '@capacitor/core';
import { supabase } from '../lib/supabase';
import {
  extractProductImageStoragePath,
  bustProductImageDisplayCache,
  getProductImageBlobDisplayUrl,
  getStorageDisplayUrl,
  getStoragePublicUrl,
  storageRefForPersistence,
  type StorageBucket,
} from './storageDisplayUrl';

export { getProductImageBlobDisplayUrl };
import { compressImageIfNeeded } from './imageCompression';
import { storageUploadBody } from './storageUploadBody';
import { debugLog, debugLogWarn } from '../lib/mobileDebugLog';
import { isPlausibleImageBlob } from './imageBlobValidation';
import { nativeStorageObjectDownload } from './nativeStorageDownload';
import { uploadStorageObjectWithNativeFallback } from './storageObjectUpload';

const BUCKET = 'product-images';

const UPLOAD_VERIFY_FAIL_MSG =
  'Server par photo save nahi hui (file bahut choti). Dubara photo lein aur save karein.';

export { extractProductImageStoragePath };

/** Map DB image_urls to stable `product-images/...` refs for display/signing. */
export function normalizeProductImageUrls(urls: string[] | null | undefined): string[] {
  if (!Array.isArray(urls)) return [];
  const out: string[] = [];
  for (const raw of urls) {
    const path = extractProductImageStoragePath(raw);
    if (!path) continue;
    const ref = storageRefForPersistence('product-images' as StorageBucket, path);
    if (!out.includes(ref)) out.push(ref);
  }
  return out;
}

export function normalizeProductImagePublicUrl(rawUrl: string, storagePath?: string): string {
  const path = storagePath ?? extractProductImageStoragePath(rawUrl);
  if (!path) return rawUrl;
  return getStoragePublicUrl(storageRefForPersistence(BUCKET, path));
}

export function productImageUrlForPersistence(storagePath: string): string {
  return storageRefForPersistence(BUCKET, storagePath);
}

/** Primary list/preview thumb — always `image_urls[0]` after prepend/replace rules. */
export function primaryImageUrl(urls: string[] | undefined | null): string | null {
  return urls?.[0] ?? null;
}

export async function getProductImageDisplayUrl(rawUrl: string): Promise<string | null> {
  return getStorageDisplayUrl(rawUrl);
}

async function verifyProductImageOnServer(path: string, sentBytes: number): Promise<void> {
  const verify = await nativeStorageObjectDownload(BUCKET, path);
  const stored = verify.data?.size ?? 0;
  if (!verify.data || !(await isPlausibleImageBlob(verify.data))) {
    debugLogWarn(
      'uploadProductImages',
      'post-upload verify failed',
      `${path} stored=${stored} sent=${sentBytes}`,
    );
    throw new Error(UPLOAD_VERIFY_FAIL_MSG);
  }
  debugLog('uploadProductImages', 'post-upload verify ok', { path, stored, sent: sentBytes });
}

async function uploadOneProductImage(
  path: string,
  file: File,
  body: ArrayBuffer,
  contentType: string,
): Promise<{ usedNativeFallback: boolean }> {
  if (file.size !== body.byteLength) {
    debugLogWarn(
      'uploadProductImages',
      'file.size vs buffer mismatch',
      `file=${file.size} buffer=${body.byteLength}`,
    );
  }

  if (Capacitor.isNativePlatform()) {
    debugLog('uploadProductImages', 'native File upload try', {
      path,
      fileSize: file.size,
      bufferBytes: body.byteLength,
    });
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      contentType: contentType || 'image/jpeg',
      upsert: false,
    });
    if (!error) {
      debugLog('uploadProductImages', 'supabase-js File upload ok', path);
      return { usedNativeFallback: false };
    }
    debugLogWarn('uploadProductImages', 'File upload failed → native binary', error.message);
  }

  const { error, usedNativeFallback } = await uploadStorageObjectWithNativeFallback(
    BUCKET,
    path,
    body,
    contentType || 'image/jpeg',
    { upsert: false, fileLabel: file.name },
  );
  if (error) throw new Error(error);
  return { usedNativeFallback };
}

export async function uploadProductImages(
  companyId: string,
  productId: string,
  files: File[],
): Promise<string[]> {
  if (!files.length) return [];
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) throw new Error('You must be logged in to upload product images.');

  const urls: string[] = [];
  for (const raw of files) {
    const file = await compressImageIfNeeded(raw);
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const uuid =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const path = `${companyId}/${productId}/${uuid}.${ext}`;
    const { body, contentType } = await storageUploadBody(file);
    debugLog('uploadProductImages', 'upload start', {
      path,
      file: file.name,
      fileSize: file.size,
      bufferBytes: body.byteLength,
    });

    let usedNativeFallback = false;
    try {
      const result = await uploadOneProductImage(path, file, body, contentType);
      usedNativeFallback = result.usedNativeFallback;
    } catch (e) {
      const msg = String((e as Error)?.message ?? e);
      debugLogWarn('uploadProductImages', 'upload failed', `${path} | ${msg}`);
      if (/bucket not found/i.test(msg)) {
        throw new Error("Bucket 'product-images' not found. Create it in the Supabase Dashboard → Storage.");
      }
      if (/row-level security|violates|permissions/i.test(msg)) {
        throw new Error('Image upload blocked by Storage security policies. Please apply the product-images Storage RLS migration.');
      }
      throw new Error(msg || 'Failed to upload image');
    }

    if (Capacitor.isNativePlatform()) {
      await verifyProductImageOnServer(path, body.byteLength);
    }

    const ref = productImageUrlForPersistence(path);
    bustProductImageDisplayCache([ref]);
    debugLog('uploadProductImages', 'upload ok', { ref, native: usedNativeFallback, sent: body.byteLength });
    urls.push(ref);
  }
  return urls;
}

/** Best-effort delete storage objects when user removes images from a product (non-fatal). */
export async function removeProductImagesFromStorage(urls: string[]): Promise<void> {
  const paths = urls
    .map((u) => extractProductImageStoragePath(u))
    .filter((p): p is string => Boolean(p));
  if (paths.length === 0) return;
  const { error } = await supabase.storage.from(BUCKET).remove(paths);
  if (error) {
    console.warn('[removeProductImagesFromStorage]', error.message);
  }
}
