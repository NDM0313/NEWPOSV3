import { Capacitor, registerPlugin } from '@capacitor/core';

type PasteboardImagePlugin = {
  readImage(): Promise<{ base64?: string | null; format?: string | null }>;
};

const PasteboardImage = registerPlugin<PasteboardImagePlugin>('PasteboardImage');

export class IosPasteboardPluginMissingError extends Error {
  constructor() {
    super('Rebuild iOS app — Pasteboard plugin missing (Photos paste needs native bridge)');
    this.name = 'IosPasteboardPluginMissingError';
  }
}

function base64ToBlob(base64: string, mime: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function isPluginMissingError(err: unknown): boolean {
  const msg = String(err instanceof Error ? err.message : err).toLowerCase();
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: string }).code || '').toLowerCase()
      : '';
  return (
    code.includes('unimplemented') ||
    msg.includes('unimplemented') ||
    msg.includes('not implemented') ||
    msg.includes('"pasteboardimage" plugin is not implemented') ||
    msg.includes('plugin is not implemented') ||
    msg.includes('is not implemented on ios')
  );
}

/**
 * Read an image from iOS UIPasteboard (Photos / Files Copy).
 * Returns null when pasteboard has no image.
 * Throws IosPasteboardPluginMissingError when the native plugin is not in the binary.
 */
export async function readIosPasteboardImageFile(): Promise<File | null> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'ios') {
    return null;
  }

  try {
    const result = await PasteboardImage.readImage();
    const base64 = typeof result.base64 === 'string' ? result.base64.trim() : '';
    if (!base64) return null;

    const format = (result.format || 'jpeg').toLowerCase();
    const mime = format === 'png' ? 'image/png' : 'image/jpeg';
    const ext = format === 'png' ? 'png' : 'jpg';
    const blob = base64ToBlob(base64, mime);
    if (blob.size < 1024) return null;

    return new File([blob], `pasted-${Date.now()}.${ext}`, { type: mime });
  } catch (err) {
    if (isPluginMissingError(err)) {
      throw new IosPasteboardPluginMissingError();
    }
    return null;
  }
}
