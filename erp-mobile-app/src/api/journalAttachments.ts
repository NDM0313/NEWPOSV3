/**
 * Journal entry attachments — same bucket/path as web uploadTransactionAttachments.
 */
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { storageRefForPersistence } from '../utils/storageDisplayUrl';

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
): Promise<AttachmentResult[]> {
  if (!isSupabaseConfigured || !files.length || !companyId) return [];
  const prefix = `journal-entries/${companyId}/${Date.now()}`;
  const results: AttachmentResult[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (file.size > MAX_FILE_SIZE_BYTES) continue;
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const path = `${prefix}_${i}_${safeName}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      upsert: true,
      contentType: file.type || 'application/octet-stream',
    });
    if (!error) {
      results.push({ url: storageRefForPersistence(BUCKET, path), name: file.name });
    }
  }
  return results;
}
