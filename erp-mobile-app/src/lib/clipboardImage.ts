import { Capacitor } from '@capacitor/core';
import { normalizePickedImageFiles } from './mediaPick';
import { IosPasteboardPluginMissingError, readIosPasteboardImageFile } from './iosPasteboardImage';

const IMAGE_CLIPBOARD_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
];
const IMAGE_URL_EXT = /\.(jpe?g|png|webp|gif|heic|heif)(\?|#|$)/i;

export class ClipboardImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ClipboardImageError';
  }
}

/** True when Async Clipboard read with image types is likely available. */
export function isClipboardImagePasteAvailable(): boolean {
  if (typeof navigator === 'undefined') return false;
  // iOS native can fall back to UIPasteboard even when web clipboard.read is missing.
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios') return true;
  const { clipboard } = navigator;
  if (!clipboard || typeof clipboard.read !== 'function') return false;
  return typeof ClipboardItem !== 'undefined';
}

function extForMime(mime: string): string {
  const m = mime.toLowerCase();
  if (m === 'image/png') return 'png';
  if (m === 'image/webp') return 'webp';
  if (m === 'image/gif') return 'gif';
  if (m === 'image/heic' || m === 'image/heif') return 'heic';
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

function imageTypesOnItem(item: ClipboardItem): string[] {
  const fromKnown = IMAGE_CLIPBOARD_TYPES.filter((type) => item.types.includes(type));
  const fromAny = item.types.filter((type) => type.toLowerCase().startsWith('image/'));
  return [...new Set([...fromKnown, ...fromAny])];
}

async function readImageFromClipboardItems(items: ClipboardItem[]): Promise<File | null> {
  for (const item of items) {
    for (const type of imageTypesOnItem(item)) {
      try {
        const blob = await item.getType(type);
        if (blob && blob.size > 0) {
          return blobToImageFile(blob, type);
        }
      } catch {
        /* try next type */
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
  return imageTypesOnItem(item).length > 0;
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
    if (navigator.clipboard && typeof navigator.clipboard.read === 'function') {
      const items = await navigator.clipboard.read();
      if (await clipboardItemsHavePasteableImage(items)) return true;
    }
  } catch {
    /* fall through */
  }
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios') {
    const native = await readIosPasteboardImageFile();
    return Boolean(native);
  }
  return false;
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

const EMPTY_CLIPBOARD_MSG =
  'Clipboard mein koi image nahi — Photos se Copy ke baad dobara try karein, ya Gallery use karein';

async function readFromWebClipboard(): Promise<File | null> {
  if (!navigator.clipboard || typeof navigator.clipboard.read !== 'function') {
    return null;
  }

  let items: ClipboardItem[];
  try {
    items = await navigator.clipboard.read();
  } catch {
    return null;
  }

  if (!items.length) return null;

  const imageFile = await readImageFromClipboardItems(items);
  if (imageFile) return imageFile;

  const text = await readTextFromClipboardItems(items);
  if (text && looksLikeImageUrl(text)) {
    return readImageFromClipboardUrl(text);
  }

  return null;
}

/** Read a copied image from the system clipboard and return it as a File. */
export async function readClipboardImageFile(): Promise<File> {
  if (!isClipboardImagePasteAvailable()) {
    throw new ClipboardImageError('Is device par paste abhi support nahi — Gallery use karein');
  }

  const fromWeb = await readFromWebClipboard();
  if (fromWeb) return fromWeb;

  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios') {
    try {
      const fromNative = await readIosPasteboardImageFile();
      if (fromNative) {
        const normalized = normalizePickedImageFiles([fromNative]);
        if (normalized[0]) return normalized[0];
      }
    } catch (err) {
      if (err instanceof IosPasteboardPluginMissingError) {
        throw new ClipboardImageError(err.message);
      }
      throw err;
    }
  }

  throw new ClipboardImageError(EMPTY_CLIPBOARD_MSG);
}
