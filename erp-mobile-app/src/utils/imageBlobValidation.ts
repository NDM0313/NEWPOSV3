/** Reject empty JSON/error bodies masquerading as successful storage downloads on native WebView. */
export const MIN_IMAGE_BLOB_BYTES = 256;

export async function isPlausibleImageBlob(blob: Blob | null | undefined): Promise<boolean> {
  if (!blob || blob.size < MIN_IMAGE_BLOB_BYTES) return false;
  try {
    const head = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
    if (head[0] === 0xff && head[1] === 0xd8) return true;
    if (head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47) return true;
    if (head[0] === 0x47 && head[1] === 0x49 && head[2] === 0x46) return true;
    if (head[0] === 0x52 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x46) return true;
    return blob.size >= 1024;
  } catch {
    return blob.size >= MIN_IMAGE_BLOB_BYTES;
  }
}

export function tinyBlobHint(blob: Blob): string {
  if (blob.size > 32) return `bytes=${blob.size}`;
  return `bytes=${blob.size} body=${blob.type || 'unknown'}`;
}

/** First bytes as text for debug log when storage returns JSON/error stubs. */
export async function tinyBlobPreview(blob: Blob): Promise<string> {
  if (blob.size === 0) return '(empty)';
  try {
    const slice = blob.size <= 64 ? blob : blob.slice(0, 64);
    const text = new TextDecoder().decode(await slice.arrayBuffer());
    return text.replace(/\s+/g, ' ').slice(0, 80) || tinyBlobHint(blob);
  } catch {
    return tinyBlobHint(blob);
  }
}
