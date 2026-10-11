/**
 * Shared native-safe storage upload for attachments (sale, purchase, payment, expense, journal).
 * Product images stay in productImageUpload.ts — same core pattern, do not change product paths here.
 */
import { Capacitor } from '@capacitor/core';

import { supabase } from '../lib/supabase';
import { debugLog, debugLogWarn } from '../lib/mobileDebugLog';
import { isPlausibleImageBlob } from './imageBlobValidation';
import { nativeStorageObjectDownload } from './nativeStorageDownload';
import { storageUploadBody } from './storageUploadBody';
import { uploadStorageObjectWithNativeFallback } from './storageObjectUpload';
import {
  bustStorageDisplayCache,
  isStorageImagePath,
  storageRefForPersistence,
  type StorageBucket,
} from './storageDisplayUrl';

export const ATTACHMENT_UPLOAD_VERIFY_FAIL_MSG =
  'Server par file save nahi hui (file bahut choti). Dubara attach karein aur save karein.';

export type StorageAttachmentUploadOptions = {
  bucket: StorageBucket;
  path: string;
  file: File;
  upsert?: boolean;
  /** Post-upload download verify for image paths (recommended on native). */
  verifyImage?: boolean;
  logTag?: string;
};

export type StorageAttachmentUploadResult = {
  ref: string;
  usedNativeFallback: boolean;
};

async function verifyImageOnServer(
  bucket: StorageBucket,
  path: string,
  sentBytes: number,
  logTag: string,
): Promise<void> {
  const verify = await nativeStorageObjectDownload(bucket, path);
  const stored = verify.data?.size ?? 0;
  if (!verify.data || !(await isPlausibleImageBlob(verify.data))) {
    debugLogWarn(logTag, 'post-upload verify failed', `${path} stored=${stored} sent=${sentBytes}`);
    throw new Error(ATTACHMENT_UPLOAD_VERIFY_FAIL_MSG);
  }
  debugLog(logTag, 'post-upload verify ok', { path, stored, sent: sentBytes });
}

async function uploadWithNativeFileTry(
  bucket: StorageBucket,
  path: string,
  file: File,
  body: ArrayBuffer,
  contentType: string,
  upsert: boolean,
  logTag: string,
): Promise<{ usedNativeFallback: boolean } | { error: string }> {
  if (file.size !== body.byteLength) {
    debugLogWarn(logTag, 'file.size vs buffer mismatch', `file=${file.size} buffer=${body.byteLength}`);
  }

  if (Capacitor.isNativePlatform()) {
    debugLog(logTag, 'native File upload try', {
      path,
      fileSize: file.size,
      bufferBytes: body.byteLength,
    });
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      contentType: contentType || 'application/octet-stream',
      upsert,
    });
    if (!error) {
      debugLog(logTag, 'supabase-js File upload ok', path);
      return { usedNativeFallback: false };
    }
    debugLogWarn(logTag, 'File upload failed → native binary', error.message);
  }

  const { error, usedNativeFallback } = await uploadStorageObjectWithNativeFallback(
    bucket,
    path,
    body,
    contentType || 'application/octet-stream',
    { upsert, fileLabel: file.name },
  );
  if (error) return { error };
  return { usedNativeFallback };
}

/**
 * Upload one attachment/receipt file with native-first binary path on Capacitor.
 */
export async function uploadStorageAttachmentFile(
  options: StorageAttachmentUploadOptions,
): Promise<StorageAttachmentUploadResult> {
  const {
    bucket,
    path,
    file,
    upsert = true,
    verifyImage = Capacitor.isNativePlatform() && isStorageImagePath(path),
    logTag = 'storageAttachment',
  } = options;

  const { body, contentType } = await storageUploadBody(file);
  const uploadResult = await uploadWithNativeFileTry(
    bucket,
    path,
    file,
    body,
    contentType,
    upsert,
    logTag,
  );

  if ('error' in uploadResult) {
    throw new Error(uploadResult.error);
  }

  if (verifyImage) {
    await verifyImageOnServer(bucket, path, body.byteLength, logTag);
  }

  const ref = storageRefForPersistence(bucket, path);
  bustStorageDisplayCache([ref]);
  debugLog(logTag, 'upload ok', { path, bucket, bytes: body.byteLength });

  return { ref, usedNativeFallback: uploadResult.usedNativeFallback };
}
