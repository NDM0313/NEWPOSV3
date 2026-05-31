import { supabase } from '@/lib/supabase';
import { compressImageIfNeeded } from '@/app/utils/imageCompression';
import { normalizeProductImagePublicUrl, productImageUrlForPersistence, getProductImageDisplayUrl } from '@/app/utils/productImageUpload';

const BUCKET = 'product-images';

/** Reference images for bespoke lines: {companyId}/bespoke/{uuid}.ext */
export async function uploadBespokeReferenceImage(companyId: string, file: File): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('You must be logged in to upload images.');

  const compressed = await compressImageIfNeeded(file);
  const ext = compressed.name.split('.').pop() || 'jpg';
  const path = `${companyId}/bespoke/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, compressed, {
    contentType: compressed.type || 'image/jpeg',
    upsert: false,
  });
  if (error) throw new Error(error.message || 'Failed to upload image');
  return productImageUrlForPersistence(path);
}

export function bespokeImageDisplayUrl(storagePathOrUrl: string): string {
  return normalizeProductImagePublicUrl(storagePathOrUrl, storagePathOrUrl);
}

/** Signed URL for private product-images bucket (use in img src). */
export async function getBespokeImageDisplayUrl(storagePathOrUrl: string): Promise<string | null> {
  if (!storagePathOrUrl?.trim()) return null;
  return getProductImageDisplayUrl(storagePathOrUrl.trim());
}
