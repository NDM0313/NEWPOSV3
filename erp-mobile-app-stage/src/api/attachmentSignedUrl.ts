/**
 * Get expiring signed URL for storage attachment (RLS-safe, no public URL exposure).
 */
import { getStorageDisplayUrl } from '../utils/storageDisplayUrl';

/**
 * Returns a signed URL for the attachment (secure, expiring).
 * Use for preview/download; never exposes localhost URLs on native.
 */
export async function getSignedUrlForAttachment(rawUrl: string): Promise<string | null> {
  return getStorageDisplayUrl(rawUrl);
}
