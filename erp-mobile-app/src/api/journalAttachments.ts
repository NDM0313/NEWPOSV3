/**
 * Journal entry attachments — same bucket/path as web uploadTransactionAttachments.
 */
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { UPLOAD_TIMEOUT_MS, withUploadTimeout } from '../utils/uploadWithTimeout';
import {
  classifyStorageUploadError,
  type UploadFailure,
  type UploadWithFailuresResult,
} from '../utils/storageUploadErrors';
import { uploadStorageAttachmentFile } from '../utils/storageAttachmentPipeline';

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
      const { ref } = await withUploadTimeout(
        uploadStorageAttachmentFile({
          bucket: BUCKET,
          path,
          file,
          upsert: true,
          logTag: 'journal-attachments',
        }),
        UPLOAD_TIMEOUT_MS,
        `Upload ${file.name}`,
      );
      results.push({ url: ref, name: file.name });
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

/** Persist merged attachment list on journal_entries.attachments. */
export async function updateJournalEntryAttachments(
  journalEntryId: string,
  attachments: AttachmentResult[],
): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured) return { error: 'App not configured.' };
  const { error } = await supabase
    .from('journal_entries')
    .update({ attachments: attachments.length ? attachments : null })
    .eq('id', journalEntryId);
  return { error: error?.message ?? null };
}
