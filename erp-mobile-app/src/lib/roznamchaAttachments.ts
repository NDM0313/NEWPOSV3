import { supabase, isSupabaseConfigured } from './supabase';
import { fetchInBatches } from './chunkInQuery';
import { normalizeAttachments, type NormalizedAttachment } from './normalizeAttachments';

export type AttachmentEnrichableRow = {
  attachments?: NormalizedAttachment[];
  referenceType?: string | null;
  referenceId?: string | null;
  sourcePaymentId?: string | null;
  sourceJournalEntryId?: string | null;
  paymentIdOnJournal?: string | null;
};

type JeMeta = {
  reference_type: string | null;
  reference_id: string | null;
  payment_id: string | null;
};

type PaymentMeta = {
  reference_type: string | null;
  reference_id: string | null;
};

export type AttachmentEnrichmentMaps = {
  jeAttachmentsById: Map<string, unknown>;
  jeMetaById: Map<string, JeMeta>;
  paymentAttachmentsById: Map<string, NormalizedAttachment[]>;
  paymentMetaById: Map<string, PaymentMeta>;
  expenseReceiptById: Map<string, string>;
  saleAttachmentsById: Map<string, NormalizedAttachment[]>;
  purchaseAttachmentsById: Map<string, NormalizedAttachment[]>;
};

const DOCUMENT_JE_REFERENCE_TYPES = new Set([
  'sale',
  'sale_adjustment',
  'sale_reversal',
  'purchase',
  'purchase_adjustment',
  'purchase_return',
]);

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

function receiptUrlToAttachments(receiptUrl?: string | null): NormalizedAttachment[] {
  const url = receiptUrl?.trim();
  if (!url) return [];
  return [{ url, name: 'receipt' }];
}

function collectTransactionOwnedAttachments(input: {
  referenceType?: string | null;
  paymentId?: string | null;
  jeAttachments?: unknown;
  paymentAttachments?: NormalizedAttachment[];
  expenseReceiptUrl?: string | null;
  documentAttachments?: NormalizedAttachment[];
}): NormalizedAttachment[] {
  const rt = String(input.referenceType || '').toLowerCase().trim();
  const hasPayment = !!String(input.paymentId || '').trim();
  const isDocumentJe = DOCUMENT_JE_REFERENCE_TYPES.has(rt);

  const parts: NormalizedAttachment[][] = [normalizeAttachments(input.jeAttachments)];

  if (hasPayment) {
    parts.push(input.paymentAttachments ?? []);
    if (rt === 'expense' || rt === 'extra_expense') {
      parts.push(receiptUrlToAttachments(input.expenseReceiptUrl));
    }
  } else if (isDocumentJe) {
    parts.push(input.documentAttachments ?? []);
  } else if (rt === 'expense' || rt === 'extra_expense') {
    parts.push(receiptUrlToAttachments(input.expenseReceiptUrl));
  }

  return mergeAttachmentLists(...parts);
}

export function roznamchaRowHasAttachments(row: { attachments?: NormalizedAttachment[] }): boolean {
  return (row.attachments?.length ?? 0) > 0;
}

export function resolveRowAttachmentsFromMaps(
  row: AttachmentEnrichableRow,
  maps: AttachmentEnrichmentMaps,
): NormalizedAttachment[] {
  const jeId = row.sourceJournalEntryId ? String(row.sourceJournalEntryId) : '';
  const jeMeta = jeId ? maps.jeMetaById.get(jeId) : undefined;
  const paymentId =
    String(row.sourcePaymentId || row.paymentIdOnJournal || jeMeta?.payment_id || '').trim() || null;
  const payMeta = paymentId ? maps.paymentMetaById.get(paymentId) : undefined;

  const referenceType = row.referenceType ?? jeMeta?.reference_type ?? payMeta?.reference_type ?? null;
  const referenceId = row.referenceId ?? jeMeta?.reference_id ?? payMeta?.reference_id ?? null;
  const rt = String(referenceType || '').toLowerCase();
  const refId = referenceId ? String(referenceId) : '';

  let expenseReceiptUrl: string | null = null;
  if (rt === 'expense' || rt === 'extra_expense') {
    expenseReceiptUrl = refId ? maps.expenseReceiptById.get(refId) ?? null : null;
  } else if (paymentId && payMeta?.reference_type === 'expense' && payMeta.reference_id) {
    expenseReceiptUrl = maps.expenseReceiptById.get(String(payMeta.reference_id)) ?? null;
  }

  let documentAttachments: NormalizedAttachment[] | undefined;
  if (rt === 'sale' || rt === 'sale_adjustment' || rt === 'sale_reversal') {
    documentAttachments = refId ? maps.saleAttachmentsById.get(refId) : undefined;
  } else if (rt === 'purchase' || rt === 'purchase_adjustment' || rt === 'purchase_return') {
    documentAttachments = refId ? maps.purchaseAttachmentsById.get(refId) : undefined;
  }

  return collectTransactionOwnedAttachments({
    referenceType,
    paymentId,
    jeAttachments: jeId ? maps.jeAttachmentsById.get(jeId) : undefined,
    paymentAttachments: paymentId ? maps.paymentAttachmentsById.get(paymentId) : undefined,
    expenseReceiptUrl,
    documentAttachments,
  });
}

