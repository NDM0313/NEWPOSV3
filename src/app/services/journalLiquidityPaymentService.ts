/**
 * Backfill payments rows for journal-only entries that move cash/bank/wallet
 * (General Entry, internal transfer, pure journal) so Roznamcha stays payments-first.
 */

import { supabase } from '@/lib/supabase';
import {
  isRoznamchaLiquidityAccount,
  paymentMethodForLiquidityAccount,
  type LiquidityAccountRef,
} from '@/app/lib/liquidityPaymentAccount';
import { generatePaymentReference } from '@/app/utils/paymentUtils';

export interface JournalLiquidityLineInput {
  accountId: string;
  debit: number;
  credit: number;
}

export async function ensurePaymentsForLiquidityJournal(params: {
  companyId: string;
  branchId: string | null;
  journalEntryId: string;
  entryNo: string;
  entryDate: string;
  description: string;
  lines: JournalLiquidityLineInput[];
  createdBy?: string | null;
}): Promise<void> {
  const { companyId, branchId, journalEntryId, entryNo, entryDate, description, lines, createdBy } = params;
  const accountIds = [...new Set(lines.map((l) => l.accountId).filter(Boolean))];
  if (accountIds.length === 0) return;

  const { data: accounts } = await supabase
    .from('accounts')
    .select('id, name, type, code')
    .eq('company_id', companyId)
    .in('id', accountIds);

  const accountById = new Map<string, LiquidityAccountRef & { id: string }>();
  (accounts || []).forEach((a: { id: string; name: string; type: string; code: string | null }) => {
    if (a?.id) accountById.set(a.id, { id: a.id, name: a.name, type: a.type, code: a.code });
  });

  const liquidityLines = lines.filter((l) => {
    const acc = accountById.get(l.accountId);
    return acc && isRoznamchaLiquidityAccount(acc);
  });
  if (liquidityLines.length === 0) return;

  const notes = description || entryNo;
  const paymentIds: string[] = [];

  for (const line of liquidityLines) {
    const acc = accountById.get(line.accountId)!;
    const debit = Number(line.debit) || 0;
    const credit = Number(line.credit) || 0;
    if (debit <= 0 && credit <= 0) continue;
    const amount = debit > 0 ? debit : credit;
    const isIn = debit > 0;
    const payload: Record<string, unknown> = {
      company_id: companyId,
      branch_id: branchId,
      payment_type: isIn ? 'received' : 'paid',
      reference_type: isIn ? 'manual_receipt' : 'manual_payment',
      reference_id: journalEntryId,
      amount,
      payment_method: paymentMethodForLiquidityAccount(acc),
      payment_account_id: line.accountId,
      payment_date: entryDate,
      reference_number: entryNo || generatePaymentReference(null),
      notes,
      created_by: createdBy ?? null,
      received_by: createdBy ?? null,
    };

    const { data: row, error } = await supabase.from('payments').insert(payload).select('id').single();
    if (error) {
      console.warn('[journalLiquidityPayment] payment insert failed:', error.message);
      continue;
    }
    if (row?.id) paymentIds.push(String(row.id));
  }

  if (paymentIds.length === 1) {
    await supabase.from('journal_entries').update({ payment_id: paymentIds[0] }).eq('id', journalEntryId);
  }
}

/** Patch linked liquidity payment after editing a pure journal (General Entry). */
export async function syncLiquidityPaymentForJournal(params: {
  companyId: string;
  paymentId: string;
  entryNo: string;
  entryDate: string;
  description: string;
  lines: JournalLiquidityLineInput[];
}): Promise<void> {
  const { companyId, paymentId, entryNo, entryDate, description, lines } = params;
  const accountIds = [...new Set(lines.map((l) => l.accountId).filter(Boolean))];
  if (!accountIds.length || !paymentId) return;

  const { data: accounts } = await supabase
    .from('accounts')
    .select('id, name, type, code')
    .eq('company_id', companyId)
    .in('id', accountIds);

  const accountById = new Map<string, LiquidityAccountRef & { id: string }>();
  (accounts || []).forEach((a: { id: string; name: string; type: string; code: string | null }) => {
    if (a?.id) accountById.set(a.id, { id: a.id, name: a.name, type: a.type, code: a.code });
  });

  const liquidityLines = lines.filter((l) => {
    const acc = accountById.get(l.accountId);
    return acc && isRoznamchaLiquidityAccount(acc);
  });
  if (!liquidityLines.length) return;

  const line = liquidityLines[0];
  const acc = accountById.get(line.accountId)!;
  const debit = Number(line.debit) || 0;
  const credit = Number(line.credit) || 0;
  if (debit <= 0 && credit <= 0) return;
  const amount = debit > 0 ? debit : credit;
  const isIn = debit > 0;
  const notes = description || entryNo;

  const { error } = await supabase
    .from('payments')
    .update({
      amount,
      payment_account_id: line.accountId,
      payment_date: entryDate,
      payment_method: paymentMethodForLiquidityAccount(acc),
      payment_type: isIn ? 'received' : 'paid',
      reference_type: isIn ? 'manual_receipt' : 'manual_payment',
      notes,
      reference_number: entryNo || generatePaymentReference(null),
    })
    .eq('id', paymentId)
    .eq('company_id', companyId);

  if (error) {
    console.warn('[journalLiquidityPayment] payment sync failed:', error.message);
  }
}

/** Update existing liquidity payments linked to a journal (transfer / backfilled rows). */
export async function syncExistingLiquidityPaymentsForJournal(params: {
  companyId: string;
  journalEntryId: string;
  entryNo: string;
  entryDate: string;
  description: string;
  lines: JournalLiquidityLineInput[];
}): Promise<{ syncedCount: number }> {
  const { companyId, journalEntryId, entryNo, entryDate, description, lines } = params;
  const accountIds = [...new Set(lines.map((l) => l.accountId).filter(Boolean))];
  if (!accountIds.length) return { syncedCount: 0 };

  const { data: existing } = await supabase
    .from('payments')
    .select('id, payment_account_id')
    .eq('company_id', companyId)
    .eq('reference_id', journalEntryId);

  if (!existing?.length) return { syncedCount: 0 };

  const { data: accounts } = await supabase
    .from('accounts')
    .select('id, name, type, code')
    .eq('company_id', companyId)
    .in('id', accountIds);

  const accountById = new Map<string, LiquidityAccountRef & { id: string }>();
  (accounts || []).forEach((a: { id: string; name: string; type: string; code: string | null }) => {
    if (a?.id) accountById.set(a.id, { id: a.id, name: a.name, type: a.type, code: a.code });
  });

  const liquidityLines = lines.filter((l) => {
    const acc = accountById.get(l.accountId);
    return acc && isRoznamchaLiquidityAccount(acc);
  });
  if (!liquidityLines.length) return { syncedCount: 0 };

  const existingByAccount = new Map<string, string>();
  for (const row of existing as { id: string; payment_account_id?: string | null }[]) {
    const acct = row.payment_account_id ? String(row.payment_account_id) : '';
    if (acct && row.id) existingByAccount.set(acct, String(row.id));
  }

  let syncedCount = 0;
  for (const line of liquidityLines) {
    const paymentId = existingByAccount.get(line.accountId);
    if (!paymentId) continue;
    await syncLiquidityPaymentForJournal({
      companyId,
      paymentId,
      entryNo,
      entryDate,
      description,
      lines: [line],
    });
    syncedCount += 1;
  }

  return { syncedCount };
}
