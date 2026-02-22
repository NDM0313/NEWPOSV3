import { supabase } from '@/lib/supabase';
import { getSupabaseStorageDashboardUrl } from './paymentAttachmentUrl';
import { toast } from 'sonner';

export type AttachmentResult = { url: string; name: string };

const STORAGE_RLS_TOAST_MESSAGE =
  'Storage upload blocked by RLS. Fix: (1) VPS: cd /root/NEWPOSV3 && bash deploy/deploy.sh — RLS applies automatically. (2) Or Supabase Dashboard → SQL Editor → run RUN_THIS_FOR_STORAGE_RLS.sql. (3) Local: npm run apply-storage-rls (DATABASE_URL in .env.local).';

function isStorageRlsError(error: { message?: string } | null): boolean {
  const msg = String(error?.message || '').toLowerCase();
  return msg.includes('row-level security') || msg.includes('policy');
}

export function showStorageRlsToast(): void {
  toast.error(STORAGE_RLS_TOAST_MESSAGE, { duration: 14000 });
}

/**
 * Upload files to purchase-attachments bucket.
 * Path: {companyId}/{purchaseId}/{timestamp}_{index}_{filename}
 */
export async function uploadPurchaseAttachments(
  companyId: string,
  purchaseId: string,
  files: File[]
): Promise<AttachmentResult[]> {
  if (!files.length) return [];
  const bucket = 'purchase-attachments';
  const prefix = `${companyId}/${purchaseId}/${Date.now()}`;
  const results: AttachmentResult[] = [];
  let anyUploadFailed = false;
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const path = `${prefix}_${i}_${safeName}`;
    
    try {
      const { error } = await supabase.storage.from(bucket).upload(path, file, {
        upsert: true,
        contentType: file.type || 'application/octet-stream',
      });
      
      if (error) {
        anyUploadFailed = true;
        console.error(`[UPLOAD PURCHASE ATTACHMENTS] Failed to upload ${file.name}:`, error);
        
        // Check if bucket doesn't exist
        const errorMsg = String(error?.message || '').toLowerCase();
        if (isStorageRlsError(error)) {
          showStorageRlsToast();
          break;
        }
        if (errorMsg.includes('bucket not found') || errorMsg.includes('does not exist') || error.statusCode === 400) {
          toast.error(
            `Storage bucket "purchase-attachments" not found. Please create it in Supabase Dashboard → Storage.`,
            {
              duration: 10000,
              action: {
                label: 'Open Storage',
                onClick: () => window.open(getSupabaseStorageDashboardUrl(), '_blank'),
              },
            }
          );
          // Don't continue trying other files if bucket is missing
          break;
        }
      } else {
        const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
        results.push({ url: urlData?.publicUrl || path, name: file.name });
        console.log(`[UPLOAD PURCHASE ATTACHMENTS] ✅ Uploaded: ${file.name}`);
      }
    } catch (err: any) {
      anyUploadFailed = true;
      console.error(`[UPLOAD PURCHASE ATTACHMENTS] Exception uploading ${file.name}:`, err);
    }
  }
  
  if (anyUploadFailed && results.length === 0) {
    console.warn('[UPLOAD PURCHASE ATTACHMENTS] All uploads failed');
  } else if (anyUploadFailed) {
    console.warn(`[UPLOAD PURCHASE ATTACHMENTS] Some uploads failed (${results.length}/${files.length} succeeded)`);
  }
  
  return results;
}

/**
 * Upload files to sale-attachments bucket.
 * Path: {companyId}/{saleId}/{timestamp}_{index}_{filename}
 */
