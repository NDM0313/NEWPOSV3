/**
 * PF-14: reversing the *tail* journal entry by mirroring its lines only undoes that leg’s delta
 * (e.g. Rs 5,000), not the payment’s effective total (e.g. Rs 50,000). When the chain has multiple
 * active members, build a single correction_reversal that offsets Dr/Cr for the full `payments.amount`
 * against the current liquidity account and party AR/AP.
 */

import { supabase } from '@/lib/supabase';
import {
  resolveReceivablePostingAccountId,
  resolvePayablePostingAccountId,
} from '@/app/services/partySubledgerAccountService';

/** Matches `JournalEntryLine` in accountingService (avoid circular import). */
type ReversalLine = {
  id: string;
  journal_entry_id: string;
  account_id: string;
  debit: number;
  credit: number;
  description?: string;
};

export type CompositeReversalBuild = {
  lines: ReversalLine[];
  description: string;
  /** Customer / supplier receipt vs payment */
  polarity: 'customer_receipt' | 'supplier_payment';
};

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Returns reversal lines + description, or null → caller mirrors the original JE lines (legacy).
 */
export async function tryBuildCompositePaymentChainReversal(args: {
  companyId: string;
  paymentId: string;
  tailEntryNo?: string | null;
  paymentRef?: string | null;
}): Promise<CompositeReversalBuild | null> {
  const { companyId, paymentId, tailEntryNo, paymentRef } = args;
  const { data: pay, error } = await supabase
    .from('payments')
    .select(
      'id, reference_type, reference_id, contact_id, amount, payment_account_id, reference_number'
    )
    .eq('id', paymentId)
    .eq('company_id', companyId)
    .maybeSingle();
  if (error || !pay) return null;

  const refType = String((pay as { reference_type?: string }).reference_type || '').toLowerCase();
  const paymentAccountId = String((pay as { payment_account_id?: string | null }).payment_account_id || '').trim();
  const amt = roundMoney(Number((pay as { amount?: number | string | null }).amount) || 0);
  if (!paymentAccountId || amt <= 0) return null;

  const refNo =
    String((pay as { reference_number?: string | null }).reference_number || '').trim() ||
    String(paymentRef || '').trim() ||
    paymentId.slice(0, 8);

  const tailLabel = tailEntryNo ? ` (latest JE ${tailEntryNo})` : '';

  // ── Customer-side receipts (Dr liquidity, Cr AR) → reverse: Dr AR, Cr liquidity
  if (refType === 'sale' && (pay as { reference_id?: string | null }).reference_id) {
    const saleId = String((pay as { reference_id: string }).reference_id);
    const { data: saleRow } = await supabase
      .from('sales')
      .select('invoice_no, customer_id')
      .eq('id', saleId)
      .maybeSingle();
    const inv = String((saleRow as { invoice_no?: string } | null)?.invoice_no || '').trim();
    const customerId = String((saleRow as { customer_id?: string | null } | null)?.customer_id || '').trim();
    const arId =
      (await resolveReceivablePostingAccountId(companyId, customerId || undefined)) || null;
    if (!arId) return null;
    const desc = `Reversal of payment (effective Rs ${amt.toLocaleString()}${inv ? ` – ${inv}` : ''})${tailLabel}`;
    const lines: ReversalLine[] = [
      {
        id: '',
        journal_entry_id: '',
        account_id: arId,
        debit: amt,
        credit: 0,
        description: `AR – reverse receipt ${refNo}`,
      },
      {
        id: '',
        journal_entry_id: '',
        account_id: paymentAccountId,
        debit: 0,
        credit: amt,
        description: `Liquidity – reverse receipt ${refNo}`,
      },
    ];
    return { lines, description: desc, polarity: 'customer_receipt' };
  }

  if (refType === 'manual_receipt' || refType === 'on_account') {
    const contactId = String((pay as { contact_id?: string | null }).contact_id || '').trim();
    const arId =
      (await resolveReceivablePostingAccountId(companyId, contactId || undefined)) || null;
    if (!arId) return null;
    const desc = `Reversal of payment (effective Rs ${amt.toLocaleString()})${tailLabel}`;
    const lines: ReversalLine[] = [
      {
        id: '',
        journal_entry_id: '',
        account_id: arId,
        debit: amt,
        credit: 0,
        description: `AR – reverse receipt ${refNo}`,
      },
      {
        id: '',
        journal_entry_id: '',
        account_id: paymentAccountId,
        debit: 0,
        credit: amt,
        description: `Liquidity – reverse receipt ${refNo}`,
      },
    ];
    return { lines, description: desc, polarity: 'customer_receipt' };
  }

  // ── Supplier-side payments (Dr AP, Cr liquidity) → reverse: Dr liquidity, Cr AP
  if (refType === 'purchase' && (pay as { reference_id?: string | null }).reference_id) {
    const purchaseId = String((pay as { reference_id: string }).reference_id);
    const { data: puRow } = await supabase
      .from('purchases')
      .select('invoice_no, supplier_id')
      .eq('id', purchaseId)
      .maybeSingle();
    const inv = String((puRow as { invoice_no?: string } | null)?.invoice_no || '').trim();
    const supplierId = String((puRow as { supplier_id?: string | null } | null)?.supplier_id || '').trim();
    const apId =
      (await resolvePayablePostingAccountId(companyId, supplierId || undefined)) || null;
    if (!apId) return null;
    const desc = `Reversal of payment (effective Rs ${amt.toLocaleString()}${inv ? ` – ${inv}` : ''})${tailLabel}`;
    const lines: ReversalLine[] = [
      {
        id: '',
        journal_entry_id: '',
        account_id: paymentAccountId,
        debit: amt,
        credit: 0,
        description: `Liquidity – reverse payment ${refNo}`,
      },
      {
        id: '',
        journal_entry_id: '',
        account_id: apId,
        debit: 0,
        credit: amt,
        description: `AP – reverse payment ${refNo}`,
      },
    ];
    return { lines, description: desc, polarity: 'supplier_payment' };
  }

  if (refType === 'manual_payment') {
    const contactId = String((pay as { contact_id?: string | null }).contact_id || '').trim();
    const apId =
      (await resolvePayablePostingAccountId(companyId, contactId || undefined)) || null;
    if (!apId) return null;
    const desc = `Reversal of payment (effective Rs ${amt.toLocaleString()})${tailLabel}`;
    const lines: ReversalLine[] = [
      {
        id: '',
        journal_entry_id: '',
        account_id: paymentAccountId,
        debit: amt,
        credit: 0,
        description: `Liquidity – reverse payment ${refNo}`,
      },
      {
        id: '',
        journal_entry_id: '',
        account_id: apId,
        debit: 0,
        credit: amt,
        description: `AP – reverse payment ${refNo}`,
      },
    ];
    return { lines, description: desc, polarity: 'supplier_payment' };
  }

  return null;
}
