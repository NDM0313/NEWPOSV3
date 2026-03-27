/**
 * Party Balance Tie-Out — single structured repair/diagnostic pass.
 * Does not merge operational + GL into one balance; every figure is explicitly labeled.
 */

import { supabase } from '@/lib/supabase';
import { contactService } from '@/app/services/contactService';
import { accountService } from '@/app/services/accountService';

export type PartyKind = 'customer' | 'supplier' | 'worker';

/** Worker JE classification aligned with accounting lifecycle (PHASE 3 / repair). */
export type WorkerJournalLifecycleBucket =
  | 'pre_bill_advance'
  | 'bill_posting'
  | 'advance_settlement'
  | 'post_bill_payment'
  | 'unknown_or_broken_pattern';

export type PartyAmountLabel = 'operational' | 'gl' | 'control-account' | 'residual' | 'pending-mapping';

export interface LabeledAmount {
  value: number | null;
  label: PartyAmountLabel;
  /** Human-readable source */
  source: string;
  note?: string;
}

export interface TieOutMismatchCause {
  code: string;
  severity: 'info' | 'warn' | 'error';
  message: string;
  /** Payments / JE ids / sale ids when applicable */
  relatedIds?: string[];
}

export interface LinkedPaymentRow {
  id: string;
  amount: number;
  payment_date: string | null;
  reference_type: string | null;
  reference_id: string | null;
  contact_id: string | null;
  reference_number: string | null;
  /** operational | gl | pending-mapping */
  tieToParty: PartyAmountLabel;
  note?: string;
}

export interface LinkedJournalRow {
  journal_entry_id: string;
  entry_no: string | null;
  entry_date: string;
  reference_type: string | null;
  reference_id: string | null;
  payment_id: string | null;
  workerLifecycleBucket?: WorkerJournalLifecycleBucket;
  workerRuleOk?: boolean;
  workerRuleDetail?: string;
}

export interface PartyBalanceTieOutInput {
  companyId: string;
  partyType: PartyKind;
  partyId: string;
  branchId?: string | null;
  asOfDate?: string;
}

export interface PartyBalanceTieOutResult {
  party: {
    type: PartyKind;
    id: string;
    name: string | null;
    contactType: string | null;
    branchScope: string | null;
    asOfDate: string;
  };
  /** A — operational primary (Contacts / RPC subledger) */
  operational: {
    primaryReceivableOrPayable: LabeledAmount;
    /** Customer: opening + sale/rental hints; supplier: purchase hints; worker: ledger */
    components: LabeledAmount[];
  };
  /** B/C — GL from extended line resolution vs RPC party slice */
  gl: {
    /** Direct sum on control account lines attributed to party (extended resolver) */
    extendedOnControlAccount: LabeledAmount;
    /** Same slice from get_contact_party_gl_balances for AR/AP/worker net */
    rpcPartySlice: LabeledAmount;
    /** extended − rpc (highlights resolver gaps e.g. RPC missing stage→worker on older builds) */
    extendedMinusRpcPartySlice: LabeledAmount;
  };
  /** Worker-only: separate 2010 / 1180 / net */
  workerGl?: {
    gl2010NetLiability: LabeledAmount;
    gl1180NetAsset: LabeledAmount;
    workerNetFromWpWa: LabeledAmount;
    rpcWorkerNet: LabeledAmount;
  };
  /** E — variances (none mixed) */
  variances: {
    operationalMinusRpcPartySlice: number | null;
    notes: string[];
  };
  /** F/G/H */
  linked: {
    sales?: { id: string; invoice_no: string | null; due_amount: number; total: number; status: string | null }[];
    purchases?: { id: string; po_no: string | null; due_amount: number; total: number; status: string | null }[];
    rentals?: { id: string; booking_no: string | null; due_amount: number }[];
    payments: LinkedPaymentRow[];
    journalEntries: LinkedJournalRow[];
  };
  /** I */
  residual: {
    unmappedPartyOnControl: LabeledAmount;
    notes: string[];
  };
  /** J + PHASE 5 flags */
  diagnostics: {
    mismatchCauses: TieOutMismatchCause[];
    /** False when DB uses get_contact_party_gl_balances parity migration (studio stage → worker, etc.). */
    rpcOmitsStudioStagePartyMapping: boolean;
    notes: string[];
  };
}

const EPS = 0.01;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function safeBranch(branchId: string | null | undefined): string | null {
  if (!branchId || branchId === 'all') return null;
  const u = String(branchId).trim();
  return /^[0-9a-f-]{36}$/i.test(u) ? u : null;
}

type JeMini = {
  id: string;
  entry_no?: string | null;
  entry_date: string;
  reference_type?: string | null;
  reference_id?: string | null;
  payment_id?: string | null;
  is_void?: boolean | null;
  branch_id?: string | null;
  company_id?: string;
};

async function loadControlIds(companyId: string): Promise<{
  arId: string | null;
  apId: string | null;
  wpId: string | null;
  waId: string | null;
  codeById: Map<string, string>;
}> {
  const accounts = await accountService.getAllAccounts(companyId);
  const codeById = new Map<string, string>();
  (accounts || []).forEach((a: any) => {
    if (a?.id) codeById.set(a.id, String(a.code || '').trim());
  });
  const find = (code: string) => (accounts || []).find((a: any) => String(a.code || '').trim() === code)?.id ?? null;
  return {
    arId: find('1100'),
    apId: find('2000'),
    wpId: find('2010'),
    waId: find('1180'),
    codeById,
  };
}