export async function uploadSaleAttachments(
  companyId: string,
  saleId: string,
  files: File[]
): Promise<AttachmentResult[]> {
  if (!files.length) return [];
  const bucket = 'sale-attachments';
  const prefix = `${companyId}/${saleId}/${Date.now()}`;
  const results: AttachmentResult[] = [];
  let anyUploadFailed = false;
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const path = `${prefix}_${i}_${safeName}`;
    
    try {
      const { error } = await supabase.storage.from(bucket).upload(path, file, {
        upsert: true,
        contentType: file.type || 'application/octet-stream',
      });
      
      if (error) {
        anyUploadFailed = true;
        console.error(`[UPLOAD SALE ATTACHMENTS] Failed to upload ${file.name}:`, error);
        
        // Check if bucket doesn't exist
        const errorMsg = String(error?.message || '').toLowerCase();
        if (isStorageRlsError(error)) {
          showStorageRlsToast();
          break;
        }
        if (errorMsg.includes('bucket not found') || errorMsg.includes('does not exist') || error.statusCode === 400) {
          toast.error(
            `Storage bucket "sale-attachments" not found. Please create it in Supabase Dashboard → Storage.`,
            {
              duration: 10000,
              action: {
                label: 'Open Storage',
                onClick: () => window.open(getSupabaseStorageDashboardUrl(), '_blank'),
              },
            }
          );
          // Don't continue trying other files if bucket is missing
          break;
        }
      } else {
        const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
        results.push({ url: urlData?.publicUrl || path, name: file.name });
        console.log(`[UPLOAD SALE ATTACHMENTS] ✅ Uploaded: ${file.name}`);
      }
    } catch (err: any) {
      anyUploadFailed = true;
      console.error(`[UPLOAD SALE ATTACHMENTS] Exception uploading ${file.name}:`, err);
    }
  }
  
  if (anyUploadFailed && results.length === 0) {
    console.warn('[UPLOAD SALE ATTACHMENTS] All uploads failed');
  } else if (anyUploadFailed) {
    console.warn(`[UPLOAD SALE ATTACHMENTS] Some uploads failed (${results.length}/${files.length} succeeded)`);
  }
  
  return results;
}

/**
 * Upload journal entry attachments (pictures/documents) to payment-attachments bucket.
 * Path: journal-entries/{companyId}/{timestamp}_{index}_{filename}
 * Use for Manual Journal Entry and any journal entry attachment.
 */
export async function uploadJournalEntryAttachments(
  companyId: string,
  files: File[]
): Promise<AttachmentResult[]> {
  if (!files.length || !companyId) return [];
  const bucket = 'payment-attachments';
  const prefix = `journal-entries/${companyId}/${Date.now()}`;
  const results: AttachmentResult[] = [];
  let anyUploadFailed = false;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const path = `${prefix}_${i}_${safeName}`;
    try {
      const { error } = await supabase.storage.from(bucket).upload(path, file, {
        upsert: true,
        contentType: file.type || 'application/octet-stream',
      });
      if (error) {
        anyUploadFailed = true;
        console.error(`[UPLOAD JOURNAL ATTACHMENTS] Failed to upload ${file.name}:`, error);
        const errorMsg = String(error?.message || '').toLowerCase();
        if (isStorageRlsError(error)) {
          showStorageRlsToast();
          break;
        }
        if (errorMsg.includes('bucket not found') || errorMsg.includes('does not exist') || error.statusCode === 400) {
          toast.error(
            'Storage bucket "payment-attachments" not found. Create it in Supabase Dashboard → Storage (see migration 20).',
            {
              duration: 10000,
              action: { label: 'Open Storage', onClick: () => window.open(getSupabaseStorageDashboardUrl(), '_blank') },
            }
          );
          break;
        }
      } else {
        const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
        results.push({ url: urlData?.publicUrl || path, name: file.name });
      }
    } catch (err: any) {
      anyUploadFailed = true;
      console.error(`[UPLOAD JOURNAL ATTACHMENTS] Exception uploading ${file.name}:`, err);
    }
  }
  if (anyUploadFailed && results.length === 0) {
    toast.warning('Attachment upload failed. Entry will save without files.');
  } else if (anyUploadFailed && results.length < files.length) {
    toast.warning(`Only ${results.length} of ${files.length} file(s) uploaded.`);
  }
  return results;
}
