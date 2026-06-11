import { useCallback } from 'react';

const BODY_CLASS = 'document-print-active';

/**
 * Wraps browser print so print-only CSS can scope to document output.
 * Adds `document-print-active` on body until afterprint fires.
 */
export function useDocumentPrint() {
  const runDocumentPrint = useCallback((printFn: () => void) => {
    document.body.classList.add(BODY_CLASS);
    const cleanup = () => {
      document.body.classList.remove(BODY_CLASS);
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    printFn();
  }, []);

  return { runDocumentPrint };
}

/** Standalone helper when hook is not available. */
export function triggerDocumentPrint(printFn: () => void = () => window.print()): void {
  document.body.classList.add(BODY_CLASS);
  const cleanup = () => {
    document.body.classList.remove(BODY_CLASS);
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  printFn();
}
