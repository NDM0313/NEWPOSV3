/**
 * Journal entry attachments — same bucket/path as web uploadTransactionAttachments.
 */
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { storageRefForPersistence } from '../utils/storageDisplayUrl';
import { UPLOAD_TIMEOUT_MS, withUploadTimeout } from '../utils/uploadWithTimeout';
import { storageUploadBody } from '../utils/storageUploadBody';
import {
  classifyStorageUploadError,
  type UploadFailure,
  type UploadWithFailuresResult,
} from '../utils/storageUploadErrors';

const BUCKET = 'payment-attachments';
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export interface AttachmentResult {
  url: string;
  name: string;
}

export { MAX_FILE_SIZE_BYTES };
export const JOURNAL_ACCEPT_TYPES = '.pdf,.png,.jpg,.jpeg';

export async function uploadJournalEntryAttachments(
  companyId: string,
  files: File[],
): Promise<UploadWithFailuresResult<AttachmentResult>> {
  if (!isSupabaseConfigured || !files.length || !companyId) return { results: [], failures: [] };
  const prefix = `journal-entries/${companyId}/${Date.now()}`;
  const results: AttachmentResult[] = [];
  const failures: UploadFailure[] = [];

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
      const { body, contentType } = await storageUploadBody(file);
      const { error } = await withUploadTimeout(
        supabase.storage.from(BUCKET).upload(path, body, {
          upsert: true,
          contentType,
        }),
        UPLOAD_TIMEOUT_MS,
        `Upload ${file.name}`,
      );
      if (error) {
        console.warn('[uploadJournalEntryAttachments]', file.name, error.message);
        failures.push({
          fileName: file.name,
          ...classifyStorageUploadError(error, file.name),
        });
      } else {
        results.push({ url: storageRefForPersistence(BUCKET, path), name: file.name });
      }
    } catch (err) {
      console.warn('[uploadJournalEntryAttachments]', (err as Error)?.message ?? err);
      failures.push({
        fileName: file.name,
        ...classifyStorageUploadError(err, file.name),
      });
    }
  }
  return { results, failures };
}
