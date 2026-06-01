import { supabase } from '@/lib/supabase';
import { compressImageIfNeeded } from '@/app/utils/imageCompression';

const BUCKET = 'product-images';

/** Strip leading `product-images/` segments (handles legacy double-prefix refs). */
function stripLeadingBucketPrefixes(value: string): string {
  const bucketPrefix = `${BUCKET}/`;
  let path = value;
  while (path.startsWith(bucketPrefix) && !path.includes('://')) {
    path = path.slice(bucketPrefix.length);
  }
  return path;
}

/** Storage object path from a public/signed URL, path-only, or mobile `product-images/...` ref. */
export function extractProductImageStoragePath(rawUrl: string): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  let trimmed = rawUrl.trim();
  if (!trimmed) return null;

  const idx = trimmed.indexOf(`/${BUCKET}/`);
  if (idx >= 0) {
    trimmed = trimmed.slice(idx + BUCKET.length + 2);
  }

  trimmed = stripLeadingBucketPrefixes(trimmed).split('?')[0].trim();
  if (!trimmed) return null;

  if (!trimmed.includes('://') && !trimmed.startsWith('/') && trimmed.includes('/')) {
    return trimmed;
  }

  return null;
}

/** Persist URL using the active Supabase project host (avoids stale localhost/dev URLs in DB). */
export function normalizeProductImagePublicUrl(rawUrl: string, storagePath?: string): string {
  const path = storagePath ?? extractProductImageStoragePath(rawUrl);
  if (!path) return rawUrl;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl || rawUrl;
}

/** Store path-only in DB (avoids localhost/dev host pollution). */
export function productImageUrlForPersistence(storagePath: string): string {
  return storagePath;
}

const SESSION_RETRY_MS = 150;
const SESSION_RETRY_COUNT = 3;

async function waitForAccessToken(): Promise<string | null> {
  for (let i = 0; i <= SESSION_RETRY_COUNT; i++) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) return session.access_token;
    if (i < SESSION_RETRY_COUNT) {
      await new Promise((r) => setTimeout(r, SESSION_RETRY_MS));
    }
  }
  return null;
}

/**
 * Get a URL suitable for displaying a product image (img src).
 * If the URL is from the product-images bucket, returns a signed URL so it works when the bucket is private.
 * Returns null when signing fails (never return path-only refs — invalid as img src).
 */
export async function getProductImageDisplayUrl(rawUrl: string): Promise<string | null> {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const path = extractProductImageStoragePath(rawUrl);
  if (!path) return rawUrl;
  try {
    const token = await waitForAccessToken();
    if (!token) return null;
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
  } catch {
    return null;
  }
}

/**
 * Upload product image files to storage and return their public URLs.
 * Path: {companyId}/{productId}/{uuid}.ext
 * Create bucket "product-images" in Supabase Dashboard. Run migration 23 for RLS.
 */
export async function uploadProductImages(
  companyId: string,
  productId: string,
  files: File[]
): Promise<string[]> {
  if (!files.length) return [];
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('You must be logged in to upload product images.');
  }
  const urls: string[] = [];
  for (let i = 0; i < files.length; i++) {
    const raw = files[i];
    const file = await compressImageIfNeeded(raw);
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${companyId}/${productId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      contentType: file.type || 'image/jpeg',
      upsert: false,
    });
    if (error) {
      console.error('[PRODUCT IMAGES] Upload failed:', path, error);
      const msg = error.message ?? '';
      const isBucketMissing = msg.toLowerCase().includes('bucket not found');
      const isRls = msg.toLowerCase().includes('row-level security') || msg.toLowerCase().includes('violates');
      if (isBucketMissing) {
        throw new Error(
          "Bucket 'product-images' not found. Create it in Supabase Dashboard → Storage → New bucket (name: product-images)."
        );
      }
      if (isRls) {
        throw new Error(
          "Image upload blocked by Storage security. Fix: 1) In Supabase Dashboard (for this project) → SQL Editor, run supabase-extract/migrations/RUN_PRODUCT_IMAGES_STORAGE_RLS.sql. 2) Ensure you are logged in. 3) Create the bucket 'product-images' in Storage if missing. See docs/PRODUCT_IMAGES_STORAGE_RLS_FIX.md."
        );
      }
      throw new Error(msg || 'Failed to upload image');
    }
    urls.push(productImageUrlForPersistence(path));
  }
  return urls;
}

/** Best-effort delete storage objects when user removes images from a product (non-fatal). */
export async function removeProductImagesFromStorage(urls: string[]): Promise<void> {
  const paths = urls
    .map((u) => extractProductImageStoragePath(u))
    .filter((p): p is string => Boolean(p));
  if (paths.length === 0) return;
  const { error } = await supabase.storage.from(BUCKET).remove(paths);
  if (error) {
    console.warn('[removeProductImagesFromStorage]', error.message);
  }
}
