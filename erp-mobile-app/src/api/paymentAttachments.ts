/**
 * Payment attachments: upload to Supabase Storage (payment-attachments bucket)
 * and save URLs to payments.attachments. Same pattern as web UnifiedPaymentDialog.
 */
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { UPLOAD_TIMEOUT_MS, withUploadTimeout } from '../utils/uploadWithTimeout';
import {
  classifyStorageUploadError,
  isStorageSizeError,
  type UploadFailure,
  type UploadWithFailuresResult,
} from '../utils/storageUploadErrors';
import { uploadStorageAttachmentFile } from '../utils/storageAttachmentPipeline';

const BUCKET = 'payment-attachments';
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const ACCEPT_TYPES = '.pdf,.png,.jpg,.jpeg';

export interface AttachmentResult {
  url: string;
  name: string;
}

export type PaymentAttachmentsUploadResult = UploadWithFailuresResult<AttachmentResult>;

/**
 * Upload files to payment-attachments bucket.
 * Path: {companyId}/{referenceId (sale id)}/{timestamp}_{index}_{safeName}
 */
export async function uploadPaymentAttachments(
  companyId: string,
  referenceId: string,
  paymentId: string,
  files: File[],
): Promise<PaymentAttachmentsUploadResult> {
  if (!isSupabaseConfigured || !files.length) return { results: [], failures: [] };
  const results: AttachmentResult[] = [];
  const failures: UploadFailure[] = [];
  const prefix = `${companyId}/${referenceId}/${paymentId}_${Date.now()}`;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (file.size > MAX_FILE_SIZE_BYTES) {
      failures.push({
        fileName: file.name,
        ...classifyStorageUploadError(new Error('File too large'), file.name),
      });
      continue;
    }
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const path = `${prefix}_${i}_${safeName}`;

    try {
      const { ref } = await withUploadTimeout(
        uploadStorageAttachmentFile({
          bucket: BUCKET,
          path,
          file,
          upsert: true,
          logTag: 'payment-attachments',
        }),
        UPLOAD_TIMEOUT_MS,
        `Upload ${file.name}`,
      );
      results.push({ url: ref, name: file.name });
    } catch (err) {
      console.warn('[uploadPaymentAttachments]', (err as Error)?.message ?? err);
      failures.push({
        fileName: file.name,
        ...classifyStorageUploadError(err, file.name),
      });
    }
  }
  return { results, failures };
}

/**
 * Update payments.attachments for a payment (after upload).
 */
export async function updatePaymentAttachments(
  paymentId: string,
  attachments: AttachmentResult[],
): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured) return { error: 'App not configured.' };
  const { error } = await supabase
    .from('payments')
    .update({ attachments: attachments.length ? attachments : null })
    .eq('id', paymentId);
  return { error: error?.message ?? null };
}

export { MAX_FILE_SIZE_BYTES, ACCEPT_TYPES, isStorageSizeError };
