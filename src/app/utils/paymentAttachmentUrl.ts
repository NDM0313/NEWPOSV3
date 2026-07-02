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

const KNOWN_BUCKETS = ['payment-attachments', 'purchase-attachments', 'sale-attachments', 'expense-receipts'];

export function storageRefForPersistence(bucket: string, path: string): string {
  return `${bucket}/${path}`;
}

function resolveAttachmentRef(rawUrl: string): { bucket: string; path: string } | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  for (const bucket of KNOWN_BUCKETS) {
    const prefix = `${bucket}/`;
    if (trimmed.startsWith(prefix) && !trimmed.includes('://')) {
      const path = trimmed.slice(prefix.length).split('?')[0].trim();
      return path ? { bucket, path } : null;
    }
    const idx = trimmed.indexOf(`/${bucket}/`);
    if (idx !== -1) {
      const path = trimmed.slice(idx + bucket.length + 2).split('?')[0].trim();
      return path ? { bucket, path } : null;
    }
  }
  return null;
}

/**
 * Returns a URL that will work for opening the attachment.
 * For Supabase storage (payment-attachments, purchase-attachments, sale-attachments), returns a signed URL so it works when the bucket is private.
 * For other URLs, returns as-is.
 */
export async function getAttachmentOpenUrl(rawUrl: string): Promise<string> {
  if (!rawUrl || typeof rawUrl !== 'string') return rawUrl;
  try {
    const resolved = resolveAttachmentRef(rawUrl);
    if (!resolved) return rawUrl;
    const { data, error } = await supabase.storage.from(resolved.bucket).createSignedUrl(resolved.path, 3600);
    if (error || !data?.signedUrl) return rawUrl;
    return data.signedUrl;
  } catch {
    return rawUrl;
  }
}
