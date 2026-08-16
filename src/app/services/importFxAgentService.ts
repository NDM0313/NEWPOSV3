/**
 * Dual-credit Agent FX (Phase 1–2 / Path 21).
 * Credit FC from money-exchange agent → Dr TT wallet / Cr Agent AP (PKR).
 * Agent settle + China supplier settle reuse createSupplierPayment.
 * Server/database enforces accounting_settings.multiCurrencyEnabled (Wave A).
 * UI may still gate for UX; never treat a caller boolean as security.
 */

import { supabase } from '@/lib/supabase';
import { createSupplierPayment } from '@/app/services/supplierPaymentService';
import { foreignToBasePkr, normalizeImportDocCurrency } from '@/app/lib/importFxHelpers';
import {
  fetchCompanyImportFxEnabled,
  formatImportFxServerError,
} from '@/app/lib/importFxServerGate';
import { isPartyTtAgentWalletAccount } from '@/app/lib/liquidityPaymentAccount';
import {
  filterActiveSettlementPaymentRefs,
  formatActiveSettlementBlockMessage,
} from '@/app/lib/importFxCreditVoidHelpers';
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
  /** Wave 0: reuse on network retry; rotate only after confirmed success or new intent. */
  clientOperationId?: string | null;
}

export interface RecordFxCurrencyPurchaseResult {
  fxCurrencyPurchaseId: string;
  journalEntryId: string;
  entryNo: string;
  amountPkr: number;
  dueAmountPkr: number;
  idempotentReplay?: boolean;
}