async function loadJeMetaAndAttachments(
  companyId: string,
  jeIds: string[],
): Promise<{
  jeAttachmentsById: Map<string, unknown>;
  jeMetaById: Map<string, JeMeta>;
}> {
  const jeAttachmentsById = new Map<string, unknown>();
  const jeMetaById = new Map<string, JeMeta>();
  if (!isSupabaseConfigured || !jeIds.length) return { jeAttachmentsById, jeMetaById };

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
  paymentAttachmentsById: Map<string, NormalizedAttachment[]>;
  paymentMetaById: Map<string, PaymentMeta>;
}> {
  const paymentAttachmentsById = new Map<string, NormalizedAttachment[]>();
  const paymentMetaById = new Map<string, PaymentMeta>();
  if (!isSupabaseConfigured || !paymentIds.length) return { paymentAttachmentsById, paymentMetaById };

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
    paymentAttachmentsById.set(id, normalizeAttachments((row as { attachments?: unknown }).attachments));
    paymentMetaById.set(id, {
      reference_type: (row as { reference_type?: string | null }).reference_type ?? null,
      reference_id: (row as { reference_id?: string | null }).reference_id ?? null,
    });
  }
  return { paymentAttachmentsById, paymentMetaById };
}

async function loadExpenseReceiptById(expenseIds: string[]): Promise<Map<string, string>> {
  const expenseReceiptById = new Map<string, string>();
  if (!isSupabaseConfigured || !expenseIds.length) return expenseReceiptById;

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

async function loadSaleAttachmentsById(saleIds: string[]): Promise<Map<string, NormalizedAttachment[]>> {
  const saleAttachmentsById = new Map<string, NormalizedAttachment[]>();
  if (!isSupabaseConfigured || !saleIds.length) return saleAttachmentsById;

  const rows = await fetchInBatches(saleIds, async (chunk) => {
    const { data, error } = await supabase.from('sales').select('id, attachments').in('id', chunk);
    if (error) throw error;
    return data || [];
  });

  for (const row of rows) {
    const id = String((row as { id?: string }).id || '');
    if (!id) continue;
    const att = normalizeAttachments((row as { attachments?: unknown }).attachments);
    if (att.length) saleAttachmentsById.set(id, att);
  }
  return saleAttachmentsById;
}

async function loadPurchaseAttachmentsById(
  purchaseIds: string[],
): Promise<Map<string, NormalizedAttachment[]>> {
  const purchaseAttachmentsById = new Map<string, NormalizedAttachment[]>();
  if (!isSupabaseConfigured || !purchaseIds.length) return purchaseAttachmentsById;

  const rows = await fetchInBatches(purchaseIds, async (chunk) => {
    const { data, error } = await supabase.from('purchases').select('id, attachments').in('id', chunk);
    if (error) throw error;
    return data || [];
  });

  for (const row of rows) {
    const id = String((row as { id?: string }).id || '');
    if (!id) continue;
    const att = normalizeAttachments((row as { attachments?: unknown }).attachments);
    if (att.length) purchaseAttachmentsById.set(id, att);
  }
  return purchaseAttachmentsById;
}

function collectReferenceIdsForEnrichment(
  rows: AttachmentEnrichableRow[],
  jeMetaById: Map<string, JeMeta>,
  paymentMetaById: Map<string, PaymentMeta>,
): {
  expenseIds: string[];
  saleIds: string[];
  purchaseIds: string[];
} {
  const expenseIds = new Set<string>();
  const saleIds = new Set<string>();
  const purchaseIds = new Set<string>();

  for (const row of rows) {
    const jeId = row.sourceJournalEntryId ? String(row.sourceJournalEntryId) : '';
    const jeMeta = jeId ? jeMetaById.get(jeId) : undefined;
    const paymentId =
      String(row.sourcePaymentId || row.paymentIdOnJournal || jeMeta?.payment_id || '').trim() || null;
    const payMeta = paymentId ? paymentMetaById.get(paymentId) : undefined;

    const referenceType = row.referenceType ?? jeMeta?.reference_type ?? payMeta?.reference_type ?? null;
    const referenceId = row.referenceId ?? jeMeta?.reference_id ?? payMeta?.reference_id ?? null;
    const rt = String(referenceType || '').toLowerCase();
    const refId = referenceId ? String(referenceId) : '';
    if (!refId) continue;

    if (rt === 'expense' || rt === 'extra_expense') expenseIds.add(refId);
    else if (rt === 'sale' || rt === 'sale_adjustment' || rt === 'sale_reversal') saleIds.add(refId);
    else if (rt === 'purchase' || rt === 'purchase_adjustment' || rt === 'purchase_return') {
      purchaseIds.add(refId);
    }

    if (payMeta?.reference_type === 'expense' && payMeta.reference_id) {
      expenseIds.add(String(payMeta.reference_id));
    }
  }

  return {
    expenseIds: [...expenseIds],
    saleIds: [...saleIds],
    purchaseIds: [...purchaseIds],
  };
}

export async function enrichRowsWithTransactionAttachments<T extends AttachmentEnrichableRow>(
  companyId: string,
  rows: T[],
): Promise<T[]> {
  if (!isSupabaseConfigured || !companyId || !rows.length) return rows;

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

export async function loadRowAttachmentsLazy(
  companyId: string,
  row: AttachmentEnrichableRow,
): Promise<NormalizedAttachment[]> {
  if (row.attachments?.length) return row.attachments;
  const [enriched] = await enrichRowsWithTransactionAttachments(companyId, [{ ...row }]);
  return enriched.attachments ?? [];
}
