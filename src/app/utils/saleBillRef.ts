/**
 * Customer bill book / REF # on sales — separate from free-form notes.
 */

import { parseStudioDeadlineFromNotes } from '@/app/utils/studioDeadlineNotes';

export function readSaleBillRef(
  row: Record<string, unknown> | null | undefined,
  opts?: { isStudio?: boolean },
): string {
  if (!row) return '';
  const dedicated =
    row.customer_bill_ref ??
    (row as { customerBillRef?: unknown }).customerBillRef ??
    row.reference ??
    row.ref_no ??
    (row as { bill_ref?: unknown }).bill_ref;
  if (dedicated != null && String(dedicated).trim() !== '') {
    return String(dedicated).trim();
  }
  if (opts?.isStudio) return '';
  const { notesWithoutDeadline } = parseStudioDeadlineFromNotes(
    row.notes != null ? String(row.notes) : '',
  );
  return notesWithoutDeadline.trim();
}

/** Map bill ref for Supabase update; caller may retry without column on 42703. */
export function saleBillRefUpdatePayload(billRef: string | null | undefined): Record<string, string | null> {
  const v = billRef != null ? String(billRef).trim() : '';
  return { customer_bill_ref: v || null };
}
