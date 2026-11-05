/**
 * Extract image/PDF files from a clipboard paste event for attachment drop zones.
 */
import type * as React from 'react';
import { MAX_FILE_SIZE_BYTES } from '@/app/utils/uploadTransactionAttachments';

const DEFAULT_ACCEPT = /^(image\/(png|jpe?g|webp|gif)|application\/pdf)$/i;

export type PasteAttachmentOptions = {
  maxBytes?: number;
  accept?: RegExp;
};

function isAcceptedFile(file: File, accept: RegExp, maxBytes: number): boolean {
  if (file.size <= 0 || file.size > maxBytes) return false;
  if (file.type && accept.test(file.type)) return true;
  // Some browsers omit type for clipboard PNGs
  const name = (file.name || '').toLowerCase();
  if (/\.(png|jpe?g|webp|gif|pdf)$/.test(name)) return true;
  if (!file.type && (file.name === 'image.png' || !file.name || file.name === 'blob')) return true;
  // Clipboard image item with empty type but image-like size
  if (!file.type && accept.test('image/png')) return true;
  return false;
}

/**
 * Collect File[] from ClipboardEvent. Prefer files list; also read image items.
 */
export function pasteAttachmentFilesFromEvent(
  e: ClipboardEvent | React.ClipboardEvent,
  opts?: PasteAttachmentOptions,
): File[] {
  const maxBytes = opts?.maxBytes ?? MAX_FILE_SIZE_BYTES;
  const accept = opts?.accept ?? DEFAULT_ACCEPT;
  const cd = e.clipboardData;
  if (!cd) return [];

  const out: File[] = [];
  const seen = new Set<string>();

  const push = (file: File | null | undefined) => {
    if (!file || !isAcceptedFile(file, accept, maxBytes)) return;
    const key = `${file.name}:${file.size}:${file.lastModified}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(file);
  };

  if (cd.files?.length) {
    Array.from(cd.files).forEach((f) => push(f));
  }

  if (cd.items?.length) {
    for (const item of Array.from(cd.items)) {
      if (item.kind !== 'file') continue;
      push(item.getAsFile() ?? undefined);
    }
  }

  return out;
}

/** Prevent default when paste yields attachment files (caller should handle). */
export function handleAttachmentPaste(
  e: React.ClipboardEvent,
  onFiles: (files: File[]) => void,
  opts?: PasteAttachmentOptions,
): boolean {
  const files = pasteAttachmentFilesFromEvent(e, opts);
  if (!files.length) return false;
  e.preventDefault();
  e.stopPropagation();
  onFiles(files);
  return true;
}
