import { fetchReferenceAttachments } from '../api/transactionDetail';
import { fetchInBatches } from './chunkInQuery';
import { supabase, isSupabaseConfigured } from './supabase';
import { normalizeAttachments, type NormalizedAttachment } from './normalizeAttachments';

function mergeAttachmentLists(...lists: NormalizedAttachment[][]): NormalizedAttachment[] {
  const seen = new Set<string>();
  const out: NormalizedAttachment[] = [];
  for (const list of lists) {
    for (const a of list) {
      const u = String(a.url || '').trim();
      if (!u || seen.has(u)) continue;
      seen.add(u);
      out.push({ url: u, name: a.name || 'Attachment' });
    }
  }
  return out;
}

async function loadPaymentAttachments(paymentId: string): Promise<NormalizedAttachment[]> {
  if (!isSupabaseConfigured || !paymentId) return [];
  const { data } = await supabase
    .from('payments')
    .select('attachments')
    .eq('id', paymentId)
    .maybeSingle();
  return data ? normalizeAttachments((data as { attachments?: unknown }).attachments) : [];
}

async function loadJournalAttachments(companyId: string, journalEntryId: string): Promise<NormalizedAttachment[]> {
  if (!isSupabaseConfigured || !companyId || !journalEntryId) return [];
  const { data } = await supabase
    .from('journal_entries')
    .select('attachments')
    .eq('company_id', companyId)
    .eq('id', journalEntryId)
    .maybeSingle();
  return data ? normalizeAttachments((data as { attachments?: unknown }).attachments) : [];
}

/** Payment / timeline row — merge row attachments + reference document attachments. */
export async function loadMergedAttachmentsForTransaction(
  companyId: string,
  params: {
    rowAttachments?: unknown;
    referenceType?: string | null;
    referenceId?: string | null;
  },
): Promise<NormalizedAttachment[]> {
  const base = normalizeAttachments(params.rowAttachments);
  const refType = String(params.referenceType || '').trim();
  const refId = String(params.referenceId || '').trim();
  const extra =
    refType && refId ? await fetchReferenceAttachments(companyId, refType, refId) : [];
  return mergeAttachmentLists(base, extra);
}

/** Journal entry (Accounts dashboard, ledger) — JE + linked payment + reference. */
export async function loadMergedAttachmentsForJournalEntry(
  companyId: string,
  params: {
    journalEntryId: string;
    rowAttachments?: unknown;
    referenceType?: string | null;
    referenceId?: string | null;
    paymentId?: string | null;
  },
): Promise<NormalizedAttachment[]> {
  const jeFromRow = normalizeAttachments(params.rowAttachments);
  const jeFromDb =
    jeFromRow.length > 0
      ? jeFromRow
      : await loadJournalAttachments(companyId, params.journalEntryId);
  const paymentId = String(params.paymentId || '').trim();
  const paymentAtt = paymentId ? await loadPaymentAttachments(paymentId) : [];
  const refType = String(params.referenceType || '').trim();
  const refId = String(params.referenceId || '').trim();
  const refAtt =
    refType && refId ? await fetchReferenceAttachments(companyId, refType, refId) : [];
  return mergeAttachmentLists(jeFromDb, paymentAtt, refAtt);
}

/** Expense ids with a non-empty receipt_url (batch, for hasAttachments hints). */
export async function batchExpenseIdsWithReceiptUrl(
  companyId: string,
  expenseIds: string[],
): Promise<Set<string>> {
  const out = new Set<string>();
  const ids = Array.from(new Set(expenseIds.filter((id) => id.trim() !== '')));
  if (!isSupabaseConfigured || !companyId || ids.length === 0) return out;
  const rows = await fetchInBatches(ids, async (chunk) => {
    const { data, error } = await supabase
      .from('expenses')
      .select('id, receipt_url')
      .eq('company_id', companyId)
      .in('id', chunk);
    if (error) throw error;
    return data || [];
  });
  for (const row of rows) {
    const id = String((row as Record<string, unknown>).id ?? '');
    const ru = String((row as Record<string, unknown>).receipt_url ?? '').trim();
    if (id && ru) out.add(id);
  }
  return out;
}

