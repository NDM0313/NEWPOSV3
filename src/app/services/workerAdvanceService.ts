/**
 * Worker Advance (1180) vs Worker Payable (2010).
 * - Payments before any stage bill: Dr Worker Advance, Cr Cash/Bank (reference_type worker_payment).
 * - After stage completion bills Worker Payable (Dr 5000 Cr 2010), we auto-apply advance: Dr 2010 Cr 1180.
 * Settlement JEs use reference_type worker_advance_settlement, reference_id = workerId (same as payments for balance roll-up).
 */

import { supabase } from '@/lib/supabase';
import { accountHelperService } from '@/app/services/accountHelperService';
import { accountingService, type JournalEntry, type JournalEntryLine } from '@/app/services/accountingService';

const EPS = 0.005;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function safeBranchForRpc(branchId: string | null | undefined): string | null {
  if (!branchId || branchId === 'all') return null;
  const t = String(branchId).trim();
  return UUID_RE.test(t) ? t : null;
}

function isLedgerUnpaid(status: unknown): boolean {
  return String(status ?? '').toLowerCase() !== 'paid';
}

/** Same worker column as Reconciliation tab: GREATEST(0, 2010 net − 1180 net) from get_contact_party_gl_balances. */
async function getWorkerGlNetPayableForParty(
  companyId: string,
  workerId: string,
  branchId?: string | null
): Promise<number> {
  const { data, error } = await supabase.rpc('get_contact_party_gl_balances', {
    p_company_id: companyId,
    p_branch_id: safeBranchForRpc(branchId),
  });
  if (error || !Array.isArray(data)) return 0;
  const row = (data as { contact_id: string; gl_worker_payable?: number | string }[]).find(
    (r) => String(r.contact_id) === String(workerId)
  );
  return Number(row?.gl_worker_payable ?? 0) || 0;
}

export async function getWorkerAdvanceAccountId(companyId: string): Promise<string | null> {
  const byCode = await accountHelperService.getAccountByCode('1180', companyId);
  if (byCode?.id) return byCode.id;
  const { data } = await supabase
    .from('accounts')
    .select('id')
    .eq('company_id', companyId)
    .or('code.eq.1180,name.ilike.%Worker Advance%')
    .limit(1);
  return (data?.[0] as { id: string } | undefined)?.id ?? null;
}

/**
 * True when worker has an unpaid studio stage bill (worker_ledger job row) — pay down payable.
 * If stageId set (Pay Now), only that stage's bill counts.
 * Fallbacks (operational ≠ GL): missing job row but active stage-bill JE, or no unpaid jobs but GL shows net worker payable.
 */
export async function shouldDebitWorkerPayableForPayment(
  companyId: string,
  workerId: string,
  stageId?: string | null,
  branchId?: string | null
): Promise<boolean> {
  if (stageId) {
    const { data: row } = await supabase
      .from('worker_ledger_entries')
      .select('id, status')
      .eq('company_id', companyId)
      .eq('worker_id', workerId)
      .eq('reference_type', 'studio_production_stage')
      .eq('reference_id', stageId)
      .maybeSingle();
    if (row) return isLedgerUnpaid((row as { status?: string }).status);
    const { data: je } = await supabase
      .from('journal_entries')
      .select('id')
      .eq('company_id', companyId)
      .eq('reference_type', 'studio_production_stage')
      .eq('reference_id', stageId)
      .or('is_void.is.null,is_void.eq.false')
      .maybeSingle();
    return Boolean(je);
  }
  const { data: rows } = await supabase
    .from('worker_ledger_entries')
    .select('id, status')
    .eq('company_id', companyId)
    .eq('worker_id', workerId)
    .eq('reference_type', 'studio_production_stage')
    .limit(200);
  if ((rows || []).some((r) => isLedgerUnpaid((r as { status?: string }).status))) return true;
  const glNet = await getWorkerGlNetPayableForParty(companyId, workerId, branchId);
  return glNet > EPS;
}

/**
 * Net worker advance from GL lines on 1180 for this worker's payment + settlement entries.
 */
export async function getWorkerNetAdvanceBalanceFromJournals(companyId: string, workerId: string): Promise<number> {
  const advanceId = await getWorkerAdvanceAccountId(companyId);
  if (!advanceId) return 0;

  const { data: jes, error } = await supabase
    .from('journal_entries')
    .select('id')
    .eq('company_id', companyId)
    .eq('reference_id', workerId)
    .in('reference_type', ['worker_payment', 'worker_advance_settlement'])
    .or('is_void.is.null,is_void.eq.false');

  if (error || !jes?.length) return 0;

  const ids = jes.map((j) => j.id);
  const chunkSize = 80;
  let sum = 0;
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const { data: lines } = await supabase
      .from('journal_entry_lines')
      .select('debit, credit')
      .eq('account_id', advanceId)
      .in('journal_entry_id', chunk);
    for (const l of lines || []) {
      sum += (Number((l as { debit?: number }).debit) || 0) - (Number((l as { credit?: number }).credit) || 0);
    }
  }
  return Math.round(sum * 100) / 100;
}

/**
 * After Dr 5000 Cr 2010 for a stage, apply prepaid advance up to bill amount (Dr 2010 Cr 1180).
 * Idempotent per (stageId, bill journal id).
 */
export async function applyWorkerAdvanceAgainstNewBill(params: {
  companyId: string;
  branchId: string | null;
  workerId: string;
  stageId: string;
  billAmount: number;
  billJournalEntryId: string;
  productionNo?: string;
  stageType?: string;
  performedBy?: string | null;
}): Promise<string | null> {
  const {
    companyId,
    branchId,
    workerId,
    stageId,
    billAmount,
    billJournalEntryId,
    productionNo,
    stageType,
    performedBy,
  } = params;

  if (billAmount <= EPS || !billJournalEntryId) return null;

  const balance = await getWorkerNetAdvanceBalanceFromJournals(companyId, workerId);
  const applyAmount = Math.min(Math.max(balance, 0), billAmount);
  if (applyAmount <= EPS) return null;

  const advanceId = await getWorkerAdvanceAccountId(companyId);
  const payableAcc = await accountHelperService.getAccountByCode('2010', companyId);
  if (!advanceId || !payableAcc?.id) {
    console.warn('[workerAdvanceService] Missing Worker Advance (1180) or Worker Payable (2010); skip auto-apply');
    return null;
  }

  const entryNo = `JE-WADV-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  const entryDate = new Date().toISOString().split('T')[0];
  const fp = `worker_advance_apply:${stageId}:${billJournalEntryId}`;

  const entry: JournalEntry = {
    id: '',
    company_id: companyId,
    branch_id: branchId || undefined,
    entry_no: entryNo,
    entry_date: entryDate,
    description: `Apply worker advance to production bill${productionNo ? ` – ${productionNo}` : ''}${stageType ? ` (${stageType})` : ''}`,
    reference_type: 'worker_advance_settlement',
    reference_id: workerId,
    created_by: performedBy || undefined,
    action_fingerprint: fp,
  };

  const lines: JournalEntryLine[] = [
    {
      id: '',
      journal_entry_id: '',
      account_id: payableAcc.id,
      debit: applyAmount,
      credit: 0,
      description: 'Reduce worker payable (advance applied)',
    },
    {
      id: '',
      journal_entry_id: '',
      account_id: advanceId,
      debit: 0,
      credit: applyAmount,
      description: 'Clear worker advance against bill',
    },
  ];

  const result = await accountingService.createEntry(entry, lines);
  return (result as { id?: string })?.id ?? null;
}