/** Resolution maps — extended vs SQL RPC (adds studio production stage → worker). */
type ResolutionMaps = {
  saleCustomer: Map<string, string>;
  purchaseSupplier: Map<string, string>;
  paymentContact: Map<string, string>;
  stageWorker: Map<string, string>;
  rentalCustomer: Map<string, string>;
};

function resolvePartyId(je: JeMini, maps: ResolutionMaps): string | null {
  const rt = String(je.reference_type || '').toLowerCase().trim();
  const rid = je.reference_id ? String(je.reference_id) : '';
  if (rt === 'opening_balance_contact_ar' && rid) return rid;
  if (rt === 'opening_balance_contact_ap' && rid) return rid;
  if (rt === 'opening_balance_contact_worker' && rid) return rid;
  if (rt === 'manual_receipt' && rid) return rid;
  if (rt === 'manual_payment' && rid) return rid;
  if (['sale', 'sale_return', 'sale_adjustment', 'sale_extra_expense'].includes(rt) && rid) {
    return maps.saleCustomer.get(rid) ?? null;
  }
  if (['purchase', 'purchase_return', 'purchase_adjustment', 'purchase_reversal'].includes(rt) && rid) {
    return maps.purchaseSupplier.get(rid) ?? null;
  }
  if ((rt === 'worker_payment' || rt === 'worker_advance_settlement') && rid) return rid;
  if ((rt === 'studio_production_stage' || rt === 'studio_production_stage_reversal') && rid) {
    return maps.stageWorker.get(rid) ?? null;
  }
  if (rt === 'rental' && rid) return maps.rentalCustomer.get(rid) ?? null;
  if (je.payment_id) return maps.paymentContact.get(String(je.payment_id)) ?? null;
  return null;
}

async function buildResolutionMaps(companyId: string, jes: JeMini[]): Promise<ResolutionMaps> {
  const saleIds = new Set<string>();
  const purchaseIds = new Set<string>();
  const paymentIds = new Set<string>();
  const stageIds = new Set<string>();
  const rentalIds = new Set<string>();
  for (const je of jes) {
    const rt = String(je.reference_type || '').toLowerCase();
    const rid = je.reference_id ? String(je.reference_id) : '';
    if (!rid) continue;
    if (['sale', 'sale_return', 'sale_adjustment', 'sale_extra_expense'].includes(rt)) saleIds.add(rid);
    if (['purchase', 'purchase_return', 'purchase_adjustment', 'purchase_reversal'].includes(rt)) purchaseIds.add(rid);
    if (rt === 'studio_production_stage' || rt === 'studio_production_stage_reversal') stageIds.add(rid);
    if (rt === 'rental') rentalIds.add(rid);
    if (je.payment_id) paymentIds.add(String(je.payment_id));
  }
  const saleCustomer = new Map<string, string>();
  if (saleIds.size) {
    const { data } = await supabase.from('sales').select('id, customer_id').eq('company_id', companyId).in('id', [...saleIds]);
    (data || []).forEach((r: any) => {
      if (r.customer_id) saleCustomer.set(String(r.id), String(r.customer_id));
    });
  }
  const purchaseSupplier = new Map<string, string>();
  if (purchaseIds.size) {
    const { data } = await supabase
      .from('purchases')
      .select('id, supplier_id')
      .eq('company_id', companyId)
      .in('id', [...purchaseIds]);
    (data || []).forEach((r: any) => {
      if (r.supplier_id) purchaseSupplier.set(String(r.id), String(r.supplier_id));
    });
  }
  const paymentContact = new Map<string, string>();
  if (paymentIds.size) {
    const chunks = [...paymentIds];
    for (let i = 0; i < chunks.length; i += 100) {
      const { data } = await supabase
        .from('payments')
        .select('id, contact_id')
        .eq('company_id', companyId)
        .in('id', chunks.slice(i, i + 100));
      (data || []).forEach((r: any) => {
        if (r.contact_id) paymentContact.set(String(r.id), String(r.contact_id));
      });
    }
  }
  const stageWorker = new Map<string, string>();
  if (stageIds.size) {
    const { data } = await supabase
      .from('studio_production_stages')
      .select('id, assigned_worker_id')
      .in('id', [...stageIds]);
    (data || []).forEach((r: any) => {
      if (r.assigned_worker_id) stageWorker.set(String(r.id), String(r.assigned_worker_id));
    });
  }
  const rentalCustomer = new Map<string, string>();
  if (rentalIds.size) {
    const { data } = await supabase
      .from('rentals')
      .select('id, customer_id')
      .eq('company_id', companyId)
      .in('id', [...rentalIds]);
    (data || []).forEach((r: any) => {
      if (r.customer_id) rentalCustomer.set(String(r.id), String(r.customer_id));
    });
  }
  return { saleCustomer, purchaseSupplier, paymentContact, stageWorker, rentalCustomer };
}

