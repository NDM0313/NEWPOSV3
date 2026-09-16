import { parseReceiptOcrText, detectDocumentKind } from './parsePakSupplierBill';
import type { ReceiptOcrDraft } from './receiptOcrTypes';
import { emptyReceiptOcrDraft, isImageFile } from './receiptOcrTypes';

type TessWorker = import('tesseract.js').Worker;

let engWorkerPromise: Promise<TessWorker> | null = null;
let bilingualWorkerPromise: Promise<TessWorker> | null = null;

async function getEngWorker(): Promise<TessWorker> {
  if (!engWorkerPromise) {
    engWorkerPromise = (async () => {
      const { createWorker } = await import('tesseract.js');
      return createWorker(['eng']);
    })();
  }
  return engWorkerPromise;
}

async function getBilingualWorker(): Promise<TessWorker> {
  if (!bilingualWorkerPromise) {
    bilingualWorkerPromise = (async () => {
      const { createWorker } = await import('tesseract.js');
      // English + Urdu for handwritten PK supplier bills
      return createWorker(['eng', 'urd']);
    })();
  }
  return bilingualWorkerPromise;
}

/**
 * Light preprocess for bank screenshots: grayscale, mild contrast, upscale if narrow.
 * Returns a Blob/File for Tesseract; original upload file is unchanged.
 */
export async function preprocessImageForBankOcr(file: File): Promise<Blob> {
  if (typeof document === 'undefined' || typeof createImageBitmap === 'undefined') {
    return file;
  }
  try {
    const bitmap = await createImageBitmap(file);
    const scale = bitmap.width > 0 && bitmap.width < 1000 ? 2 : 1;
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const imageData = ctx.getImageData(0, 0, w, h);
    const d = imageData.data;
    for (let i = 0; i < d.length; i += 4) {
      // luminance grayscale + mild contrast
      let y = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      y = (y - 128) * 1.25 + 128;
      y = Math.max(0, Math.min(255, y));
      d[i] = d[i + 1] = d[i + 2] = y;
    }
    ctx.putImageData(imageData, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/png'),
    );
    return blob ?? file;
  } catch {
    return file;
  }
}

export type RunReceiptOcrOptions = {
  /**
   * Payment-proof / bank screenshot path: eng-only OCR first.
   * Re-runs bilingual only when text clearly looks like a supplier bill.
   * Default true (most mobile attach flows are bank slips).
   */
  preferBank?: boolean;
};

export async function runReceiptOcrOnFile(
  file: File,
  options?: RunReceiptOcrOptions,
): Promise<ReceiptOcrDraft> {
  if (!isImageFile(file)) {
    return emptyReceiptOcrDraft('');
  }
  const preferBank = options?.preferBank !== false;
  const previewUrl = URL.createObjectURL(file);
  try {
    const bankInput = preferBank ? await preprocessImageForBankOcr(file) : file;
    const engWorker = await getEngWorker();
    const engResult = await engWorker.recognize(bankInput);
    const engText = engResult.data.text || '';

    let rawText = engText;
    if (preferBank) {
      const kind = detectDocumentKind(engText);
      if (kind === 'supplier_bill') {
        const biWorker = await getBilingualWorker();
        const biResult = await biWorker.recognize(file);
        rawText = biResult.data.text || engText;
      }
    } else {
      const kind = detectDocumentKind(engText);
      if (kind !== 'bank') {
        const biWorker = await getBilingualWorker();
        const biResult = await biWorker.recognize(file);
        rawText = biResult.data.text || engText;
      }
    }

    const draft = parseReceiptOcrText(rawText);
    draft.previewUrl = previewUrl;
    draft.sourceFileName = file.name;
    return draft;
  } catch (err) {
    URL.revokeObjectURL(previewUrl);
    const message = err instanceof Error ? err.message : 'OCR failed';
    const draft = emptyReceiptOcrDraft(`[OCR error] ${message}`);
    draft.sourceFileName = file.name;
    return draft;
  }
}

export function revokeReceiptOcrPreview(draft: ReceiptOcrDraft | null | undefined): void {
  if (draft?.previewUrl) {
    try {
      URL.revokeObjectURL(draft.previewUrl);
    } catch {
      /* ignore */
    }
  }
}

export async function terminateReceiptOcrWorker(): Promise<void> {
  const stop = async (p: Promise<TessWorker> | null) => {
    if (!p) return;
    try {
      const w = await p;
      await w.terminate();
    } catch {
      /* ignore */
    }
  };
  await stop(engWorkerPromise);
  await stop(bilingualWorkerPromise);
  engWorkerPromise = null;
  bilingualWorkerPromise = null;
}
