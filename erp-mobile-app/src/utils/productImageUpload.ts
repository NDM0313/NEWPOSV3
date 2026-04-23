import { supabase } from '../lib/supabase';

const BUCKET = 'product-images';

/**
 * Get a display URL for a product image.
 * If the URL belongs to the product-images bucket we mint a signed URL (bucket may be private).
 */
export async function getProductImageDisplayUrl(rawUrl: string): Promise<string> {
  if (!rawUrl || typeof rawUrl !== 'string') return rawUrl;
  try {
    const idx = rawUrl.indexOf(`/${BUCKET}/`);
    if (idx === -1) return rawUrl;
    const path = rawUrl.slice(idx + BUCKET.length + 2);
    if (!path) return rawUrl;
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
    if (error || !data?.signedUrl) return rawUrl;
    return data.signedUrl;
  } catch {
    return rawUrl;
  }
}

/**
 * Upload product image files to Supabase Storage.
 * Path: {companyId}/{productId}/{uuid}.ext
 */
export async function uploadProductImages(
  companyId: string,
  productId: string,
  files: File[],
): Promise<string[]> {
  if (!files.length) return [];
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) throw new Error('You must be logged in to upload product images.');

  const urls: string[] = [];
  for (const file of files) {
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const uuid =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const path = `${companyId}/${productId}/${uuid}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      contentType: file.type || 'image/jpeg',
      upsert: false,
    });
    if (error) {
      const msg = error.message || '';
      if (/bucket not found/i.test(msg)) {
        throw new Error("Bucket 'product-images' not found. Create it in the Supabase Dashboard → Storage.");
      }
      if (/row-level security|violates/i.test(msg)) {
        throw new Error('Image upload blocked by Storage security policies. Please apply the product-images Storage RLS migration.');
      }
      throw new Error(msg || 'Failed to upload image');
    }
    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
    urls.push(pub.publicUrl);
  }
  return urls;
}