async function collectJournalIdsForParty(
  companyId: string,
  partyType: PartyKind,
  partyId: string
): Promise<Set<string>> {
  const ids = new Set<string>();
  const pid = String(partyId);

  if (partyType === 'customer') {
    const { data: sales } = await supabase.from('sales').select('id').eq('company_id', companyId).eq('customer_id', pid);
    const saleIds = (sales || []).map((s: any) => s.id);
    const { data: rentals } = await supabase.from('rentals').select('id').eq('company_id', companyId).eq('customer_id', pid);
    const rentalIds = (rentals || []).map((r: any) => r.id);

    const { data: p1 } = await supabase.from('payments').select('id').eq('company_id', companyId).eq('contact_id', pid);
    (p1 || []).forEach((p: any) => ids.add(`pay:${p.id}`));

    let salePayQ = supabase.from('payments').select('id').eq('company_id', companyId).eq('reference_type', 'sale');
    if (saleIds.length) salePayQ = salePayQ.in('reference_id', saleIds);
    else salePayQ = salePayQ.eq('reference_id', '00000000-0000-0000-0000-000000000000');
    const { data: p2 } = saleIds.length ? await salePayQ : { data: [] };
    (p2 || []).forEach((p: any) => ids.add(`pay:${p.id}`));

    const ors: string[] = [];
    if (saleIds.length) {
      ors.push(
        `and(reference_type.in.(sale,sale_return,sale_adjustment,sale_extra_expense),reference_id.in.(${saleIds.join(',')}))`
      );
    }
    if (rentalIds.length) {
      ors.push(`and(reference_type.eq.rental,reference_id.in.(${rentalIds.join(',')}))`);
    }
    ors.push(`and(reference_type.eq.manual_receipt,reference_id.eq.${pid})`);
    ors.push(`and(reference_type.eq.opening_balance_contact_ar,reference_id.eq.${pid})`);

    const payIds = [...ids]
      .filter((k) => k.startsWith('pay:'))
      .map((k) => k.slice(4));
    if (payIds.length) {
      const { data: jPay } = await supabase
        .from('journal_entries')
        .select('id')
        .eq('company_id', companyId)
        .in('payment_id', payIds);
      (jPay || []).forEach((j: any) => ids.add(j.id));
    }

    if (ors.length) {
      const { data: j1 } = await supabase
        .from('journal_entries')
        .select('id')
        .eq('company_id', companyId)
        .or(ors.join(','));
      (j1 || []).forEach((j: any) => ids.add(j.id));
    }
  }

  if (partyType === 'supplier') {
    const { data: pur } = await supabase.from('purchases').select('id').eq('company_id', companyId).eq('supplier_id', pid);
    const purIds = (pur || []).map((p: any) => p.id);

    const { data: p1 } = await supabase.from('payments').select('id').eq('company_id', companyId).eq('contact_id', pid);
    (p1 || []).forEach((p: any) => ids.add(`pay:${p.id}`));

    let pq = supabase.from('payments').select('id').eq('company_id', companyId).eq('reference_type', 'purchase');
    if (purIds.length) pq = pq.in('reference_id', purIds);
    const { data: p2 } = purIds.length ? await pq : { data: [] };
    (p2 || []).forEach((p: any) => ids.add(`pay:${p.id}`));

    const payIds = [...ids]
      .filter((k) => k.startsWith('pay:'))
      .map((k) => k.slice(4));
    if (payIds.length) {
      const { data: jPay } = await supabase
        .from('journal_entries')
        .select('id')
        .eq('company_id', companyId)
        .in('payment_id', payIds);
      (jPay || []).forEach((j: any) => ids.add(j.id));
    }
    if (purIds.length) {
      const { data: jPur } = await supabase
        .from('journal_entries')
        .select('id')
        .eq('company_id', companyId)
        .or(
          `and(reference_type.in.(purchase,purchase_return,purchase_adjustment,purchase_reversal),reference_id.in.(${purIds.join(
            ','
          )}))`
        );
      (jPur || []).forEach((j: any) => ids.add(j.id));
    }
    const { data: mo } = await supabase
      .from('journal_entries')
      .select('id')
      .eq('company_id', companyId)
      .eq('reference_type', 'manual_payment')
      .eq('reference_id', pid);
    (mo || []).forEach((j: any) => ids.add(j.id));

    const { data: obap } = await supabase
      .from('journal_entries')
      .select('id')
      .eq('company_id', companyId)
      .eq('reference_type', 'opening_balance_contact_ap')
      .eq('reference_id', pid);
    (obap || []).forEach((j: any) => ids.add(j.id));
  }

  if (partyType === 'worker') {
    const { data: jw } = await supabase
      .from('journal_entries')
      .select('id')
      .eq('company_id', companyId)
      .eq('reference_id', pid)
      .in('reference_type', ['worker_payment', 'worker_advance_settlement', 'opening_balance_contact_worker']);
    (jw || []).forEach((j: any) => ids.add(j.id));

    const { data: stages } = await supabase
      .from('studio_production_stages')
      .select('id')
      .eq('assigned_worker_id', pid);
    const stIds = (stages || []).map((s: any) => s.id);
    if (stIds.length) {
      const { data: jst } = await supabase
        .from('journal_entries')
        .select('id')
        .eq('company_id', companyId)
        .in('reference_type', ['studio_production_stage', 'studio_production_stage_reversal'])
        .in('reference_id', stIds);
      (jst || []).forEach((j: any) => ids.add(j.id));
    }

    const { data: p1 } = await supabase.from('payments').select('id').eq('company_id', companyId).eq('contact_id', pid);
    const payIds = (p1 || []).map((p: any) => p.id);
    if (payIds.length) {
      const { data: jPay } = await supabase
        .from('journal_entries')
        .select('id')
        .eq('company_id', companyId)
        .in('payment_id', payIds);
      (jPay || []).forEach((j: any) => ids.add(j.id));
    }
  }

  const out = new Set<string>();
  ids.forEach((x) => {
    if (x && !String(x).startsWith('pay:')) out.add(String(x));
  });
  return out;
}

