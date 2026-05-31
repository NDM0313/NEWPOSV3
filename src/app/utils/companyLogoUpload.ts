import { supabase } from '@/lib/supabase';
import { compressImageIfNeeded } from '@/app/utils/imageCompression';

const BUCKET = 'company-logos';
const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

/** Storage object path from a public/signed URL or raw path. */
export function extractCompanyLogoStoragePath(rawUrl: string): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  const idx = trimmed.indexOf(`/${BUCKET}/`);
  if (idx >= 0) return trimmed.slice(idx + BUCKET.length + 2).split('?')[0] || null;
  if (!trimmed.includes('://') && !trimmed.startsWith('/')) return trimmed.split('?')[0] || null;
  return null;
}

/** Store path-only in DB (avoids localhost/dev host pollution). */
export function companyLogoUrlForPersistence(storagePath: string): string {
  return storagePath;
}

/**
 * Get a URL suitable for displaying the company logo (img src).
 * Storage paths use signed URLs when the bucket is private.
 */
export async function getCompanyLogoDisplayUrl(rawUrl: string | null | undefined): Promise<string> {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  try {
    const path = extractCompanyLogoStoragePath(rawUrl);
    if (!path) return rawUrl;
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
    if (error || !data?.signedUrl) return rawUrl;
    return data.signedUrl;
  } catch {
    return rawUrl;
  }
}

function validateLogoFile(file: File): void {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error('Logo must be PNG, JPG, or WebP.');
  }
  if (file.size > MAX_BYTES) {
    throw new Error('Logo must be 2 MB or smaller.');
  }
}

/**
 * Upload company logo. Path: {companyId}/logo.{ext}
 * Returns path-only string for companies.logo_url.
 */
export async function uploadCompanyLogo(companyId: string, file: File): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('You must be logged in to upload a company logo.');
  }
  validateLogoFile(file);
  const compressed = await compressImageIfNeeded(file);
  const ext = (compressed.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `${companyId}/logo.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, compressed, {
    contentType: compressed.type || 'image/jpeg',
    upsert: true,
  });
  if (error) {
    const msg = error.message ?? '';
    const isBucketMissing = msg.toLowerCase().includes('bucket not found');
    const isRls = msg.toLowerCase().includes('row-level security') || msg.toLowerCase().includes('violates');
    if (isBucketMissing) {
      throw new Error(
        "Bucket 'company-logos' not found. Create it in Supabase Dashboard → Storage (name: company-logos)."
      );
    }
    if (isRls) {
      throw new Error(
        'Logo upload blocked by Storage security. Run migration 20260611120000_company_logos_storage_rls.sql and ensure you are logged in.'
      );
    }
    throw new Error(msg || 'Failed to upload logo');
  }
  return companyLogoUrlForPersistence(path);
}

/** Best-effort delete logo object from storage. */
export async function deleteCompanyLogoFromStorage(rawUrl: string | null | undefined): Promise<void> {
  const path = rawUrl ? extractCompanyLogoStoragePath(rawUrl) : null;
  if (!path) return;
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) {
    console.warn('[companyLogoUpload] delete failed:', path, error.message);
  }
}
