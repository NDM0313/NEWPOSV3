/**
 * PF-14 payment chain: primary receipt + payment_adjustment rows share one `payments.id`.
 * Only the chronologically latest non-void chain member is the mutable "head" for edit/reverse;
 * older rows stay in the audit trail but must not be reversed in isolation (wrong amounts/accounts).
 */

export type PaymentChainTailInfo = {
  tailJournalId: string;
  memberCount: number;
};

/** payment UUID → tail JE id + chain length (non-void, non–correction_reversal members only). */
export type PaymentChainIndex = Map<string, PaymentChainTailInfo>;

type ChainRow = {
  id: string;
  payment_id?: string | null;
  reference_type?: string | null;
  reference_id?: string | null;
  created_at?: string | null;
  is_void?: boolean | null;
};

function paymentIdForChainGrouping(row: ChainRow): string | null {
  const rt = String(row.reference_type || '').toLowerCase();
  if (rt === 'correction_reversal') return null;
  const fromPaymentId = row.payment_id ? String(row.payment_id).trim() : '';
  if (fromPaymentId) return fromPaymentId;
  if (rt === 'payment_adjustment' && row.reference_id) return String(row.reference_id).trim();
  return null;
}

function isMemberOfPaymentChain(row: ChainRow, pid: string): boolean {
  if (row.payment_id && String(row.payment_id).trim() === pid) return true;
  const rt = String(row.reference_type || '').toLowerCase();
  return rt === 'payment_adjustment' && String(row.reference_id || '').trim() === pid;
}

/**
 * Build tail map from a journal list (e.g. `getAllEntries` result). Rows should already exclude void
 * if the consumer filters them; void rows are skipped here as well.
 */
export function buildPaymentChainIndex(rows: ChainRow[]): PaymentChainIndex {
  const groups = new Map<string, ChainRow[]>();
  for (const row of rows) {
    if (row.is_void === true) continue;
    const rt = String(row.reference_type || '').toLowerCase();
    if (rt === 'correction_reversal') continue;
    const pid = paymentIdForChainGrouping(row);
    if (!pid) continue;
    if (!isMemberOfPaymentChain(row, pid)) continue;
    if (!groups.has(pid)) groups.set(pid, []);
    groups.get(pid)!.push(row);
  }
  const idx: PaymentChainIndex = new Map();
  for (const [pid, list] of groups) {
    const sorted = [...list].sort(
      (a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
    );
    const tail = sorted[sorted.length - 1];
    if (tail) idx.set(pid, { tailJournalId: tail.id, memberCount: sorted.length });
  }
  return idx;
}

export function paymentChainFlagsForJournalEntry(
  je: {
    id: string;
    payment_id?: string | null;
    reference_type?: string | null;
    reference_id?: string | null;
  },
  index: PaymentChainIndex | null | undefined
): {
  paymentChainIsHistorical: boolean;
  paymentChainIsTail: boolean;
  paymentChainTailJournalId: string | null;
  paymentChainMemberCount: number;
} {
  const empty = {
    paymentChainIsHistorical: false,
    paymentChainIsTail: true,
    paymentChainTailJournalId: null as string | null,
    paymentChainMemberCount: 0,
  };
  if (!index?.size) return empty;
  const rt = String(je.reference_type || '').toLowerCase();
  const pid =
    (je.payment_id && String(je.payment_id).trim()) ||
    (rt === 'payment_adjustment' && je.reference_id ? String(je.reference_id).trim() : '');
  if (!pid) return empty;
  const info = index.get(pid);
  if (!info) return empty;
  const isTail = info.tailJournalId === je.id;
  const isHistorical = info.memberCount > 1 && !isTail;
  return {
    paymentChainIsHistorical: isHistorical,
    paymentChainIsTail: isTail,
    paymentChainTailJournalId: info.tailJournalId,
    paymentChainMemberCount: info.memberCount,
  };
}
