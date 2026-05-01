import { supabase } from '../lib/supabase';

/**
 * Update an existing transaction in place.
 * ─ NO new journal entries are created ─
 * Only the existing payment row + journal entry header + journal_entry_lines are updated.
 */
export async function updateTransaction(
  _companyId: string,
  detail: {
    id: string;
    journalEntryId?: string | null;
    paymentId?: string | null;
    referenceType?: string | null;
    amount: number;
    direction?: string | null;
    referenceNumber?: string | null;
    journalLines?: { accountId: string; debit: number; credit: number }[];
  },
  updates: {
    paymentDate: string;
    amount: number;
    reference: string;
    notes: string;
    paymentAccountId?: string;
  }
) {
  const jeId = detail.journalEntryId || detail.id;

  // ──────────────────────────────────────────────────────
  // STEP 1: Resolve the real payment ID from journal entry
  // ──────────────────────────────────────────────────────
  let resolvedPaymentId: string | null =
    detail.paymentId && String(detail.paymentId).trim() ? String(detail.paymentId).trim() : null;

  if (!resolvedPaymentId) {
    const { data: jeRow } = await supabase
      .from('journal_entries')
      .select('reference_id')
      .eq('id', jeId)
      .maybeSingle();
    if (jeRow?.reference_id) resolvedPaymentId = String(jeRow.reference_id).trim();
  }

  // ──────────────────────────────────────────────────────
  // STEP 2: Update the journal entry header (date + description)
  // ──────────────────────────────────────────────────────
  await supabase
    .from('journal_entries')
    .update({
      entry_date: updates.paymentDate,
      description: updates.notes,
    })
    .eq('id', jeId);

  // ──────────────────────────────────────────────────────
  // STEP 3: Update existing journal_entry_lines in place
  //   - If amount changed: update debit/credit values
  //   - If account changed: update account_id on the liquidity line
  // ──────────────────────────────────────────────────────
  const { data: existingLines } = await supabase
    .from('journal_entry_lines')
    .select('id, account_id, debit, credit')
    .eq('journal_entry_id', jeId);

  if (existingLines && existingLines.length > 0) {
    for (const line of existingLines) {
      const isDebitLine = Number(line.debit) > 0;
      const isCreditLine = Number(line.credit) > 0;
      const patch: Record<string, unknown> = {};

      // Update amount if changed
      if (Math.abs(detail.amount - updates.amount) > 0.009) {
        if (isDebitLine) patch.debit = updates.amount;
        if (isCreditLine) patch.credit = updates.amount;
      }

      // Update account_id if this is the liquidity (payment account) line
      if (updates.paymentAccountId) {
        // The payment (liquidity) line: matches the old payment_account_id
        const oldAccountId = detail.journalLines?.find(
          l => l.accountId === line.account_id
        )?.accountId;
        // Determine if this line is the liquidity line
        // A liquidity line is cash/bank on the debit side for receipts, credit side for payments
        const isReceived = (detail.direction || '').toLowerCase() === 'received';
        const isLiquidityLine = isReceived ? isDebitLine : isCreditLine;
        if (isLiquidityLine && oldAccountId) {
          patch.account_id = updates.paymentAccountId;
        }
      }

      if (Object.keys(patch).length > 0) {
        await supabase
          .from('journal_entry_lines')
          .update(patch)
          .eq('id', line.id);
      }
    }
  }

  // ──────────────────────────────────────────────────────
  // STEP 4: Update the payment row in place (if found)
  // ──────────────────────────────────────────────────────
  if (resolvedPaymentId) {
    const patch: Record<string, unknown> = {
      payment_date: updates.paymentDate,
      amount: updates.amount,
      notes: updates.notes || null,
      reference_number: updates.reference || null,
      updated_at: new Date().toISOString(),
    };
    if (updates.paymentAccountId) {
      patch.payment_account_id = updates.paymentAccountId;
    }

    await supabase.from('payments').update(patch).eq('id', resolvedPaymentId);
  }
}
