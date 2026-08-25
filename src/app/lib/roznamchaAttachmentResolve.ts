import {
  collectTransactionOwnedAttachments,
  type TransactionAttachment,
} from '@/app/utils/transactionAttachments';

export type AttachmentEnrichableRow = {
  attachments?: TransactionAttachment[];
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
  paymentAttachmentsById: Map<string, TransactionAttachment[]>;
  paymentMetaById: Map<string, PaymentMeta>;
  expenseReceiptById: Map<string, string>;
  saleAttachmentsById: Map<string, TransactionAttachment[]>;
  purchaseAttachmentsById: Map<string, TransactionAttachment[]>;
};

export function roznamchaRowHasAttachments(row: { attachments?: TransactionAttachment[] }): boolean {
  return (row.attachments?.length ?? 0) > 0;
}

export function resolveRowAttachmentsFromMaps(
  row: AttachmentEnrichableRow,
  maps: AttachmentEnrichmentMaps,
): TransactionAttachment[] {
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

  let documentAttachments: unknown;
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

export function collectReferenceIdsForEnrichment(
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
