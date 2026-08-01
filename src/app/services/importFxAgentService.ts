/**
 * Dual-credit Agent FX (Phase 1–2).
 * Credit FC from money-exchange agent → Dr TT wallet / Cr Agent AP (PKR).
 * Agent settle + China supplier settle reuse createSupplierPayment.
 * Callers MUST gate on accountingSettings.multiCurrencyEnabled === true.
 */

import { supabase } from '@/lib/supabase';
import { createSupplierPayment } from '@/app/services/supplierPaymentService';
import { foreignToBasePkr, normalizeImportDocCurrency } from '@/app/lib/importFxHelpers';
import { isPartyTtAgentWalletAccount } from '@/app/lib/liquidityPaymentAccount';
import { accountService } from '@/app/services/accountService';
import { contactService } from '@/app/services/contactService';

export type FxCurrencyPurchaseStatus = 'open' | 'partial' | 'paid' | 'void';

export interface FxCurrencyPurchase {
  id: string;
  company_id: string;
  branch_id: string | null;
  agent_contact_id: string;
  wallet_account_id: string;
  document_currency: string;
  foreign_amount: number;
  fx_rate_to_base: number;
  amount_pkr: number;
  paid_amount_pkr: number;
  due_amount_pkr: number;
  status: FxCurrencyPurchaseStatus;
  journal_entry_id: string | null;
  linked_purchase_id: string | null;
  document_no: string | null;
  notes: string | null;
  created_at?: string;
}

export interface RecordFxCurrencyPurchaseOnCreditParams {
  companyId: string;
  branchId: string | null;
  agentContactId: string;
  walletAccountId: string;
  documentCurrency: string;
  foreignAmount: number;
  fxRateToBase: number;
  notes?: string | null;
  linkedPurchaseId?: string | null;
}

export interface RecordFxCurrencyPurchaseResult {
  fxCurrencyPurchaseId: string;
  journalEntryId: string;
  entryNo: string;
  amountPkr: number;
  dueAmountPkr: number;
}

function assertMultiCurrencyEnabled(enabled: boolean | undefined | null): void {
  if (enabled !== true) {
    throw new Error('Import FX agent workflow requires Multi Currency Enabled in Settings');
  }
}

