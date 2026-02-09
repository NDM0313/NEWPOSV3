import { supabase } from '@/lib/supabase';
import { getSupabaseStorageDashboardUrl } from './paymentAttachmentUrl';
import { toast } from 'sonner';

export type AttachmentResult = { url: string; name: string };

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
