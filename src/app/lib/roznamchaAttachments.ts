import { supabase } from '@/lib/supabase';
import { fetchInBatches } from '@/app/lib/chunkInQuery';
import {
  collectReferenceIdsForEnrichment,
  resolveRowAttachmentsFromMaps,
  roznamchaRowHasAttachments,
  type AttachmentEnrichableRow,
  type AttachmentEnrichmentMaps,
} from '@/app/lib/roznamchaAttachmentResolve';
import { normalizeAttachmentList, type TransactionAttachment } from '@/app/utils/transactionAttachments';

export type { TransactionAttachment, AttachmentEnrichableRow, AttachmentEnrichmentMaps };
export { roznamchaRowHasAttachments, resolveRowAttachmentsFromMaps };

async function loadJeMetaAndAttachments(
  companyId: string,
  jeIds: string[],
): Promise<{
  jeAttachmentsById: Map<string, unknown>;
  jeMetaById: AttachmentEnrichmentMaps['jeMetaById'];
}> {
  const jeAttachmentsById = new Map<string, unknown>();
  const jeMetaById = new Map<
    string,
    { reference_type: string | null; reference_id: string | null; payment_id: string | null }
  >();
  if (!jeIds.length) return { jeAttachmentsById, jeMetaById };

  const rows = await fetchInBatches(jeIds, async (chunk) => {
    const { data, error } = await supabase
      .from('journal_entries')
      .select('id, attachments, reference_type, reference_id, payment_id')
      .eq('company_id', companyId)
      .in('id', chunk);
    if (error) throw error;
    return data || [];
  });

  for (const row of rows) {
    const id = String((row as { id?: string }).id || '');
    if (!id) continue;
    jeAttachmentsById.set(id, (row as { attachments?: unknown }).attachments);
    jeMetaById.set(id, {
      reference_type: (row as { reference_type?: string | null }).reference_type ?? null,
      reference_id: (row as { reference_id?: string | null }).reference_id ?? null,
      payment_id: (row as { payment_id?: string | null }).payment_id ?? null,
    });
  }
  return { jeAttachmentsById, jeMetaById };
}

async function loadPaymentAttachmentMaps(
  companyId: string,
  paymentIds: string[],
): Promise<{
  paymentAttachmentsById: Map<string, TransactionAttachment[]>;
  paymentMetaById: Map<string, { reference_type: string | null; reference_id: string | null }>;
}> {
  const paymentAttachmentsById = new Map<string, TransactionAttachment[]>();
  const paymentMetaById = new Map<string, { reference_type: string | null; reference_id: string | null }>();
  if (!paymentIds.length) return { paymentAttachmentsById, paymentMetaById };

  const rows = await fetchInBatches(paymentIds, async (chunk) => {
    const { data, error } = await supabase
      .from('payments')
      .select('id, attachments, reference_type, reference_id')
      .eq('company_id', companyId)
      .in('id', chunk);
    if (error) throw error;
    return data || [];
  });

  for (const row of rows) {
    const id = String((row as { id?: string }).id || '');
    if (!id) continue;
    paymentAttachmentsById.set(id, normalizeAttachmentList((row as { attachments?: unknown }).attachments));
    paymentMetaById.set(id, {
      reference_type: (row as { reference_type?: string | null }).reference_type ?? null,
      reference_id: (row as { reference_id?: string | null }).reference_id ?? null,
    });
  }
  return { paymentAttachmentsById, paymentMetaById };
}

async function loadExpenseReceiptById(expenseIds: string[]): Promise<Map<string, string>> {
  const expenseReceiptById = new Map<string, string>();
  if (!expenseIds.length) return expenseReceiptById;

  const rows = await fetchInBatches(expenseIds, async (chunk) => {
    const { data, error } = await supabase.from('expenses').select('id, receipt_url').in('id', chunk);
    if (error) throw error;
    return data || [];
  });

  for (const row of rows) {
    const id = String((row as { id?: string }).id || '');
    const receipt = String((row as { receipt_url?: string | null }).receipt_url || '').trim();
    if (id && receipt) expenseReceiptById.set(id, receipt);
  }
  return expenseReceiptById;
}