/** UX pre-check from DB settings; RPC still re-validates. */
async function requireImportFxEnabledFromDb(companyId: string): Promise<void> {
  const enabled = await fetchCompanyImportFxEnabled(companyId);
  if (!enabled) {
    throw new Error(
      formatImportFxServerError('MULTI_CURRENCY_DISABLED: Import FX requires Multi Currency Enabled in Settings')
    );
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

function throwRpcFailure(row: Record<string, unknown>, fallback: string): never {
  throw new Error(formatImportFxServerError(String(row.error || row.code || fallback), fallback));
}

async function resolvePaymentReferenceNumber(
  companyId: string,
  paymentId: string | null | undefined,
  fallback: string
): Promise<string> {
  if (fallback) return fallback;
  const id = String(paymentId || '').trim();
  if (!id) return '';
  const { data } = await supabase
    .from('payments')
    .select('reference_number')
    .eq('company_id', companyId)
    .eq('id', id)
    .maybeSingle();
  return String((data as { reference_number?: string } | null)?.reference_number || '');
}

/** Claim client_operation_id before money write; return replay payload when already completed. */
async function claimImportFxClientOperation(params: {
  companyId: string;
  eventType: 'agent_settle' | 'china_settle';
  clientOperationId: string;
}): Promise<
  | { kind: 'claimed' }
  | {
      kind: 'replay';
      paymentId: string;
      journalEntryId: string;
      referenceNumber: string;
      status: string;
    }
> {
  const { data, error } = await supabase.rpc('claim_import_fx_client_operation', {
    p_company_id: params.companyId,
    p_event_type: params.eventType,
    p_client_operation_id: params.clientOperationId,
  });
  if (error) throw new Error(formatImportFxServerError(error));
  const row = parseRpcJson(data);
  if (row.success === false) {
    throwRpcFailure(row, 'Import FX operation claim failed');
  }
  if (row.idempotent_replay === true) {
    const result = parseRpcJson(row.result);
    const paymentId = String(result.payment_id || row.payment_id || '');
    const referenceNumber = await resolvePaymentReferenceNumber(
      params.companyId,
      paymentId,
      String(result.reference_number || '')
    );
    return {
      kind: 'replay',
      paymentId,
      journalEntryId: String(result.journal_entry_id || row.journal_entry_id || ''),
      referenceNumber,
      status: String(result.status || ''),
    };
  }
  return { kind: 'claimed' };
}

async function finalizeImportFxClientOperation(params: {
  companyId: string;
  eventType: 'agent_settle' | 'china_settle';
  clientOperationId: string;
  resultJson: Record<string, unknown>;
  fxCurrencyPurchaseId?: string | null;
  paymentId?: string | null;
  journalEntryId?: string | null;
  purchaseId?: string | null;
}): Promise<void> {
  const { error } = await supabase.rpc('finalize_import_fx_client_operation', {
    p_company_id: params.companyId,
    p_event_type: params.eventType,
    p_client_operation_id: params.clientOperationId,
    p_result_json: params.resultJson,
    p_fx_currency_purchase_id: params.fxCurrencyPurchaseId ?? null,
    p_payment_id: params.paymentId ?? null,
    p_journal_entry_id: params.journalEntryId ?? null,
    p_purchase_id: params.purchaseId ?? null,
  });
  if (error) {
    console.warn('[importFxAgentService] finalize client operation:', error.message);
  }
}

/** Clear stuck pending claim after a failed money write so the same UUID can retry. */
async function releaseImportFxClientOperation(params: {
  companyId: string;
  eventType: 'agent_settle' | 'china_settle';
  clientOperationId: string;
}): Promise<void> {
  const { error } = await supabase.rpc('release_import_fx_client_operation', {
    p_company_id: params.companyId,
    p_event_type: params.eventType,
    p_client_operation_id: params.clientOperationId,
  });
  if (error) {
    console.warn('[importFxAgentService] release client operation:', error.message);
  }
}

/** Step 1: buy FC from agent on credit — Dr wallet / Cr Agent AP (PKR). */
export async function recordFxCurrencyPurchaseOnCredit(
  params: RecordFxCurrencyPurchaseOnCreditParams
): Promise<RecordFxCurrencyPurchaseResult> {
  await requireImportFxEnabledFromDb(params.companyId);

  const currency = normalizeImportDocCurrency(params.documentCurrency);
  if (currency === 'PKR') {
    throw new Error('document currency must be a foreign currency for FX credit purchase');
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
    p_client_operation_id: params.clientOperationId ?? null,
  });

  if (error) throw new Error(formatImportFxServerError(error));
  const row = parseRpcJson(data);
  if (row.success === false) {
    throwRpcFailure(row, 'FX currency purchase failed');
  }

  return {
    fxCurrencyPurchaseId: String(row.fx_currency_purchase_id),
    journalEntryId: String(row.journal_entry_id),
    entryNo: String(row.entry_no || ''),
    amountPkr: Number(row.amount_pkr) || 0,
    dueAmountPkr: Number(row.due_amount_pkr) || 0,
    idempotentReplay: row.idempotent_replay === true,
  };
}

export async function listOpenFxCurrencyPurchases(companyId: string): Promise<FxCurrencyPurchase[]> {
  await requireImportFxEnabledFromDb(companyId);
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
  opts?: { statusIn?: FxCurrencyPurchaseStatus[] }
): Promise<FxCurrencyPurchase[]> {
  await requireImportFxEnabledFromDb(companyId);
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
export async function settleFxCurrencyPurchaseWithAgent(params: {
  companyId: string;
  branchId: string | null;
  fxCurrencyPurchaseId: string;
  amountPkr: number;
  paymentAccountId: string;
  paymentMethod?: string;
  paymentDate?: string;
  notes?: string | null;
  attachments?: { url: string; name: string }[] | null;
  clientOperationId?: string | null;
}): Promise<{
  paymentId: string;
  journalEntryId: string;
  referenceNumber: string;
  status: string;
  idempotentReplay?: boolean;
}> {
  await requireImportFxEnabledFromDb(params.companyId);

  let claimed = false;
  let paymentCreated = false;

  try {
    if (params.clientOperationId) {
      const claim = await claimImportFxClientOperation({
        companyId: params.companyId,
        eventType: 'agent_settle',
        clientOperationId: params.clientOperationId,
      });
      if (claim.kind === 'replay') {
        return {
          paymentId: claim.paymentId,
          journalEntryId: claim.journalEntryId,
          referenceNumber: claim.referenceNumber,
          status: claim.status,
          idempotentReplay: true,
        };
      }
      claimed = true;
    }

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
      attachments: params.attachments ?? null,
    });
    paymentCreated = true;

    const { data: applyData, error: applyErr } = await supabase.rpc('apply_fx_currency_purchase_settlement', {
      p_company_id: params.companyId,
      p_fx_currency_purchase_id: params.fxCurrencyPurchaseId,
      p_payment_id: pay.paymentId,
      p_amount_pkr: params.amountPkr,
      p_client_operation_id: params.clientOperationId ?? null,
    });
    if (applyErr) {
      if (params.clientOperationId) {
        await finalizeImportFxClientOperation({
          companyId: params.companyId,
          eventType: 'agent_settle',
          clientOperationId: params.clientOperationId,
          fxCurrencyPurchaseId: params.fxCurrencyPurchaseId,
          paymentId: pay.paymentId,
          journalEntryId: pay.journalEntryId,
          resultJson: {
            success: true,
            pending: false,
            payment_id: pay.paymentId,
            journal_entry_id: pay.journalEntryId,
            reference_number: pay.referenceNumber,
            status: '',
            apply_error: applyErr.message,
          },
        });
      }
      throw new Error(formatImportFxServerError(applyErr));
    }
    const applied = parseRpcJson(applyData);
    if (applied.success === false) {
      if (params.clientOperationId) {
        await finalizeImportFxClientOperation({
          companyId: params.companyId,
          eventType: 'agent_settle',
          clientOperationId: params.clientOperationId,
          fxCurrencyPurchaseId: params.fxCurrencyPurchaseId,
          paymentId: pay.paymentId,
          journalEntryId: pay.journalEntryId,
          resultJson: {
            success: true,
            pending: false,
            payment_id: pay.paymentId,
            journal_entry_id: pay.journalEntryId,
            reference_number: pay.referenceNumber,
            status: String(applied.status || ''),
            apply_error: String(applied.error || applied.code || 'apply failed'),
          },
        });
      }
      throwRpcFailure(applied, 'Failed to apply FX settlement allocation');
    }

    if (params.clientOperationId) {
      await finalizeImportFxClientOperation({
        companyId: params.companyId,
        eventType: 'agent_settle',
        clientOperationId: params.clientOperationId,
        fxCurrencyPurchaseId: params.fxCurrencyPurchaseId,
        paymentId: pay.paymentId,
        journalEntryId: pay.journalEntryId,
        resultJson: {
          success: true,
          pending: false,
          payment_id: pay.paymentId,
          journal_entry_id: pay.journalEntryId,
          reference_number: pay.referenceNumber,
          status: String(applied.status || ''),
          paid_amount_pkr: applied.paid_amount_pkr,
          due_amount_pkr: applied.due_amount_pkr,
        },
      });
    }

    return {
      paymentId: pay.paymentId,
      journalEntryId: pay.journalEntryId,
      referenceNumber: pay.referenceNumber,
      status: String(applied.status || ''),
      idempotentReplay: applied.idempotent_replay === true,
    };
  } catch (err) {
    if (claimed && !paymentCreated && params.clientOperationId) {
      await releaseImportFxClientOperation({
        companyId: params.companyId,
        eventType: 'agent_settle',
        clientOperationId: params.clientOperationId,
      });
    }
    throw err;
  }
}

