import { supabase } from '@/lib/supabase';

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
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const path = `${prefix}_${i}_${safeName}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      upsert: true,
      contentType: file.type || 'application/octet-stream',
    });
    if (!error) {
      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
      results.push({ url: urlData?.publicUrl || path, name: file.name });
    }
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
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const path = `${prefix}_${i}_${safeName}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      upsert: true,
      contentType: file.type || 'application/octet-stream',
    });
    if (!error) {
      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
      results.push({ url: urlData?.publicUrl || path, name: file.name });
    }
  }
  return results;
}