/** Classify worker-related JEs; failures use unknown_or_broken_pattern with ruleOk false. */
export function classifyWorkerJournalLifecycle(
  je: JeMini,
  lines: { account_id: string; debit: number; credit: number }[],
  codeById: Map<string, string>
): { bucket: WorkerJournalLifecycleBucket; ruleOk: boolean; detail: string } {
  const rt = String(je.reference_type || '').toLowerCase();
  const codesOnLines = lines.map((l) => ({
    code: codeById.get(l.account_id) || '',
    dr: Number(l.debit) || 0,
    cr: Number(l.credit) || 0,
  }));
  const crCash = codesOnLines.some((x) => ['1000', '1010', '1020'].includes(x.code) && x.cr > EPS);

  if (rt === 'studio_production_stage') {
    const dr5000 = codesOnLines.some((x) => x.code === '5000' && x.dr > EPS);
    const cr2010 = codesOnLines.some((x) => x.code === '2010' && x.cr > EPS);
    const ok = dr5000 && cr2010 && codesOnLines.length >= 2;
    return {
      bucket: ok ? 'bill_posting' : 'unknown_or_broken_pattern',
      ruleOk: ok,
      detail: ok ? 'Dr 5000 / Cr 2010 (bill finalization)' : 'Expected Dr Cost (5000) / Cr 2010',
    };
  }
  if (rt === 'studio_production_stage_reversal') {
    const dr2010 = codesOnLines.some((x) => x.code === '2010' && x.dr > EPS);
    const cr5000 = codesOnLines.some((x) => x.code === '5000' && x.cr > EPS);
    const ok = dr2010 && cr5000;
    return {
      bucket: ok ? 'bill_posting' : 'unknown_or_broken_pattern',
      ruleOk: ok,
      detail: ok ? 'Bill reversal: Dr 2010 / Cr 5000' : 'Expected Dr 2010 / Cr 5000',
    };
  }
  if (rt === 'worker_advance_settlement') {
    const dr2010 = codesOnLines.some((x) => x.code === '2010' && x.dr > EPS);
    const cr1180 = codesOnLines.some((x) => x.code === '1180' && x.cr > EPS);
    const ok = dr2010 && cr1180;
    return {
      bucket: ok ? 'advance_settlement' : 'unknown_or_broken_pattern',
      ruleOk: ok,
      detail: ok ? 'Dr 2010 / Cr 1180 (advance apply)' : 'Expected Dr 2010 / Cr 1180',
    };
  }
  if (rt === 'worker_payment') {
    const dr1180 = codesOnLines.some((x) => x.code === '1180' && x.dr > EPS);
    const dr2010 = codesOnLines.some((x) => x.code === '2010' && x.dr > EPS);
    if (dr1180 && crCash && !dr2010) {
      return {
        bucket: 'pre_bill_advance',
        ruleOk: true,
        detail: 'Dr 1180 / Cr Cash-Bank (pre-bill advance)',
      };
    }
    if (dr2010 && crCash && !dr1180) {
      return {
        bucket: 'post_bill_payment',
        ruleOk: true,
        detail: 'Dr 2010 / Cr Cash-Bank (post-bill payment)',
      };
    }
    return {
      bucket: 'unknown_or_broken_pattern',
      ruleOk: false,
      detail: 'Expected pre-bill (Dr 1180 + Cr cash-bank) or post-bill (Dr 2010 + Cr cash-bank)',
    };
  }
  return {
    bucket: 'unknown_or_broken_pattern',
    ruleOk: true,
    detail: 'Not in worker lifecycle rule set (reference_type)',
  };
}

