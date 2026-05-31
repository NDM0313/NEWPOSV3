/** Ref-counted guard so bulk CSV import defers GL sync and context reload storms. */
let bulkImportDepth = 0;

export function beginBulkImport(): void {
  bulkImportDepth += 1;
}

export function endBulkImport(): void {
  bulkImportDepth = Math.max(0, bulkImportDepth - 1);
}

export function isBulkImportActive(): boolean {
  return bulkImportDepth > 0;
}
