/**
 * Customer bill book / REF # on sales — aligned with web `src/app/utils/saleBillRef.ts`.
 */

const STUDIO_DEADLINE_PREFIX = 'StudioDeadline:';
const STUDIO_DEADLINE_REGEX = /StudioDeadline:\d{4}-\d{2}-\d{2}\s*\n?/gi;

function parseStudioDeadlineFromNotes(notes: string | undefined | null): {
  notesWithoutDeadline: string;
} {
  const raw = (notes ?? '').trim();
  const stripped = raw.replace(STUDIO_DEADLINE_REGEX, '').trim();
  const leading = raw.match(new RegExp(`^${STUDIO_DEADLINE_PREFIX}\\d{4}-\\d{2}-\\d{2}`, 'i'));
  if (leading) {
    return { notesWithoutDeadline: stripped };
  }
  return { notesWithoutDeadline: raw };
}

function isStudioSaleRow(row: Record<string, unknown>, opts?: { isStudio?: boolean }): boolean {
  if (opts?.isStudio) return true;
  if (row.is_studio === true || row.isStudio === true) return true;
  const orderNo = String(row.order_no ?? row.orderNo ?? '');
  return orderNo.startsWith('STD');
}

/** Read bill ref from sale row (DB column, UI camelCase, legacy aliases, notes fallback). */
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
  if (isStudioSaleRow(row, opts)) return '';
  const { notesWithoutDeadline } = parseStudioDeadlineFromNotes(
    row.notes != null ? String(row.notes) : '',
  );
  return notesWithoutDeadline.trim();
}
