/**
 * Pay salesman commission: Dr 2040 Salesman Payable / Cr Cash-Bank.
 * Links payment + JE to user id (reference_type commission_payment) for User Ledger.
 */
import { supabase } from '@/lib/supabase';
import { accountingService, type JournalEntry, type JournalEntryLine } from './accountingService';
import { accountHelperService } from './accountHelperService';
import { documentNumberService } from './documentNumberService';
import { resolveBranchIdForPaymentRpc } from './recordPaymentWithAccountingRpc';
import { logPaymentCreated } from './auditLogService';
import { defaultAccountsService } from './defaultAccountsService';

export interface CreateCommissionPaymentParams {
  companyId: string;
  branchId?: string | null;
  userId: string;
  userName: string;
  amount: number;
  paymentAccountId: string;
  paymentDate: string;
  paymentMethod?: string;
  notes?: string | null;
}

export interface CreateCommissionPaymentResult {
  paymentId: string;
  journalEntryId: string;
  referenceNumber: string;
}

function normalizePaymentMethod(method?: string | null): string {
  const m = String(method || 'cash').trim().toLowerCase();
  if (['bank', 'card', 'cheque', 'check', 'wallet', 'mobile_wallet'].includes(m)) return m === 'mobile_wallet' ? 'other' : m;
  return 'cash';
}

export async function createCommissionPayment(
  params: CreateCommissionPaymentParams,
): Promise<CreateCommissionPaymentResult> {
  const {
    companyId,
    branchId,
    userId,
    userName,
    amount,
    paymentAccountId,
    paymentDate,
    paymentMethod,
    notes,
  } = params;

  if (!companyId || !userId || amount <= 0 || !paymentAccountId) {
    throw new Error('companyId, userId, amount, and paymentAccountId are required.');
  }

  const branch = await resolveBranchIdForPaymentRpc(companyId, branchId ?? null);
  const dateVal = String(paymentDate || new Date().toISOString().slice(0, 10)).slice(0, 10);
  const rounded = Math.round(amount * 100) / 100;

  await defaultAccountsService.ensureDefaultAccounts(companyId);
  let payable = await accountHelperService.getAccountByCode('2040', companyId);
  if (!payable?.id) {
    const { accountService } = await import('./accountService');
    const created = await accountService.createAccount({
      company_id: companyId,
      code: '2040',
      name: 'Salesman Payable',
      type: 'Liability',
      is_active: true,
    });
    payable = created ?? (await accountHelperService.getAccountByCode('2040', companyId));
  }
  const payableAccountId = payable?.id as string;
  if (!payableAccountId) throw new Error('Salesman Payable account (2040) not found.');

  let refNo: string;
  try {
    refNo = await documentNumberService.getNextDocumentNumber(companyId, branch, 'payment');
  } catch {
    refNo = `PAY-${Date.now()}`;
  }

  const { data: authData } = await supabase.auth.getUser();
  const uid = authData.user?.id ?? null;

  const noteText = (notes?.trim() || `Commission payment — ${userName}`).slice(0, 2000);

  const { data: paymentRow, error: payErr } = await supabase
    .from('payments')
    .insert({
      company_id: companyId,
      branch_id: branch,
      payment_type: 'paid',
      reference_type: 'commission_payment',
      reference_id: userId,
      amount: rounded,
      payment_method: normalizePaymentMethod(paymentMethod),
      payment_account_id: paymentAccountId,
      payment_date: dateVal,
      reference_number: refNo,
      notes: noteText,
      received_by: uid,
      created_by: uid,
    })
    .select('id')
    .single();

  if (payErr) throw new Error(payErr.message || 'Failed to create payment row.');
  const paymentId = (paymentRow as { id: string }).id;
  logPaymentCreated(companyId, paymentId, { reference_type: 'commission_payment', amount: rounded, userId });

  const entryNo = `JE-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const journalEntry: JournalEntry = {
    company_id: companyId,
    branch_id: branch,
    entry_no: entryNo,
    entry_date: dateVal,
    description: noteText,
    reference_type: 'commission_payment',
    reference_id: userId,
    created_by: uid ?? undefined,
  };
  const lines: JournalEntryLine[] = [
    { account_id: payableAccountId, debit: rounded, credit: 0, description: `Commission payment — ${userName}` },
    { account_id: paymentAccountId, debit: 0, credit: rounded, description: `Commission payment — ${userName}` },
  ];

  const saved = await accountingService.createEntry(journalEntry, lines, paymentId);
  const journalEntryId = String((saved as { id?: string })?.id ?? '');

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ledgerUpdated', { detail: { ledgerType: 'user', entityId: userId } }));
    window.dispatchEvent(new CustomEvent('accountingEntriesChanged'));
  }

  return { paymentId, journalEntryId, referenceNumber: refNo };
}
