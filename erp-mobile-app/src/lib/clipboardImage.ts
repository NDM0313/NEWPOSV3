import { normalizePickedImageFiles } from './mediaPick';

const IMAGE_CLIPBOARD_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
const IMAGE_URL_EXT = /\.(jpe?g|png|webp|gif)(\?|#|$)/i;

export class ClipboardImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ClipboardImageError';
  }
}

/** True when Async Clipboard read with image types is likely available. */
export function isClipboardImagePasteAvailable(): boolean {
  if (typeof navigator === 'undefined') return false;
  const { clipboard } = navigator;
  if (!clipboard || typeof clipboard.read !== 'function') return false;
  return typeof ClipboardItem !== 'undefined';
}

function extForMime(mime: string): string {
  const m = mime.toLowerCase();
  if (m === 'image/png') return 'png';
  if (m === 'image/webp') return 'webp';
  if (m === 'image/gif') return 'gif';
  return 'jpg';
}

async function blobToImageFile(blob: Blob, mimeHint?: string): Promise<File> {
  const mime = blob.type && blob.type.startsWith('image/') ? blob.type : mimeHint || 'image/png';
  const ext = extForMime(mime);
  const file = new File([blob], `pasted-${Date.now()}.${ext}`, { type: mime });
  const normalized = normalizePickedImageFiles([file]);
  const out = normalized[0];
  if (!out) {
    throw new ClipboardImageError('Clipboard mein koi image nahi — pehle image copy karein');
  }
  return out;
}

async function readImageFromClipboardItems(items: ClipboardItem[]): Promise<File | null> {
  for (const item of items) {
    for (const type of IMAGE_CLIPBOARD_TYPES) {
      if (!item.types.includes(type)) continue;
      const blob = await item.getType(type);
      if (blob && blob.size > 0) {
        return blobToImageFile(blob, type);
      }
    }
  }
  return null;
}

function looksLikeImageUrl(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    return IMAGE_URL_EXT.test(url.pathname);
  } catch {
    return false;
  }
}

async function readImageFromClipboardUrl(url: string): Promise<File | null> {
  try {
    const response = await fetch(url.trim());
    if (!response.ok) return null;
    const blob = await response.blob();
    if (!blob.type.startsWith('image/') && blob.size === 0) return null;
    return blobToImageFile(blob, blob.type || 'image/jpeg');
  } catch {
    return null;
  }
}

async function readTextFromClipboardItems(items: ClipboardItem[]): Promise<string | null> {
  for (const item of items) {
    if (!item.types.includes('text/plain')) continue;
    const blob = await item.getType('text/plain');
    const text = await blob.text();
    if (text.trim()) return text.trim();
  }
  return null;
}

function itemHasImageMimeType(item: ClipboardItem): boolean {
  return IMAGE_CLIPBOARD_TYPES.some((type) => item.types.includes(type));
}

async function clipboardItemsHavePasteableImage(items: ClipboardItem[]): Promise<boolean> {
  if (!items.length) return false;
  for (const item of items) {
    if (itemHasImageMimeType(item)) return true;
  }
  const text = await readTextFromClipboardItems(items);
  return !!(text && looksLikeImageUrl(text));
}

/** True when clipboard currently holds a pasteable image (requires recent user gesture). */
export async function hasClipboardPasteableImage(): Promise<boolean> {
  if (!isClipboardImagePasteAvailable()) return false;
  try {
    const items = await navigator.clipboard.read();
    return clipboardItemsHavePasteableImage(items);
  } catch {
    return false;
  }
}

/** Extract image files from a native paste event (desktop Ctrl+V / some mobile keyboards). */
export function filesFromPasteEvent(event: ClipboardEvent): File[] {
  const out: File[] = [];
  const items = event.clipboardData?.items;
  if (!items) return out;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.kind !== 'file') continue;
    const type = (item.type || '').toLowerCase();
    if (!type.startsWith('image/')) continue;
    const file = item.getAsFile();
    if (file && file.size > 0) out.push(file);
  }
  return out;
}

/** Read a copied image from the system clipboard and return it as a File. */
export async function readClipboardImageFile(): Promise<File> {
  if (!isClipboardImagePasteAvailable()) {
    throw new ClipboardImageError('Is device par paste abhi support nahi — Gallery use karein');
  }

  let items: ClipboardItem[];
  try {
    items = await navigator.clipboard.read();
  } catch {
    throw new ClipboardImageError('Is device par paste abhi support nahi — Gallery use karein');
  }

  if (!items.length) {
    throw new ClipboardImageError('Clipboard mein koi image nahi — pehle image copy karein');
  }

  const imageFile = await readImageFromClipboardItems(items);
  if (imageFile) return imageFile;

  const text = await readTextFromClipboardItems(items);
  if (text && looksLikeImageUrl(text)) {
    const fromUrl = await readImageFromClipboardUrl(text);
    if (fromUrl) return fromUrl;
  }

  throw new ClipboardImageError('Clipboard mein koi image nahi — pehle image copy karein');
}