export async function runPartyBalanceTieOut(input: PartyBalanceTieOutInput): Promise<PartyBalanceTieOutResult> {
  const { companyId, partyType, partyId } = input;
  const asOf = (input.asOfDate || new Date().toISOString().slice(0, 10)).slice(0, 10);
  const b = safeBranch(input.branchId ?? null);

  const diagnostics: TieOutMismatchCause[] = [];
  const notes: string[] = [];
  /** Legacy flag; parity migration 20260334 aligns RPC with extended resolver (studio stage → worker, etc.). */
  const rpcOmitsStudioStagePartyMapping = false;

  const { data: contact } = await supabase
    .from('contacts')
    .select('id, name, type')
    .eq('company_id', companyId)
    .eq('id', partyId)
    .maybeSingle();

  const { arId, apId, wpId, waId, codeById } = await loadControlIds(companyId);
  const controlTarget =
    partyType === 'customer' ? arId : partyType === 'supplier' ? apId : partyType === 'worker' ? wpId : null;

  const opMap = await contactService.getContactBalancesSummary(companyId, b).catch(() => null);
  const opRow = opMap?.get(partyId);
  const opRecv = partyType === 'customer' ? opRow?.receivables ?? null : null;
  const opPay =
    partyType === 'supplier' || partyType === 'worker' ? opRow?.payables ?? null : null;

  const glRpc = await supabase.rpc('get_contact_party_gl_balances', {
    p_company_id: companyId,
    p_branch_id: b,
  });
  let rpcAr = 0;
  let rpcAp = 0;
  let rpcWk = 0;
  if (!glRpc.error && Array.isArray(glRpc.data)) {
    const row = (glRpc.data as any[]).find((r) => String(r.contact_id) === String(partyId));
    if (row) {
      rpcAr = Number(row.gl_ar_receivable) || 0;
      rpcAp = Number(row.gl_ap_payable) || 0;
      rpcWk = Number(row.gl_worker_payable) || 0;
    }
  } else {
    diagnostics.push({
      code: 'RPC_PARTY_GL_FAILED',
      severity: 'error',
      message: glRpc.error?.message || 'get_contact_party_gl_balances failed',
    });
  }

  const jeIdSet = await collectJournalIdsForParty(companyId, partyType, partyId);
  const jeIds = [...jeIdSet];
  const jes: JeMini[] = [];
  const chunk = 60;
  for (let i = 0; i < jeIds.length; i += chunk) {
    const { data } = await supabase
      .from('journal_entries')
      .select('id, entry_no, entry_date, reference_type, reference_id, payment_id, is_void, branch_id, company_id')
      .eq('company_id', companyId)
      .in('id', jeIds.slice(i, i + chunk));
    (data || []).forEach((j: any) => jes.push(j));
  }

  const maps = await buildResolutionMaps(companyId, jes);
  if (partyType === 'worker') {
    const stageMapped = [...maps.stageWorker.values()].filter((id) => id === String(partyId)).length;
    if (stageMapped > 0) notes.push('Studio stage JEs map to worker via assigned_worker_id (extended resolver).');
  }

  const accountIdsForLines: string[] = [];
  if (partyType === 'worker') {
    if (wpId) accountIdsForLines.push(wpId);
    if (waId) accountIdsForLines.push(waId);
  } else if (controlTarget) {
    accountIdsForLines.push(controlTarget);
  }

  let linesBundle: { account_id: string; debit: number; credit: number; journal_entry_id: string }[] = [];
  if (jeIds.length && accountIdsForLines.length) {
    for (let i = 0; i < jeIds.length; i += chunk) {
      const { data: lines } = await supabase
        .from('journal_entry_lines')
        .select('account_id, debit, credit, journal_entry_id')
        .in('journal_entry_id', jeIds.slice(i, i + chunk))
        .in('account_id', accountIdsForLines);
      (lines || []).forEach((l: any) => linesBundle.push(l));
    }
  }

  const jeById = new Map(jes.map((j) => [j.id, j]));
  let extAr = 0;
  let extAp = 0;
  let extWp = 0;
  let extWa = 0;

  for (const line of linesBundle) {
    const je = jeById.get(line.journal_entry_id);
    if (!je || je.is_void) continue;
    if (je.company_id && je.company_id !== companyId) continue;
    if (b && je.branch_id && je.branch_id !== b) continue;
    if (String(je.entry_date).slice(0, 10) > asOf) continue;
    const party = resolvePartyId(je, maps);
    if (party !== String(partyId)) continue;
    const aid = line.account_id;
    const dr = Number(line.debit) || 0;
    const cr = Number(line.credit) || 0;
    if (arId && aid === arId) extAr += dr - cr;
    if (apId && aid === apId) extAp += cr - dr;
    if (wpId && aid === wpId) extWp += cr - dr;
    if (waId && aid === waId) extWa += dr - cr;
  }

  const rpcPartySliceVal =
    partyType === 'customer' ? rpcAr : partyType === 'supplier' ? rpcAp : partyType === 'worker' ? rpcWk : 0;
  const workerNetExt =
    partyType === 'worker' ? Math.max(0, round2(extWp - extWa)) : 0;
  /** Party-slice comparison basis: AR/AP = single account; worker = same as RPC (GREATEST(0, WP−WA)). */
  const extendedPartySliceVal =
    partyType === 'customer'
      ? extAr
      : partyType === 'supplier'
        ? extAp
        : partyType === 'worker'
          ? workerNetExt
          : 0;

  const extendedMinusRpc = round2(extendedPartySliceVal - rpcPartySliceVal);
  if (Math.abs(extendedMinusRpc) > EPS) {
    const msg =
      partyType === 'worker'
        ? 'Collected JEs + extended lines differ from get_contact_party_gl_balances worker column — check migration 20260334 applied, branch filter, or JEs outside collection.'
        : partyType === 'customer'
          ? 'Collected JEs + extended lines differ from RPC AR — check migration 20260334, branch/as-of, or JEs outside collection.'
          : 'Collected JEs + extended lines differ from RPC AP — check migration 20260334, branch/as-of, or JEs outside collection.';
    diagnostics.push({
      code: 'EXTENDED_RESOLVER_VS_RPC_SLICE',
      severity: 'warn',
      message: msg,
      relatedIds: [],
    });
  }

  const controlIdSet = new Set([arId, apId, wpId, waId].filter(Boolean) as string[]);
  const seenUnresolvedJe = new Set<string>();
  for (const line of linesBundle) {
    if (!controlIdSet.has(line.account_id)) continue;
    const je = jeById.get(line.journal_entry_id);
    if (!je || je.is_void) continue;
    if (je.company_id && je.company_id !== companyId) continue;
    if (b && je.branch_id && je.branch_id !== b) continue;
    if (String(je.entry_date).slice(0, 10) > asOf) continue;
    if (resolvePartyId(je, maps) != null) continue;
    if (seenUnresolvedJe.has(je.id)) continue;
    seenUnresolvedJe.add(je.id);
    diagnostics.push({
      code: 'CONTROL_LINE_PARTY_UNRESOLVED',
      severity: 'warn',
      message: `JE ${je.entry_no || je.id} hits AR/AP/WP/WA but party cannot be resolved (ref ${je.reference_type}:${je.reference_id ?? '—'}, payment_id ${je.payment_id ?? '—'})`,
      relatedIds: [je.id],
    });
  }

  const operationalPrimary =
    partyType === 'customer'
      ? opRecv
      : partyType === 'supplier' || partyType === 'worker'
        ? opPay
        : null;

  const opMinusRpc =
    operationalPrimary != null ? round2(operationalPrimary - rpcPartySliceVal) : null;
  if (opMinusRpc != null && Math.abs(opMinusRpc) > EPS) {
    diagnostics.push({
      code: 'OPERATIONAL_VS_GL_PARTY_SLICE',
      severity: 'warn',
      message: `Operational (Contacts RPC) minus GL party slice = ${opMinusRpc}`,
    });
  }

  const components: LabeledAmount[] = [];
  const linked: PartyBalanceTieOutResult['linked'] = {
    payments: [],
    journalEntries: [],
  };

  if (partyType === 'customer') {
    let q = supabase
      .from('sales')
      .select('id, invoice_no, due_amount, total, status, paid_amount')
      .eq('company_id', companyId)
      .eq('customer_id', partyId)
      .eq('status', 'final');
    if (b) q = q.eq('branch_id', b);
    const { data: sales } = await q;
    const saleDue = (sales || []).reduce(
      (s, r: any) =>
        s +
        Math.max(
          0,
          Number(r.due_amount ?? 0) || (Number(r.total) || 0) - (Number(r.paid_amount) || 0)
        ),
      0
    );
    linked.sales = (sales || []).map((r: any) => ({
      id: r.id,
      invoice_no: r.invoice_no,
      due_amount: Number(r.due_amount) || 0,
      total: Number(r.total) || 0,
      status: r.status,
    }));
    components.push({
      value: round2(saleDue),
      label: 'operational',
      source: 'sales',
      note: 'Final sales due (document)',
    });

    let rq = supabase.from('rentals').select('id, booking_no, due_amount').eq('company_id', companyId).eq('customer_id', partyId);
    if (b) rq = rq.eq('branch_id', b);
    const { data: rentals } = await rq;
    const rentDue = (rentals || []).reduce((s, r: any) => s + Math.max(0, Number(r.due_amount) || 0), 0);
    linked.rentals = (rentals || []).map((r: any) => ({
      id: r.id,
      booking_no: r.booking_no,
      due_amount: Number(r.due_amount) || 0,
    }));
    components.push({
      value: round2(rentDue),
      label: 'operational',
      source: 'rentals',
      note: 'Rental due may not match 1100 if JEs use non-AR pattern',
    });

    const { data: opn } = await supabase
      .from('contacts')
      .select('opening_balance')
      .eq('id', partyId)
      .eq('company_id', companyId)
      .maybeSingle();
    const ob = Number((opn as any)?.opening_balance) || 0;
    components.push({
      value: round2(ob),
      label: 'operational',
      source: 'contacts.opening_balance',
      note: 'Signed per contact record; compare to AR only if opening posts to 1100',
    });

    components.push({
      value: null,
      label: 'pending-mapping',
      source: 'manual_receipt / on_account',
      note: 'Not itemized here — compare payments list below to GL',
    });

    const saleIdsForPay = (sales || []).map((r: any) => r.id).filter(Boolean);
    for (let i = 0; i < saleIdsForPay.length; i += 40) {
      const { data: sp } = await supabase
        .from('payments')
        .select('id, contact_id, reference_id, reference_number')
        .eq('company_id', companyId)
        .eq('reference_type', 'sale')
        .in('reference_id', saleIdsForPay.slice(i, i + 40));
      for (const p of sp || []) {
        if (!p.contact_id) {
          diagnostics.push({
            code: 'SALE_PAYMENT_NO_CONTACT',
            severity: 'warn',
            message: `Sale-linked payment ${p.reference_number || p.id} has no contact_id — GL may still map via payment_id`,
            relatedIds: [String(p.id)],
          });
        } else if (String(p.contact_id) !== String(partyId)) {
          diagnostics.push({
            code: 'SALE_PAYMENT_CONTACT_NOT_CUSTOMER',
            severity: 'warn',
            message: `Sale-linked payment ${p.reference_number || p.id} contact_id does not match this customer`,
            relatedIds: [String(p.id), String(p.reference_id)],
          });
        }
      }
    }
  }

  if (partyType === 'supplier') {
    let pq = supabase
      .from('purchases')
      .select('id, po_no, due_amount, total, paid_amount, status')
      .eq('company_id', companyId)
      .eq('supplier_id', partyId)
      .in('status', ['received', 'final', 'ordered']);
    if (b) pq = pq.eq('branch_id', b);
    const { data: pur } = await pq;
    const due = (pur || []).reduce(
      (s, r: any) =>
        s +
        Math.max(
          0,
          Number(r.due_amount ?? 0) || (Number(r.total) || 0) - (Number(r.paid_amount) || 0)
        ),
      0
    );
    linked.purchases = (pur || []).map((r: any) => ({
      id: r.id,
      po_no: r.po_no,
      due_amount: Number(r.due_amount) || 0,
      total: Number(r.total) || 0,
      status: r.status,
    }));
    components.push({ value: round2(due), label: 'operational', source: 'purchases' });

    const purchaseIds = (pur || []).map((r: any) => r.id).filter(Boolean);
    for (let i = 0; i < purchaseIds.length; i += 40) {
      const { data: pp } = await supabase
        .from('payments')
        .select('id, contact_id, reference_id, reference_number')
        .eq('company_id', companyId)
        .eq('reference_type', 'purchase')
        .in('reference_id', purchaseIds.slice(i, i + 40));
      for (const p of pp || []) {
        if (!p.contact_id) {
          diagnostics.push({
            code: 'PURCHASE_PAYMENT_NO_CONTACT',
            severity: 'warn',
            message: `Purchase payment ${p.reference_number || p.id} has no contact_id — AP party slice may rely on document link only`,
            relatedIds: [String(p.id)],
          });
        } else if (String(p.contact_id) !== String(partyId)) {
          diagnostics.push({
            code: 'PURCHASE_PAYMENT_CONTACT_NOT_SUPPLIER',
            severity: 'warn',
            message: `Purchase payment ${p.reference_number || p.id} contact_id does not match this supplier`,
            relatedIds: [String(p.id), String(p.reference_id)],
          });
        }
      }
    }
  }

  if (partyType === 'worker') {
    const { data: wle } = await supabase
      .from('worker_ledger_entries')
      .select('amount, status, reference_type, reference_id')
      .eq('company_id', companyId)
      .eq('worker_id', partyId);
    const unpaid = (wle || []).filter((r: any) => String(r.status || '').toLowerCase() !== 'paid');
    const unpaidSum = unpaid.reduce((s, r: any) => s + Math.max(0, Number(r.amount) || 0), 0);
    components.push({
      value: round2(unpaidSum),
      label: 'operational',
      source: 'worker_ledger_entries (unpaid)',
      note: 'Studio jobs / bills — not split pre vs post bill',
    });
    components.push({
      value: null,
      label: 'pending-mapping',
      source: 'worker bills vs advances',
      note: 'Use GL tabs + journal list for 2010/1180 pattern',
    });
  }

  const pq = supabase
    .from('payments')
    .select('id, amount, payment_date, reference_type, reference_id, contact_id, reference_number')
    .eq('company_id', companyId)
    .eq('contact_id', partyId);
  const { data: pays } = await pq;
  const paymentRows: LinkedPaymentRow[] = [];
  const payIdsForJe = new Set<string>();
  (pays || []).forEach((p: any) => {
    payIdsForJe.add(String(p.id));
    let tie: PartyAmountLabel = 'operational';
    let note: string | undefined;
    if (!p.contact_id) {
      tie = 'pending-mapping';
      note = 'Missing contact_id — party tie weak';
      diagnostics.push({
        code: 'PAYMENT_MISSING_CONTACT',
        severity: 'warn',
        message: `Payment ${p.reference_number || p.id} has no contact_id`,
        relatedIds: [String(p.id)],
      });
    }
    paymentRows.push({
      id: p.id,
      amount: Number(p.amount) || 0,
      payment_date: p.payment_date,
      reference_type: p.reference_type,
      reference_id: p.reference_id,
      contact_id: p.contact_id,
      reference_number: p.reference_number,
      tieToParty: tie,
      note,
    });
  });
  linked.payments = paymentRows;

  const payIdsArr = [...payIdsForJe];
  const paymentIdsWithJe = new Set<string>();
  for (let i = 0; i < payIdsArr.length; i += 80) {
    const slice = payIdsArr.slice(i, i + 80);
    const { data: jePayRows } = await supabase
      .from('journal_entries')
      .select('payment_id')
      .eq('company_id', companyId)
      .in('payment_id', slice);
    (jePayRows || []).forEach((r: any) => {
      if (r.payment_id) paymentIdsWithJe.add(String(r.payment_id));
    });
  }
  for (const pid of payIdsArr) {
    if (!paymentIdsWithJe.has(pid)) {
      diagnostics.push({
        code: 'PAYMENT_WITHOUT_JE',
        severity: 'info',
        message: `No journal_entries row with payment_id=${pid} (may be expected for non-posted flows)`,
        relatedIds: [pid],
      });
    }
  }

  const linesByJeForWorker = new Map<string, { account_id: string; debit: number; credit: number }[]>();
  if (partyType === 'worker' && jeIds.length) {
    for (let i = 0; i < jeIds.length; i += chunk) {
      const { data: jl } = await supabase
        .from('journal_entry_lines')
        .select('journal_entry_id, account_id, debit, credit')
        .in('journal_entry_id', jeIds.slice(i, i + chunk));
      (jl || []).forEach((l: any) => {
        const jid = String(l.journal_entry_id);
        const arr = linesByJeForWorker.get(jid) || [];
        arr.push({ account_id: l.account_id, debit: l.debit, credit: l.credit });
        linesByJeForWorker.set(jid, arr);
      });
    }
  }

  const journalEntriesOut: LinkedJournalRow[] = [];
  for (const je of jes) {
    if (je.is_void) continue;
    if (b && je.branch_id && je.branch_id !== b) continue;
    if (String(je.entry_date).slice(0, 10) > asOf) continue;

    let workerLifecycleBucket: string | undefined;
    let workerRuleOk: boolean | undefined;
    let workerRuleDetail: string | undefined;
    if (partyType === 'worker') {
      const jl = linesByJeForWorker.get(je.id) || [];
      const v = classifyWorkerJournalLifecycle(je, jl, codeById);
      workerLifecycleBucket = v.bucket;
      workerRuleOk = v.ruleOk;
      workerRuleDetail = v.detail;
      if (!v.ruleOk) {
        diagnostics.push({
          code: 'WORKER_LIFECYCLE_PATTERN',
          severity: 'warn',
          message: `${je.entry_no || je.id}: ${v.detail}`,
          relatedIds: [je.id],
        });
      }
    }
    journalEntriesOut.push({
      journal_entry_id: je.id,
      entry_no: je.entry_no,
      entry_date: je.entry_date,
      reference_type: je.reference_type,
      reference_id: je.reference_id,
      payment_id: je.payment_id,
      workerLifecycleBucket,
      workerRuleOk,
      workerRuleDetail,
    });
  }
  linked.journalEntries = journalEntriesOut;

  const workerGl =
    partyType === 'worker' && wpId && waId
      ? {
          gl2010NetLiability: {
            value: round2(extWp),
            label: 'gl',
            source: '2010 lines (credit−debit) attributed to party',
          },
          gl1180NetAsset: {
            value: round2(extWa),
            label: 'gl',
            source: '1180 lines (debit−credit) attributed to party',
          },
          workerNetFromWpWa: {
            value: workerNetExt,
            label: 'gl',
            source: 'max(0, WP net − WA net) extended resolver',
          },
          rpcWorkerNet: {
            value: round2(rpcWk),
            label: 'control-account',
            source: 'get_contact_party_gl_balances.gl_worker_payable',
          },
        }
      : undefined;

  const unmappedResidual =
    partyType === 'customer'
      ? round2(rpcAr - extAr)
      : partyType === 'supplier'
        ? round2(rpcAp - extAp)
        : partyType === 'worker'
          ? round2(rpcWk - workerNetExt)
          : null;

  return {
    party: {
      type: partyType,
      id: partyId,
      name: (contact as any)?.name ?? null,
      contactType: (contact as any)?.type ?? null,
      branchScope: b,
      asOfDate: asOf,
    },
    operational: {
      primaryReceivableOrPayable: {
        value: operationalPrimary != null ? round2(operationalPrimary) : null,
        label: 'operational',
        source: 'get_contact_balances_summary (Contacts row)',
        note: operationalPrimary == null ? 'RPC map miss — contact may be missing from summary' : undefined,
      },
      components,
    },
    gl: {
      extendedOnControlAccount: {
        value: round2(extendedPartySliceVal),
        label: 'gl',
        source:
          partyType === 'customer'
            ? '1100 lines (Dr−Cr) for collected JEs + extended party resolution'
            : partyType === 'supplier'
              ? '2000 lines (Cr−Dr) for collected JEs'
              : 'Worker: max(0, 2010 net − 1180 net) on collected JEs + extended party resolution (same basis as RPC column)',
      },
      rpcPartySlice: {
        value: round2(rpcPartySliceVal),
        label: 'control-account',
        source: 'get_contact_party_gl_balances (party resolution per migration 20260334)',
      },
      extendedMinusRpcPartySlice: {
        value: extendedMinusRpc,
        label: 'residual',
        source: 'extended − RPC party slice',
      },
    },
    workerGl,
    variances: {
      operationalMinusRpcPartySlice: opMinusRpc,
      notes:
        opMinusRpc != null && Math.abs(opMinusRpc) > EPS
          ? [
              'Investigate: sale/rental due vs posted AR, timing, manual receipts, or unmapped payment→JE.',
            ]
          : [],
    },
    linked,
    residual: {
      unmappedPartyOnControl: {
        value: unmappedResidual,
        label: 'residual',
        source:
          partyType === 'worker'
            ? 'RPC gl_worker_payable − extended max(0, WP−WA) on collected JEs'
            : 'RPC party slice − extended line sum on collected JEs',
        note:
          unmappedResidual != null && Math.abs(unmappedResidual) > EPS
            ? 'Non-zero: JE collection heuristic vs full GL, branch/as-of slice, or orphan control lines'
            : undefined,
      },
      notes: [
        'Journal collection is heuristic (linked sales/purchases/payments/stages); stray AR/AP lines may exist outside this set.',
      ],
    },
    diagnostics: {
      mismatchCauses: diagnostics,
      rpcOmitsStudioStagePartyMapping,
      notes: [
        ...notes,
        'Party GL RPC should match extended resolver after migration 20260334 (studio_production_stage → assigned_worker_id, sale_adjustment, purchase_reversal, manual_payment, rental, payment.contact_id).',
      ],
    },
  };
}
