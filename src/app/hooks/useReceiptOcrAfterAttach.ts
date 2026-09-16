import { useCallback, useRef, useState } from 'react';
import type { ReceiptOcrDraft, ReceiptOcrFormPatch } from '@/app/lib/ocr/receiptOcrTypes';
import { isImageFile } from '@/app/lib/ocr/receiptOcrTypes';
import { runReceiptOcrOnFile, revokeReceiptOcrPreview } from '@/app/lib/ocr/receiptOcrEngine';
import { applyReceiptOcrDraft, mergeOcrNotes } from '@/app/lib/ocr/applyReceiptOcrDraft';

export interface UseReceiptOcrAfterAttachOptions {
  enabled?: boolean;
  onApply: (patch: ReceiptOcrFormPatch) => void;
  getExistingNotes?: () => string;
}

/**
 * After files are attached: keep attach list unchanged; for first image open OCR review.
 */
export function useReceiptOcrAfterAttach(options: UseReceiptOcrAfterAttachOptions) {
  const { enabled = true, onApply, getExistingNotes } = options;
  const [sheetOpen, setSheetOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<ReceiptOcrDraft | null>(null);
  const lastImageRef = useRef<File | null>(null);
  const runGen = useRef(0);

  const closeSheet = useCallback(() => {
    revokeReceiptOcrPreview(draft);
    setDraft(null);
    setSheetOpen(false);
    setLoading(false);
  }, [draft]);

  const startOcrForFiles = useCallback(
    async (files: File[]) => {
      if (!enabled) return;
      const image = files.find(isImageFile);
      if (!image) return;
      lastImageRef.current = image;
      const gen = ++runGen.current;
      setSheetOpen(true);
      setLoading(true);
      setDraft(null);
      try {
        const next = await runReceiptOcrOnFile(image);
        if (gen !== runGen.current) {
          revokeReceiptOcrPreview(next);
          return;
        }
        setDraft(next);
      } finally {
        if (gen === runGen.current) setLoading(false);
      }
    },
    [enabled],
  );

  const rescanLastImage = useCallback(async () => {
    const image = lastImageRef.current;
    if (!image) return;
    await startOcrForFiles([image]);
  }, [startOcrForFiles]);

  const rememberImageFromFiles = useCallback((files: File[]) => {
    const image = [...files].reverse().find(isImageFile);
    if (image) lastImageRef.current = image;
  }, []);

  const handleConfirm = useCallback(
    (next: ReceiptOcrDraft) => {
      const patch = applyReceiptOcrDraft(next);
      if (patch.notes != null && getExistingNotes) {
        patch.notes = mergeOcrNotes(getExistingNotes(), patch.notes);
      }
      onApply(patch);
      setDraft(null);
      setSheetOpen(false);
      setLoading(false);
    },
    [getExistingNotes, onApply],
  );

  const handleSkip = useCallback(() => {
    closeSheet();
  }, [closeSheet]);

  return {
    sheetOpen,
    loading,
    draft,
    setDraft,
    startOcrForFiles,
    rescanLastImage,
    rememberImageFromFiles,
    hasLastImage: () => lastImageRef.current != null,
    handleConfirm,
    handleSkip,
    lastImageFile: lastImageRef,
  };
}