/**
 * Step 3: settle China supplier purchase from funded TT wallet (PKR equiv).
 * Reuses createSupplierPayment linked to purchase → Dr China AP / Cr wallet.
 */
export async function settleChinaPurchaseFromWallet(params: {
  companyId: string;
  branchId: string | null;
  purchaseId: string;
  amountPkr: number;
  walletAccountId: string;
  paymentMethod?: string;
  paymentDate?: string;
  notes?: string | null;
  attachments?: { url: string; name: string }[] | null;
  /** When set, block if purchase.supplier_id equals this agent (Path 21 distinct-party). */
  agentContactId?: string | null;
  clientOperationId?: string | null;
}): Promise<{
  paymentId: string;
  journalEntryId: string;
  referenceNumber: string;
  idempotentReplay?: boolean;
}> {
  await requireImportFxEnabledFromDb(params.companyId);

  let claimed = false;
  let paymentCreated = false;

  try {
    if (params.clientOperationId) {
      const claim = await claimImportFxClientOperation({
        companyId: params.companyId,
        eventType: 'china_settle',
        clientOperationId: params.clientOperationId,
      });
      if (claim.kind === 'replay') {
        return {
          paymentId: claim.paymentId,
          journalEntryId: claim.journalEntryId,
          referenceNumber: claim.referenceNumber,
          idempotentReplay: true,
        };
      }
      claimed = true;
    }

    const { data: purchase, error: purErr } = await supabase
      .from('purchases')
      .select('id, supplier_id')
      .eq('id', params.purchaseId)
      .eq('company_id', params.companyId)
      .maybeSingle();
    if (purErr) throw purErr;
    if (!purchase) throw new Error('Purchase not found');

    const supplierId = purchase.supplier_id != null ? String(purchase.supplier_id) : '';
    if (params.agentContactId && supplierId && params.agentContactId === supplierId) {
      throw new Error(
        'The money-exchange agent cannot be the same party as the purchase supplier.'
      );
    }

    const accounts = await accountService.getAllAccounts(params.companyId);
    const wallet = (accounts || []).find((a: { id?: string }) => a.id === params.walletAccountId) as
      | { id: string; code?: string; name?: string }
      | undefined;
    if (!wallet || !isPartyTtAgentWalletAccount(wallet)) {
      throw new Error('Payment account must be a TT-agent 12xx wallet');
    }

    const pay = await createSupplierPayment({
      companyId: params.companyId,
      branchId: params.branchId,
      amount: params.amountPkr,
      paymentMethod: params.paymentMethod || 'bank_transfer',
      paymentAccountId: params.walletAccountId,
      purchaseId: params.purchaseId,
      paymentDate: params.paymentDate,
      notes: params.notes ?? 'Supplier settle from FC wallet (PKR)',
      attachments: params.attachments ?? null,
    });
    paymentCreated = true;

    if (params.clientOperationId) {
      await finalizeImportFxClientOperation({
        companyId: params.companyId,
        eventType: 'china_settle',
        clientOperationId: params.clientOperationId,
        paymentId: pay.paymentId,
        journalEntryId: pay.journalEntryId,
        purchaseId: params.purchaseId,
        resultJson: {
          success: true,
          pending: false,
          payment_id: pay.paymentId,
          journal_entry_id: pay.journalEntryId,
          reference_number: pay.referenceNumber,
        },
      });
    }

    return {
      paymentId: pay.paymentId,
      journalEntryId: pay.journalEntryId,
      referenceNumber: pay.referenceNumber,
    };
  } catch (err) {
    if (claimed && !paymentCreated && params.clientOperationId) {
      await releaseImportFxClientOperation({
        companyId: params.companyId,
        eventType: 'china_settle',
        clientOperationId: params.clientOperationId,
      });
    }
    throw err;
  }
}

