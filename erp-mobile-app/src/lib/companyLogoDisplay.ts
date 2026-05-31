import { supabase } from './supabase';

const BUCKET = 'company-logos';

function extractCompanyLogoStoragePath(rawUrl: string): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  const idx = trimmed.indexOf(`/${BUCKET}/`);
  if (idx >= 0) return trimmed.slice(idx + BUCKET.length + 2).split('?')[0] || null;
  if (!trimmed.includes('://') && !trimmed.startsWith('/')) return trimmed.split('?')[0] || null;
  return null;
}

/** Resolve storage path or external URL for img src / print. */
export async function getCompanyLogoDisplayUrl(rawUrl: string | null | undefined): Promise<string | null> {
  if (!rawUrl?.trim()) return null;
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
