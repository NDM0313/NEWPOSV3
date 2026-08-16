/**
 * Bespoke reference image upload (mobile) — same bucket/path as web.
 */
import { supabase } from '../lib/supabase';
import { getStorageDisplayUrl, storageRefForPersistence } from './storageDisplayUrl';

const BUCKET = 'product-images' as const;

export async function uploadBespokeReferenceImage(companyId: string, file: File): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('You must be logged in to upload images.');

  const ext = file.name.split('.').pop() || 'jpg';
  const path = `${companyId}/bespoke/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || 'image/jpeg',
    upsert: false,
  });
  if (error) throw new Error(error.message || 'Failed to upload image');
  return storageRefForPersistence(BUCKET, path);
}

export async function getBespokeImageDisplayUrl(storagePathOrUrl: string): Promise<string | null> {
  if (!storagePathOrUrl?.trim()) return null;
  return getStorageDisplayUrl(storagePathOrUrl.trim());
}
