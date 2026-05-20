/**
 * Get expiring signed URL for storage attachment (RLS-safe, no public URL exposure).
 */
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const EXPIRES_IN = 3600; // 1 hour

const KNOWN_BUCKETS = ['payment-attachments', 'purchase-attachments', 'sale-attachments'] as const;

function resolveBucketAndPath(rawUrl: string): { bucket: string; path: string } | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed.startsWith('http')) {
    const path = trimmed.split('?')[0].trim();
    return path ? { bucket: 'payment-attachments', path } : null;
  }
  for (const bucket of KNOWN_BUCKETS) {
    const idx = trimmed.indexOf(`/${bucket}/`);
    if (idx !== -1) {
      const path = trimmed.slice(idx + bucket.length + 2).split('?')[0].trim();
      if (path) return { bucket, path };
    }
  }
  return null;
}

/**
 * Returns a signed URL for the attachment (secure, expiring).
 * Use for preview/download; do not expose public URL.
 */
export async function getSignedUrlForAttachment(rawUrl: string): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  const resolved = resolveBucketAndPath(rawUrl);
  if (!resolved) return null;
  const { data, error } = await supabase.storage.from(resolved.bucket).createSignedUrl(resolved.path, EXPIRES_IN);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
