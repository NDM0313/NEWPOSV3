import { parseReceiptOcrText } from './parsePakSupplierBill';
import type { ReceiptOcrDraft } from './receiptOcrTypes';
import { emptyReceiptOcrDraft, isImageFile } from './receiptOcrTypes';

let workerPromise: Promise<import('tesseract.js').Worker> | null = null;

async function getWorker(): Promise<import('tesseract.js').Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import('tesseract.js');
      // English + Urdu for bank receipts and handwritten PK supplier bills
      const worker = await createWorker(['eng', 'urd']);
      return worker;
    })();
  }
  return workerPromise;
}

export async function runReceiptOcrOnFile(file: File): Promise<ReceiptOcrDraft> {
  if (!isImageFile(file)) {
    return emptyReceiptOcrDraft('');
  }
  const previewUrl = URL.createObjectURL(file);
  try {
    const worker = await getWorker();
    const { data } = await worker.recognize(file);
    const draft = parseReceiptOcrText(data.text || '');
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
  if (!workerPromise) return;
  try {
    const w = await workerPromise;
    await w.terminate();
  } catch {
    /* ignore */
  }
  workerPromise = null;
}
