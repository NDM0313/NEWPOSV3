import { supabase } from '@/lib/supabase';

const BUCKET = 'payment-attachments';

/** Supabase Dashboard Storage URL for the current project (create bucket here). */
export function getSupabaseStorageDashboardUrl(): string {
  const url = typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL
    ? String(import.meta.env.VITE_SUPABASE_URL)
    : '';
  const projectRef = url.replace(/^https:\/\//, '').split('.')[0] || '';
  return projectRef
    ? `https://supabase.com/dashboard/project/${projectRef}/storage/buckets`
    : 'https://supabase.com/dashboard';
}

const KNOWN_BUCKETS = ['payment-attachments', 'purchase-attachments', 'sale-attachments'];

/**
 * Returns a URL that will work for opening the attachment.
 * For Supabase storage (payment-attachments, purchase-attachments, sale-attachments), returns a signed URL so it works when the bucket is private.
 * For other URLs, returns as-is.
 */
export async function getAttachmentOpenUrl(rawUrl: string): Promise<string> {
  if (!rawUrl || typeof rawUrl !== 'string') return rawUrl;
  try {
    let bucket: string | null = null;
    let path: string | null = null;
    for (const b of KNOWN_BUCKETS) {
      const idx = rawUrl.indexOf(`/${b}/`);
      if (idx !== -1) {
        bucket = b;
        path = rawUrl.slice(idx + b.length + 2);
        break;
      }
    }
    if (!bucket || !path) return rawUrl;
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
    if (error || !data?.signedUrl) return rawUrl;
    return data.signedUrl;
  } catch {
    return rawUrl;
  }
}
