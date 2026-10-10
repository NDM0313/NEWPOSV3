export type TransactionAttachment = { url: string; name: string };

/** Normalize JE / payment / sale attachment JSON into `{ url, name }[]`. */
export function normalizeAttachmentList(input: unknown): TransactionAttachment[] {
  if (input == null) return [];
  const items = Array.isArray(input) ? input : [input];
  const out: TransactionAttachment[] = [];
  const seen = new Set<string>();
  for (const att of items) {
    let url: string | undefined;
    let name: string | undefined;
    if (typeof att === 'string') {
      url = att.trim();
    } else if (att && typeof att === 'object') {
      const o = att as { url?: string; fileUrl?: string; name?: string };
      url = String(o.url || o.fileUrl || '').trim();
      name = o.name ? String(o.name).trim() : undefined;
    }
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const base = url.split('/').pop() || 'attachment';
    let defaultName = base;
    try {
      defaultName = decodeURIComponent(base.replace(/^\d+_/, ''));
    } catch {
      /* keep base */
    }
    out.push({ url, name: name || defaultName });
  }
  return out;
}

export function receiptUrlToAttachments(receiptUrl?: string | null): TransactionAttachment[] {
  const url = receiptUrl?.trim();
  if (!url) return [];
  return normalizeAttachmentList([{ url, name: 'receipt' }]);
}

export function mergeAttachmentLists(...lists: unknown[]): TransactionAttachment[] {
  const combined: unknown[] = [];
  for (const l of lists) {
    if (Array.isArray(l)) combined.push(...l);
    else if (l != null) combined.push(l);
  }
  return normalizeAttachmentList(combined);
}

export function entryHasAttachments(entry: {
  metadata?: { attachments?: TransactionAttachment[] };
}): boolean {
  return (entry.metadata?.attachments?.length ?? 0) > 0;
}

export function groupEntryHasAttachments(
  entries: Array<{ metadata?: { attachments?: TransactionAttachment[] } }>
): boolean {
  return entries.some(entryHasAttachments);
}

export function collectEntryAttachments(entry: {
  metadata?: { attachments?: TransactionAttachment[] };
}): TransactionAttachment[] {
  return entry.metadata?.attachments ?? [];
}

export function collectGroupAttachments(
  entries: Array<{ metadata?: { attachments?: TransactionAttachment[] } }>
): TransactionAttachment[] {
  return mergeAttachmentLists(...entries.map(collectEntryAttachments));
}

const DOCUMENT_JE_REFERENCE_TYPES = new Set([
  'sale',
  'sale_adjustment',
  'sale_reversal',
  'purchase',
  'purchase_adjustment',
  'purchase_return',
]);

/** Attachments owned by a single journal/payment row (no inherited sale/purchase files on payment settlements). */
export function collectTransactionOwnedAttachments(input: {
  referenceType?: string | null;
  paymentId?: string | null;
  jeAttachments?: unknown;
  paymentAttachments?: unknown;
  expenseReceiptUrl?: string | null;
  documentAttachments?: unknown;
}): TransactionAttachment[] {
  const rt = String(input.referenceType || '').toLowerCase().trim();
  const hasPayment = !!String(input.paymentId || '').trim();
  const isDocumentJe = DOCUMENT_JE_REFERENCE_TYPES.has(rt);

  const parts: unknown[] = [input.jeAttachments];

  if (hasPayment) {
    parts.push(input.paymentAttachments);
    if (rt === 'expense' || rt === 'extra_expense') {
      parts.push(receiptUrlToAttachments(input.expenseReceiptUrl));
    }
  } else if (isDocumentJe) {
    parts.push(input.documentAttachments);
  } else if (rt === 'expense' || rt === 'extra_expense') {
    parts.push(receiptUrlToAttachments(input.expenseReceiptUrl));
  }

  return mergeAttachmentLists(...parts);
}