/** Batch flag for ledger lines (RPC / worker ledgers without attachment columns). */
export async function batchJournalEntryHasAttachments(
  companyId: string,
  journalEntryIds: string[],
): Promise<Map<string, boolean>> {
  const result = new Map<string, boolean>();
  const ids = Array.from(new Set(journalEntryIds.filter((id) => id.trim() !== '')));
  if (!isSupabaseConfigured || !companyId || ids.length === 0) return result;

  const jeRows = await fetchInBatches(ids, async (chunk) => {
    const { data, error } = await supabase
      .from('journal_entries')
      .select('id, attachments, payment_id, reference_type, reference_id')
      .eq('company_id', companyId)
      .in('id', chunk);
    if (error) throw error;
    return data || [];
  });

  const paymentIds = new Set<string>();
  const jeMeta = new Map<
    string,
    { attachments: NormalizedAttachment[]; paymentId: string | null; referenceType: string; referenceId: string | null }
  >();

  for (const row of jeRows) {
    const id = String((row as Record<string, unknown>).id ?? '');
    if (!id) continue;
    const paymentId =
      (row as Record<string, unknown>).payment_id != null &&
      String((row as Record<string, unknown>).payment_id).trim() !== ''
        ? String((row as Record<string, unknown>).payment_id)
        : null;
    if (paymentId) paymentIds.add(paymentId);
    jeMeta.set(id, {
      attachments: normalizeAttachments((row as Record<string, unknown>).attachments),
      paymentId,
      referenceType: String((row as Record<string, unknown>).reference_type ?? ''),
      referenceId:
        (row as Record<string, unknown>).reference_id != null &&
        String((row as Record<string, unknown>).reference_id).trim() !== ''
          ? String((row as Record<string, unknown>).reference_id)
          : null,
    });
  }

  const paymentAttById = new Map<string, NormalizedAttachment[]>();
  if (paymentIds.size > 0) {
    const payRows = await fetchInBatches(Array.from(paymentIds), async (chunk) => {
      const { data, error } = await supabase
        .from('payments')
        .select('id, attachments')
        .in('id', chunk);
      if (error) throw error;
      return data || [];
    });
    for (const row of payRows) {
      const id = String((row as Record<string, unknown>).id ?? '');
      if (!id) continue;
      paymentAttById.set(id, normalizeAttachments((row as Record<string, unknown>).attachments));
    }
  }

  const expenseRefIds: string[] = [];
  for (const id of ids) {
    const meta = jeMeta.get(id);
    if (!meta) continue;
    const rt = meta.referenceType.toLowerCase();
    if (
      (rt === 'expense' || rt === 'expense_payment') &&
      meta.referenceId &&
      meta.attachments.length === 0 &&
      !(meta.paymentId && (paymentAttById.get(meta.paymentId)?.length ?? 0) > 0)
    ) {
      expenseRefIds.push(meta.referenceId);
    }
  }
  const expenseWithReceipt = await batchExpenseIdsWithReceiptUrl(companyId, expenseRefIds);

  for (const id of ids) {
    const meta = jeMeta.get(id);
    if (!meta) {
      result.set(id, false);
      continue;
    }
    const rt = meta.referenceType.toLowerCase();
    const hasExpenseReceipt =
      (rt === 'expense' || rt === 'expense_payment') &&
      !!meta.referenceId &&
      expenseWithReceipt.has(meta.referenceId);
    const has =
      meta.attachments.length > 0 ||
      (meta.paymentId ? (paymentAttById.get(meta.paymentId)?.length ?? 0) > 0 : false) ||
      hasExpenseReceipt;
    result.set(id, has);
  }
  return result;
}

/** Apply hasAttachments flags to ledger lines (RPC / worker sources). */
export async function enrichLedgerLinesWithHasAttachments(
  companyId: string,
  lines: import('../api/reports').LedgerLine[],
): Promise<import('../api/reports').LedgerLine[]> {
  if (!lines.length) return lines;
  const flags = await batchJournalEntryHasAttachments(
    companyId,
    lines.map((l) => l.journalEntryId).filter(Boolean),
  );
  return lines.map((l) => ({
    ...l,
    hasAttachments: l.hasAttachments || flags.get(l.journalEntryId) || false,
  }));
}
