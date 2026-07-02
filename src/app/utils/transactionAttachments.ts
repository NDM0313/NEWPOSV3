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
