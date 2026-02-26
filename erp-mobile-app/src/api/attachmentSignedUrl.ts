/**
 * Get expiring signed URL for storage attachment (RLS-safe, no public URL exposure).
 */
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const BUCKET = 'payment-attachments';
const EXPIRES_IN = 3600; // 1 hour

/**
 * Extract storage path from a public or signed Supabase storage URL.
 * Handles: .../object/public/payment-attachments/PATH, .../object/signature/..., or raw path.
 */
function getPathFromStorageUrl(rawUrl: string): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  // Already a storage path (no protocol): e.g. "companyId/refId/file.jpg"
  if (!trimmed.startsWith('http')) {
    const path = trimmed.split('?')[0].trim();
    return path || null;
  }
  const idx = trimmed.indexOf(`/${BUCKET}/`);
  if (idx === -1) return null;
  const after = trimmed.slice(idx + BUCKET.length + 2);
  const path = after.split('?')[0].trim();
  return path || null;
}

/**
 * Returns a signed URL for the attachment (secure, expiring).
 * Use for preview/download; do not expose public URL.
 */
export async function getSignedUrlForAttachment(rawUrl: string): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  const path = getPathFromStorageUrl(rawUrl);
  if (!path) return null;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, EXPIRES_IN);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