async function loadSaleAttachmentsById(saleIds: string[]): Promise<Map<string, TransactionAttachment[]>> {
  const saleAttachmentsById = new Map<string, TransactionAttachment[]>();
  if (!saleIds.length) return saleAttachmentsById;

  const rows = await fetchInBatches(saleIds, async (chunk) => {
    const { data, error } = await supabase.from('sales').select('id, attachments').in('id', chunk);
    if (error) throw error;
    return data || [];
  });

  for (const row of rows) {
    const id = String((row as { id?: string }).id || '');
    if (!id) continue;
    const att = normalizeAttachmentList((row as { attachments?: unknown }).attachments);
    if (att.length) saleAttachmentsById.set(id, att);
  }
  return saleAttachmentsById;
}

async function loadPurchaseAttachmentsById(
  purchaseIds: string[],
): Promise<Map<string, TransactionAttachment[]>> {
  const purchaseAttachmentsById = new Map<string, TransactionAttachment[]>();
  if (!purchaseIds.length) return purchaseAttachmentsById;

  const rows = await fetchInBatches(purchaseIds, async (chunk) => {
    const { data, error } = await supabase.from('purchases').select('id, attachments').in('id', chunk);
    if (error) throw error;
    return data || [];
  });

  for (const row of rows) {
    const id = String((row as { id?: string }).id || '');
    if (!id) continue;
    const att = normalizeAttachmentList((row as { attachments?: unknown }).attachments);
    if (att.length) purchaseAttachmentsById.set(id, att);
  }
  return purchaseAttachmentsById;
}

/** Batch-resolve owned attachments for roznamcha / cash-flow rows (mutates rows in place). */
export async function enrichRowsWithTransactionAttachments<T extends AttachmentEnrichableRow>(
  companyId: string,
  rows: T[],
): Promise<T[]> {
  if (!companyId || !rows.length) return rows;

  const jeIds = [
    ...new Set(
      rows
        .map((r) => (r.sourceJournalEntryId ? String(r.sourceJournalEntryId) : ''))
        .filter(Boolean),
    ),
  ];
  const paymentIds = [
    ...new Set(
      rows
        .flatMap((r) => [r.sourcePaymentId, r.paymentIdOnJournal].filter(Boolean).map(String))
        .filter(Boolean),
    ),
  ];

  const [{ jeAttachmentsById, jeMetaById }, { paymentAttachmentsById, paymentMetaById }] =
    await Promise.all([
      loadJeMetaAndAttachments(companyId, jeIds),
      loadPaymentAttachmentMaps(companyId, paymentIds),
    ]);

  const { expenseIds, saleIds, purchaseIds } = collectReferenceIdsForEnrichment(
    rows,
    jeMetaById,
    paymentMetaById,
  );

  const [expenseReceiptById, saleAttachmentsById, purchaseAttachmentsById] = await Promise.all([
    loadExpenseReceiptById(expenseIds),
    loadSaleAttachmentsById(saleIds),
    loadPurchaseAttachmentsById(purchaseIds),
  ]);

  const maps: AttachmentEnrichmentMaps = {
    jeAttachmentsById,
    jeMetaById,
    paymentAttachmentsById,
    paymentMetaById,
    expenseReceiptById,
    saleAttachmentsById,
    purchaseAttachmentsById,
  };

  for (const row of rows) {
    const attachments = resolveRowAttachmentsFromMaps(row, maps);
    if (attachments.length > 0) row.attachments = attachments;
  }

  return rows;
}

/** Lazy load attachments for a single row (unified loader fallback). */
export async function loadRowAttachmentsLazy(
  companyId: string,
  row: AttachmentEnrichableRow,
): Promise<TransactionAttachment[]> {
  if (row.attachments?.length) return row.attachments;
  const [enriched] = await enrichRowsWithTransactionAttachments(companyId, [{ ...row }]);
  return enriched.attachments ?? [];
}
