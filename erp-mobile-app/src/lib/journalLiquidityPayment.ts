/**
 * Backfill payments for journal-only liquidity movements — aligned with web journalLiquidityPaymentService.
 */

import { supabase, isSupabaseConfigured } from './supabase';
import { isLiquidityPaymentAccount, paymentMethodForLiquidityAccount, type LiquidityAccountRef } from './liquidityPaymentAccount';

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
  if (!isSupabaseConfigured) return;
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
    return acc && isLiquidityPaymentAccount(acc);
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
      reference_number: entryNo,
      notes,
      created_by: createdBy ?? null,
      received_by: createdBy ?? null,
    };

    const { data: row, error } = await supabase.from('payments').insert(payload).select('id').single();
    if (error) continue;
    if (row?.id) paymentIds.push(String(row.id));
  }

  if (paymentIds.length === 1) {
    await supabase.from('journal_entries').update({ payment_id: paymentIds[0] }).eq('id', journalEntryId);
  }
}
