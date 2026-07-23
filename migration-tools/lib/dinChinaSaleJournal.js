import {
  dinChinaUuid,
  legacyTxnNote,
} from './dinChinaLegacyMap.js';
import { SALE_JOURNAL_STRATEGY } from './dinChinaCoaPreflight.js';

export function saleDocumentJournalFingerprint(companyId, saleId) {
  return `sale_document:${companyId}:${saleId}`;
}

export async function findActiveCanonicalSaleDocumentJournalEntryId(supabase, saleId) {
  const { data, error } = await supabase
    .from('journal_entries')
    .select('id')
    .eq('reference_type', 'sale')
    .eq('reference_id', saleId)
    .is('payment_id', null)
    .or('is_void.is.null,is_void.eq.false')
    .order('created_at', { ascending: true })
    .limit(1);
  if (error) return null;
  return data?.[0]?.id ?? null;
}

async function journalHasValidArRevenueLines(supabase, jeId, arAccountId, revenueAccountId) {
  const { data: lines } = await supabase
    .from('journal_entry_lines')
    .select('account_id, debit, credit')
    .eq('journal_entry_id', jeId);
  if (!lines?.length) return false;
  const hasAr = lines.some((l) => l.account_id === arAccountId && Number(l.debit) > 0);
  const hasRev = lines.some((l) => l.account_id === revenueAccountId && Number(l.credit) > 0);
  return hasAr && hasRev && lines.length === 2;
}

/**
 * Minimal sale document JE for legacy import — Dr AR / Cr 4100 (no COGS, no record_sale RPC).
 */
export async function createImportSaleJournalEntry(supabase, params) {
  const {
    saleId,
    companyId,
    branchId,
    total,
    invoiceNo,
    entryDate,
    arAccountId,
    revenueAccountId,
    legacyTransactionId,
  } = params;

  if (!saleId || !companyId || !arAccountId || !revenueAccountId) {
    return { ok: false, error: 'missing_accounts_or_sale' };
  }
  if (total <= 0) {
    return { ok: true, skipped: true, reason: 'zero_total' };
  }

  const existing = await findActiveCanonicalSaleDocumentJournalEntryId(supabase, saleId);
  if (
    existing &&
    (await journalHasValidArRevenueLines(supabase, existing, arAccountId, revenueAccountId))
  ) {
    return { ok: true, skipped: true, reason: 'exists', journalEntryId: existing };
  }

  const jeId = existing ?? dinChinaUuid('journal_sale_doc', saleId);
  if (existing) {
    await supabase.from('journal_entry_lines').delete().eq('journal_entry_id', existing);
  }
  const fingerprint = saleDocumentJournalFingerprint(companyId, saleId);
  const dateStr = String(entryDate || '').slice(0, 10) || new Date().toISOString().slice(0, 10);

  const { error: jeErr } = await supabase.from('journal_entries').upsert(
    {
      id: jeId,
      company_id: companyId,
      branch_id: branchId ?? null,
      entry_no: `JE-DC-${String(legacyTransactionId).padStart(4, '0')}`,
      entry_date: dateStr,
      description: `Sale finalized – ${invoiceNo} ${legacyTxnNote(legacyTransactionId)}`,
      reference_type: 'sale',
      reference_id: saleId,
      payment_id: null,
      action_fingerprint: fingerprint,
      is_void: false,
      total_debit: total,
      total_credit: total,
    },
    { onConflict: 'id' },
  );
  if (jeErr) return { ok: false, error: jeErr.message };

  const lines = [
    {
      id: dinChinaUuid('journal_line', `${jeId}:dr_ar`),
      journal_entry_id: jeId,
      account_id: arAccountId,
      debit: total,
      credit: 0,
      description: `Accounts Receivable – ${invoiceNo}`,
    },
    {
      id: dinChinaUuid('journal_line', `${jeId}:cr_rev`),
      journal_entry_id: jeId,
      account_id: revenueAccountId,
      debit: 0,
      credit: total,
      description: `Sales Revenue – ${invoiceNo}`,
    },
  ];

  const { error: lineErr } = await supabase.from('journal_entry_lines').upsert(lines, { onConflict: 'id' });
  if (lineErr) return { ok: false, error: lineErr.message };

  return {
    ok: true,
    created: true,
    journalEntryId: jeId,
    strategy: SALE_JOURNAL_STRATEGY,
  };
}
