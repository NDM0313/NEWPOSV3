/**
 * Payment attachments: upload to Supabase Storage (payment-attachments bucket)
 * and save URLs to payments.attachments. Same pattern as web UnifiedPaymentDialog.
 */
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { storageRefForPersistence } from '../utils/storageDisplayUrl';
import { UPLOAD_TIMEOUT_MS, withUploadTimeout } from '../utils/uploadWithTimeout';

const BUCKET = 'payment-attachments';
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const ACCEPT_TYPES = '.pdf,.png,.jpg,.jpeg';

export interface AttachmentResult {
  url: string;
  name: string;
}

/**
 * Upload files to payment-attachments bucket.
 * Path: {companyId}/{referenceId (sale id)}/{timestamp}_{index}_{safeName}
 */
export async function uploadPaymentAttachments(
  companyId: string,
  referenceId: string,
  paymentId: string,
  files: File[]
): Promise<AttachmentResult[]> {
  if (!isSupabaseConfigured || !files.length) return [];
  const results: AttachmentResult[] = [];
  const prefix = `${companyId}/${referenceId}/${paymentId}_${Date.now()}`;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (file.size > MAX_FILE_SIZE_BYTES) continue;
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const path = `${prefix}_${i}_${safeName}`;

    try {
      const { error } = await withUploadTimeout(
        supabase.storage.from(BUCKET).upload(path, file, {
          upsert: true,
          contentType: file.type || 'application/octet-stream',
        }),
        UPLOAD_TIMEOUT_MS,
        `Upload ${file.name}`,
      );
      if (!error) {
        results.push({ url: storageRefForPersistence(BUCKET, path), name: file.name });
      }
    } catch (err) {
      console.warn('[uploadPaymentAttachments]', (err as Error)?.message ?? err);
    }
  }
  return results;
}

/**
 * Update payments.attachments for a payment (after upload).
 */
export async function updatePaymentAttachments(
  paymentId: string,
  attachments: AttachmentResult[]
): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured) return { error: 'App not configured.' };
  const { error } = await supabase
    .from('payments')
    .update({ attachments: attachments.length ? attachments : null })
    .eq('id', paymentId);
  return { error: error?.message ?? null };
}

export { MAX_FILE_SIZE_BYTES, ACCEPT_TYPES };