function parseRpcJson(data: unknown): Record<string, unknown> {
  if (data == null) return {};
  if (typeof data === 'string') {
    try {
      return JSON.parse(data) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  if (typeof data === 'object') return data as Record<string, unknown>;
  return {};
}

/** Step 1: buy FC from agent on credit — Dr wallet / Cr Agent AP (PKR). */
export async function recordFxCurrencyPurchaseOnCredit(
  params: RecordFxCurrencyPurchaseOnCreditParams,
  multiCurrencyEnabled: boolean
): Promise<RecordFxCurrencyPurchaseResult> {
  assertMultiCurrencyEnabled(multiCurrencyEnabled);

  const currency = normalizeImportDocCurrency(params.documentCurrency);
  if (currency === 'PKR') {
    throw new Error('document currency must be CNY or USD for FX credit purchase');
  }

  const { data: auth } = await supabase.auth.getUser();
  const { data, error } = await supabase.rpc('record_fx_currency_purchase_on_credit', {
    p_company_id: params.companyId,
    p_branch_id: params.branchId && params.branchId !== 'all' ? params.branchId : null,
    p_agent_contact_id: params.agentContactId,
    p_wallet_account_id: params.walletAccountId,
    p_document_currency: currency,
    p_foreign_amount: params.foreignAmount,
    p_fx_rate_to_base: params.fxRateToBase,
    p_notes: params.notes ?? null,
    p_created_by: auth.user?.id ?? null,
    p_linked_purchase_id: params.linkedPurchaseId ?? null,
  });

  if (error) throw error;
  const row = parseRpcJson(data);
  if (row.success === false) {
    throw new Error(String(row.error || 'FX currency purchase failed'));
  }

  return {
    fxCurrencyPurchaseId: String(row.fx_currency_purchase_id),
    journalEntryId: String(row.journal_entry_id),
    entryNo: String(row.entry_no || ''),
    amountPkr: Number(row.amount_pkr) || 0,
    dueAmountPkr: Number(row.due_amount_pkr) || 0,
  };
}

export async function listOpenFxCurrencyPurchases(
  companyId: string,
  multiCurrencyEnabled: boolean
): Promise<FxCurrencyPurchase[]> {
  assertMultiCurrencyEnabled(multiCurrencyEnabled);
  const { data, error } = await supabase
    .from('fx_currency_purchases')
    .select('*')
    .eq('company_id', companyId)
    .in('status', ['open', 'partial'])
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as FxCurrencyPurchase[];
}

export async function listFxCurrencyPurchases(
  companyId: string,
  multiCurrencyEnabled: boolean,
  opts?: { statusIn?: FxCurrencyPurchaseStatus[] }
): Promise<FxCurrencyPurchase[]> {
  assertMultiCurrencyEnabled(multiCurrencyEnabled);
  let q = supabase
    .from('fx_currency_purchases')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (opts?.statusIn?.length) {
    q = q.in('status', opts.statusIn);
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data || []) as FxCurrencyPurchase[];
}

/**
 * Step 2: pay agent in PKR from bank (on_account) then allocate to fx_currency_purchases.
 * Posts Dr Agent AP / Cr Bank via existing createSupplierPayment.
 */
export async function settleFxCurrencyPurchaseWithAgent(
  params: {
    companyId: string;
    branchId: string | null;
    fxCurrencyPurchaseId: string;
    amountPkr: number;
    paymentAccountId: string;
    paymentMethod?: string;
    paymentDate?: string;
    notes?: string | null;
  },
  multiCurrencyEnabled: boolean
): Promise<{ paymentId: string; journalEntryId: string; referenceNumber: string; status: string }> {
  assertMultiCurrencyEnabled(multiCurrencyEnabled);

  const { data: credit, error: creditErr } = await supabase
    .from('fx_currency_purchases')
    .select('id, agent_contact_id, due_amount_pkr, status')
    .eq('id', params.fxCurrencyPurchaseId)
    .eq('company_id', params.companyId)
    .maybeSingle();
  if (creditErr) throw creditErr;
  if (!credit) throw new Error('FX currency purchase not found');
  if (credit.status === 'void' || credit.status === 'paid') {
    throw new Error(`Cannot settle FX credit in status ${credit.status}`);
  }
  const due = Number(credit.due_amount_pkr) || 0;
  if (!(params.amountPkr > 0) || params.amountPkr > due + 0.009) {
    throw new Error(`Settlement amount must be between 0 and due (${due})`);
  }

  const pay = await createSupplierPayment({
    companyId: params.companyId,
    branchId: params.branchId,
    amount: params.amountPkr,
    paymentMethod: params.paymentMethod || 'bank_transfer',
    paymentAccountId: params.paymentAccountId,
    contactId: String(credit.agent_contact_id),
    paymentDate: params.paymentDate,
    notes: params.notes ?? 'Agent FX credit settlement (PKR)',
  });

  const { data: applyData, error: applyErr } = await supabase.rpc('apply_fx_currency_purchase_settlement', {
    p_company_id: params.companyId,
    p_fx_currency_purchase_id: params.fxCurrencyPurchaseId,
    p_payment_id: pay.paymentId,
    p_amount_pkr: params.amountPkr,
  });
  if (applyErr) throw applyErr;
  const applied = parseRpcJson(applyData);
  if (applied.success === false) {
    throw new Error(String(applied.error || 'Failed to apply FX settlement allocation'));
  }

  return {
    paymentId: pay.paymentId,
    journalEntryId: pay.journalEntryId,
    referenceNumber: pay.referenceNumber,
    status: String(applied.status || ''),
  };
}

/**
 * Step 3: settle China supplier purchase from funded TT wallet (PKR equiv).
 * Reuses createSupplierPayment linked to purchase → Dr China AP / Cr wallet.
 */
export async function settleChinaPurchaseFromWallet(
  params: {
    companyId: string;
    branchId: string | null;
    purchaseId: string;
    amountPkr: number;
    walletAccountId: string;
    paymentMethod?: string;
    paymentDate?: string;
    notes?: string | null;
  },
  multiCurrencyEnabled: boolean
): Promise<{ paymentId: string; journalEntryId: string; referenceNumber: string }> {
  assertMultiCurrencyEnabled(multiCurrencyEnabled);

  const accounts = await accountService.getAllAccounts(params.companyId);
  const wallet = (accounts || []).find((a: { id?: string }) => a.id === params.walletAccountId) as
    | { id: string; code?: string; name?: string }
    | undefined;
  if (!wallet || !isPartyTtAgentWalletAccount(wallet)) {
    throw new Error('Payment account must be a TT-agent 12xx wallet');
  }

  return createSupplierPayment({
    companyId: params.companyId,
    branchId: params.branchId,
    amount: params.amountPkr,
    paymentMethod: params.paymentMethod || 'bank_transfer',
    paymentAccountId: params.walletAccountId,
    purchaseId: params.purchaseId,
    paymentDate: params.paymentDate,
    notes: params.notes ?? 'Supplier settle from FC wallet (PKR)',
  });
}

/** Money-exchange agents (+ supplier/both for legacy agents). */
export async function listMoneyExchangeAgents(companyId: string): Promise<
  { id: string; name: string; type: string; code?: string | null }[]
> {
  const all = await contactService.getAllContacts(companyId);
  return (all || [])
    .filter((c: { type?: string; is_active?: boolean }) => {
      if (c.is_active === false) return false;
      const t = String(c.type || '').toLowerCase();
      return t === 'money_exchange' || t === 'supplier' || t === 'both';
    })
    .map((c: { id?: string; name?: string; type?: string; code?: string | null }) => ({
      id: String(c.id),
      name: String(c.name || ''),
      type: String(c.type || ''),
      code: c.code ?? null,
    }))
    .sort((a, b) => {
      const aMe = a.type === 'money_exchange' ? 0 : 1;
      const bMe = b.type === 'money_exchange' ? 0 : 1;
      if (aMe !== bMe) return aMe - bMe;
      return a.name.localeCompare(b.name);
    });
}

export async function listTtAgentWallets(
  companyId: string
): Promise<{ id: string; code: string; name: string }[]> {
  const accounts = await accountService.getAllAccounts(companyId);
  return (accounts || [])
    .filter(
      (a: { is_active?: boolean; code?: string; name?: string }) =>
        a.is_active !== false && isPartyTtAgentWalletAccount(a)
    )
    .map((a: { id: string; code?: string; name?: string }) => ({
      id: a.id,
      code: String(a.code || ''),
      name: String(a.name || ''),
    }));
}

export function computePkrFromForeign(foreignAmount: number, rateToBase: number): number {
  return foreignToBasePkr(foreignAmount, rateToBase);
}