/** Money-exchange agents only (Path 21). Supplier-only contacts are not eligible. */
export function isEligibleMoneyExchangeAgentContact(c: {
  type?: string;
  is_active?: boolean;
}): boolean {
  if (c.is_active === false) return false;
  return String(c.type || '').toLowerCase().trim() === 'money_exchange';
}

export async function listMoneyExchangeAgents(companyId: string): Promise<
  { id: string; name: string; type: string; code?: string | null; phone?: string | null }[]
> {
  const all = await contactService.getAllContacts(companyId);
  return (all || [])
    .filter((c: { type?: string; is_active?: boolean }) => isEligibleMoneyExchangeAgentContact(c))
    .map((c: { id?: string; name?: string; type?: string; code?: string | null; phone?: string | null }) => ({
      id: String(c.id),
      name: String(c.name || ''),
      type: String(c.type || ''),
      code: c.code ?? null,
      phone: (c as { phone?: string | null }).phone ?? null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
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

/**
 * Path 21 cancel: void FX credit JE (+ any active correction_reversal) and mark fx_currency_purchases void.
 * Does not unwind China/agent payments — void those first (clear error if active settlement payments remain).
 */
export async function voidFxCurrencyPurchaseCredit(params: {
  companyId: string;
  fxCurrencyPurchaseId: string;
  reason?: string | null;
}): Promise<{ fxCurrencyPurchaseId: string; voidedJournalEntryIds: string[] }> {
  await requireImportFxEnabledFromDb(params.companyId);

  const { data: credit, error: creditErr } = await supabase
    .from('fx_currency_purchases')
    .select('id, company_id, status, journal_entry_id, notes')
    .eq('id', params.fxCurrencyPurchaseId)
    .eq('company_id', params.companyId)
    .maybeSingle();
  if (creditErr) throw creditErr;
  if (!credit) throw new Error('FX currency purchase not found');

  if (String(credit.status || '') === 'void') {
    return { fxCurrencyPurchaseId: String(credit.id), voidedJournalEntryIds: [] };
  }

  const { data: settleRows, error: settleErr } = await supabase
    .from('fx_currency_purchase_settlements')
    .select('id, payment_id')
    .eq('company_id', params.companyId)
    .eq('fx_currency_purchase_id', params.fxCurrencyPurchaseId);
  if (settleErr) throw settleErr;

  const paymentIds = (settleRows || [])
    .map((r: { payment_id?: string | null }) => (r.payment_id ? String(r.payment_id) : ''))
    .filter(Boolean);

  if (paymentIds.length > 0) {
    const { data: pays, error: payErr } = await supabase
      .from('payments')
      .select('id, reference_number, voided_at')
      .eq('company_id', params.companyId)
      .in('id', paymentIds);
    if (payErr) throw payErr;
    const activeRefs = filterActiveSettlementPaymentRefs(
      (pays || []) as Array<{ reference_number?: string | null; voided_at?: string | null }>
    );
    if (activeRefs.length > 0) {
      throw new Error(formatActiveSettlementBlockMessage(activeRefs));
    }
  }

  const reason =
    (params.reason || '').trim() ||
    'Path 21: FX currency purchase credit voided';

  const voidedIds = await voidFxCreditJournalPair({
    companyId: params.companyId,
    originalJournalEntryId: credit.journal_entry_id ? String(credit.journal_entry_id) : null,
    reason,
  });

  const { getCurrentLocalTimestamp } = await import('@/app/utils/localDate');
  const { error: updErr } = await supabase
    .from('fx_currency_purchases')
    .update({
      status: 'void',
      paid_amount_pkr: 0,
      due_amount_pkr: 0,
      updated_at: getCurrentLocalTimestamp(),
      notes: `${String(credit.notes || '')} | VOIDED: ${reason}`.trim(),
    })
    .eq('id', params.fxCurrencyPurchaseId)
    .eq('company_id', params.companyId);
  if (updErr) throw updErr;

  // Soft-inactivate settlement links (retain rows for audit); recompute is no-op on void credit
  await supabase.rpc('mark_fx_currency_purchase_settlements_inactive', {
    p_company_id: params.companyId,
    p_fx_currency_purchase_id: params.fxCurrencyPurchaseId,
    p_payment_id: null,
    p_reason: reason,
    p_void_source: 'credit_void',
  });

  return { fxCurrencyPurchaseId: String(credit.id), voidedJournalEntryIds: voidedIds };
}

/**
 * After journal Reverse of an fx_currency_purchase JE: void original + reversal and mark FX credit void
 * so ledger/dashboard no longer show the (+1) pair.
 */
export async function finalizeFxCurrencyPurchaseCreditAfterReversal(params: {
  companyId: string;
  originalJournalEntryId: string;
  reversalJournalEntryId?: string | null;
  reason?: string | null;
}): Promise<void> {
  const reason =
    (params.reason || '').trim() ||
    'Path 21: FX credit journal reversed — credit voided';

  const { data: credit } = await supabase
    .from('fx_currency_purchases')
    .select('id, status')
    .eq('company_id', params.companyId)
    .eq('journal_entry_id', params.originalJournalEntryId)
    .maybeSingle();

  if (credit?.id && String(credit.status || '') !== 'void') {
    // Prefer full helper (settlement guard); if settlements still active, still void JE pair
    // so reverse UI does not leave a visible (+1) ghost — but surface settlement error.
    try {
      await voidFxCurrencyPurchaseCredit({
        companyId: params.companyId,
        fxCurrencyPurchaseId: String(credit.id),
        reason,
      });
      return;
    } catch (e: any) {
      const msg = String(e?.message || e || '');
      if (!msg.includes('settlement payment')) throw e;
      await voidFxCreditJournalPair({
        companyId: params.companyId,
        originalJournalEntryId: params.originalJournalEntryId,
        extraJournalEntryId: params.reversalJournalEntryId || null,
        reason: `${reason} (JE voided; FX row blocked: active settlements)`,
      });
      throw e;
    }
  }

  await voidFxCreditJournalPair({
    companyId: params.companyId,
    originalJournalEntryId: params.originalJournalEntryId,
    extraJournalEntryId: params.reversalJournalEntryId || null,
    reason,
  });
}

async function voidFxCreditJournalPair(params: {
  companyId: string;
  originalJournalEntryId: string | null;
  extraJournalEntryId?: string | null;
  reason: string;
}): Promise<string[]> {
  const { getCurrentLocalTimestamp } = await import('@/app/utils/localDate');
  const now = getCurrentLocalTimestamp();
  const ids = new Set<string>();
  if (params.originalJournalEntryId) ids.add(params.originalJournalEntryId);
  if (params.extraJournalEntryId) ids.add(params.extraJournalEntryId);

  if (params.originalJournalEntryId) {
    const { data: revs } = await supabase
      .from('journal_entries')
      .select('id')
      .eq('company_id', params.companyId)
      .eq('reference_type', 'correction_reversal')
      .eq('reference_id', params.originalJournalEntryId)
      .eq('is_void', false);
    for (const r of revs || []) {
      if (r?.id) ids.add(String(r.id));
    }
  }

  const idList = [...ids];
  if (idList.length === 0) return [];

  const { error } = await supabase
    .from('journal_entries')
    .update({
      is_void: true,
      void_reason: params.reason,
      voided_at: now,
    })
    .eq('company_id', params.companyId)
    .in('id', idList)
    .eq('is_void', false);
  if (error) throw error;
  return idList;
}
