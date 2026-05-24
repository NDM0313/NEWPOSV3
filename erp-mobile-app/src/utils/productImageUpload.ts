import { supabase } from '../lib/supabase';
import {
  extractProductImageStoragePath,
  getStorageDisplayUrl,
  getStoragePublicUrl,
  storageRefForPersistence,
} from './storageDisplayUrl';

const BUCKET = 'product-images';

export { extractProductImageStoragePath };

export function normalizeProductImagePublicUrl(rawUrl: string, storagePath?: string): string {
  const path = storagePath ?? extractProductImageStoragePath(rawUrl);
  if (!path) return rawUrl;
  return getStoragePublicUrl(storageRefForPersistence(BUCKET, path));
}

export function productImageUrlForPersistence(storagePath: string): string {
  return storageRefForPersistence(BUCKET, storagePath);
}

export async function getProductImageDisplayUrl(rawUrl: string): Promise<string | null> {
  return getStorageDisplayUrl(rawUrl);
}

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
    urls.push(productImageUrlForPersistence(path));
  }
  return urls;
}
