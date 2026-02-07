import { supabase } from '@/lib/supabase';

const BUCKET = 'product-images';

/**
 * Get a URL suitable for displaying a product image (img src).
 * If the URL is from the product-images bucket, returns a signed URL so it works when the bucket is private.
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
  const urls: string[] = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${companyId}/${productId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      contentType: file.type || 'image/jpeg',
      upsert: false,
    });
    if (error) {
      console.error('[PRODUCT IMAGES] Upload failed:', path, error);
      const isBucketMissing = error.message?.toLowerCase().includes('bucket not found');
      throw new Error(isBucketMissing
        ? `Bucket 'product-images' not found. Create it in Supabase Dashboard → Storage → New bucket (name: product-images).`
        : (error.message || 'Failed to upload image'));
    }
    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
    urls.push(urlData.publicUrl);
  }
  return urls;
}
