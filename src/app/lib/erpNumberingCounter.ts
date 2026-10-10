/** Company-wide numbering sentinel branch (matches Postgres erp_numbering_global_branch_sentinel). */
export const ERP_SEQ_SENTINEL = '00000000-0000-0000-0000-000000000000';

/** Counter year bucket: calendar year when year_reset, else 0 (never resets). */
export function erpSequenceCounterYear(yearReset: boolean, calendarYear?: number): number {
  return yearReset ? (calendarYear ?? new Date().getFullYear()) : 0;
}

/** Branch + year bucket used by generate_document_number for the live counter. */
export function resolveErpCounterBucket(
  yearReset: boolean,
  branchBased: boolean,
  branchId?: string | null,
  calendarYear?: number,
): { branchId: string; year: number } {
  const year = erpSequenceCounterYear(yearReset, calendarYear);
  const branch =
    branchBased && branchId && branchId !== 'all' ? branchId : ERP_SEQ_SENTINEL;
  return { branchId: branch, year };
}

export function counterRowKey(branchId: string, year: number, documentType: string): string {
  return `${branchId}:${year}:${documentType.toUpperCase()}`;
}
