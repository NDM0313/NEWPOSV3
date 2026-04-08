/**
 * Control-account drilldown for Chart of Accounts (1100, 2000, 2010, 1180, 1195).
 * Numbers are only emitted when sourced; otherwise status = unavailable | pending_mapping.
 */

import { supabase } from '@/lib/supabase';
import { accountingReportsService } from '@/app/services/accountingReportsService';
import { contactService } from '@/app/services/contactService';

export type BreakdownSourceKind = 'gl' | 'operational' | 'reconciliation' | 'hybrid';

export type BreakdownLineStatus = 'ok' | 'pending_mapping' | 'unavailable';

export interface BreakdownMetricRow {
  label: string;
  amount: number | null;
  source: BreakdownSourceKind;
  status: BreakdownLineStatus;
  note?: string;
}

export interface PartyGlRow {
  contactId: string;
  name: string;
  /** AR Dr−Cr, AP Cr−Dr, or worker net from RPC */
  glAmount: number;
  kind: 'ar' | 'ap' | 'worker_net';
}

export interface UnmappedGlBucketRow {
  referenceType: string;
  /** Same convention as residual: AR/1180 = Dr−Cr on unmapped lines; AP/WP = Cr−Dr on unmapped lines */
  amount: number;
}

export interface ControlAccountBreakdownResult {
  controlKind: 'ar' | 'ap' | 'worker_payable' | 'worker_advance' | 'suspense';
  accountId: string;
  accountCode: string;
  accountName: string;
  asOfDate: string;
  glAccountBalance: number | null;
  glBalanceStatus: BreakdownLineStatus;
  glBalanceNote?: string;
  subcategories: BreakdownMetricRow[];
  partyRows: PartyGlRow[];
  partySectionNote?: string;
  unmappedGlResidual: number | null;
  unmappedNote?: string;
  /** Sum of party-attributed slice from full get_contact_party_gl_balances result (all contacts; signed). */
  partyAttributedGlSum: number | null;
  /** Unmapped lines on this control code only, grouped by journal reference_type (RPC). */
  unmappedGlByReference: UnmappedGlBucketRow[];
  /** TB Dr−Cr summed for this account id and all descendant accounts (journal balances). */
  glSubtreeDrMinusCr: number | null;
}

function safeBranchUuid(branchId: string | null | undefined): string | null {
  if (!branchId || branchId === 'all') return null;
  const u = String(branchId).trim();
  return /^[0-9a-f-]{36}$/i.test(u) ? u : null;
}

async function loadContactNames(companyId: string, ids: string[]): Promise<Map<string, string>> {
  const uniq = [...new Set(ids.filter(Boolean))];
  const map = new Map<string, string>();
  if (uniq.length === 0) return map;
  const chunk = 80;
  for (let i = 0; i < uniq.length; i += chunk) {
    const slice = uniq.slice(i, i + chunk);
    const { data } = await supabase.from('contacts').select('id, name').eq('company_id', companyId).in('id', slice);
    (data || []).forEach((r: { id: string; name?: string }) => map.set(r.id, r.name || r.id));
  }
  return map;
}

/** Studio heuristic: invoice_no prefix (aligns with customer ledger labels). */
function isStudioSaleInvoiceNo(inv: string | null | undefined): boolean {
  const u = String(inv || '').toUpperCase();
  return u.startsWith('STD-') || u.startsWith('ST-') || u.startsWith('STUDIO');
}

const MAX_LINES_REF_BREAKDOWN = 8000;

/** Net per journal reference_type on one GL account (branch + void filtered). */
async function aggregateLineNetByJeReferenceType(
  companyId: string,
  accountId: string,
  branchId: string | null,
  net: 'dr_minus_cr' | 'cr_minus_dr'
): Promise<{ map: Map<string, number>; truncated: boolean; lineCount: number }> {
  const map = new Map<string, number>();
  let lineCount = 0;
  let truncated = false;
  let offset = 0;
  const page = 1000;
  while (lineCount < MAX_LINES_REF_BREAKDOWN) {
    const { data: lines, error } = await supabase
      .from('journal_entry_lines')
      .select(
        `
        debit,
        credit,
        journal_entry:journal_entries(reference_type, is_void, branch_id, company_id)
      `
      )
      .eq('account_id', accountId)
      .order('id', { ascending: true })
      .range(offset, offset + page - 1);
    if (error) break;
    const batch = lines || [];
    if (batch.length === 0) break;
    for (const row of batch as any[]) {
      const je = row.journal_entry;
      if (!je || je.company_id !== companyId) continue;
      if (je.is_void) continue;
      if (branchId && je.branch_id && je.branch_id !== branchId) continue;
      const dr = Number(row.debit) || 0;
      const cr = Number(row.credit) || 0;
      const n = net === 'dr_minus_cr' ? dr - cr : cr - dr;
      const rt = String(je.reference_type || '(blank)').toLowerCase() || '(blank)';
      map.set(rt, (map.get(rt) || 0) + n);
      lineCount++;
      if (lineCount >= MAX_LINES_REF_BREAKDOWN) {
        truncated = true;
        break;
      }
    }
    if (batch.length < page) break;
    offset += page;
  }
  return { map, truncated, lineCount };
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Descendants including root — for subtree TB vs single control id */
function collectDescendantAccountIds(
  rootId: string,
  rows: { id: string; parent_id?: string | null }[]
): Set<string> {
  const byParent = new Map<string, string[]>();
  for (const r of rows) {
    const pid = r.parent_id != null && String(r.parent_id).trim() !== '' ? String(r.parent_id) : '';
    if (!byParent.has(pid)) byParent.set(pid, []);
    byParent.get(pid)!.push(String(r.id));
  }
  const out = new Set<string>();
  const stack = [String(rootId)];
  while (stack.length) {
    const id = stack.pop()!;
    if (out.has(id)) continue;
    out.add(id);
    for (const k of byParent.get(id) || []) stack.push(k);
  }
  return out;
}

async function fetchUnmappedPartyGlBuckets(
  companyId: string,
  branchId: string | null,
  controlCode: string
): Promise<UnmappedGlBucketRow[]> {
  const { data, error } = await supabase.rpc('get_control_unmapped_party_gl_buckets', {
    p_company_id: companyId,
    p_branch_id: branchId,
    p_control_code: controlCode.trim(),
  });
  if (error || !Array.isArray(data)) return [];
  return (data as { reference_type: string; net_amount: number | string }[])
    .map((r) => ({
      referenceType: String(r.reference_type || '(blank)'),
      amount: Number(r.net_amount) || 0,
    }))
    .filter((x) => Math.abs(x.amount) > 0.0000001);
}

/**
 * Fetch breakdown for a control account. GL balance from trial balance / journal.
 */
export async function fetchControlAccountBreakdown(params: {
  companyId: string;
  branchId: string | null | undefined;
  accountId: string;
  accountCode: string;
  accountName: string;
  controlKind: ControlAccountBreakdownResult['controlKind'];
}): Promise<ControlAccountBreakdownResult> {
  const { companyId, branchId, accountId, accountCode, accountName, controlKind } = params;
  const asOf = new Date().toISOString().slice(0, 10);
  const b = safeBranchUuid(branchId);

  const subcategories: BreakdownMetricRow[] = [];
  let partyRows: PartyGlRow[] = [];
  let partySectionNote: string | undefined;
  let unmappedGlResidual: number | null = null;
  let unmappedNote: string | undefined;

  let glAccountBalance: number | null = null;
  let glBalanceStatus: BreakdownLineStatus = 'ok';
  let glBalanceNote: string | undefined;

  let partyAttributedGlSum: number | null = null;
  let unmappedGlByReference: UnmappedGlBucketRow[] = [];
  let glSubtreeDrMinusCr: number | null = null;

  let balMap: Record<string, number> = {};
  try {
    balMap = await accountingReportsService.getAccountBalancesFromJournal(companyId, asOf, b ?? undefined);
    if (balMap[accountId] !== undefined && balMap[accountId] !== null) {
      glAccountBalance = Number(balMap[accountId]) || 0;
    } else {
      glBalanceStatus = 'unavailable';
      glBalanceNote = 'No journal activity on this account in TB roll-up (or account id mismatch).';
    }
    try {
      const { data: treeRows } = await supabase
        .from('accounts')
        .select('id, parent_id')
        .eq('company_id', companyId);
      if (treeRows?.length) {
        const ids = collectDescendantAccountIds(accountId, treeRows as { id: string; parent_id?: string | null }[]);
        let sub = 0;
        for (const id of ids) sub += Number(balMap[id] ?? 0) || 0;
        glSubtreeDrMinusCr = roundMoney(sub);
      }
    } catch {
      glSubtreeDrMinusCr = null;
    }
  } catch {
    glBalanceStatus = 'unavailable';
    glBalanceNote = 'Could not load journal balance.';
  }

  const { map: opMap, error: opMapError } = await contactService.getContactBalancesSummary(companyId, branchId ?? null);

  if (controlKind === 'ar') {
    let sumPartyAr = 0;
    const glRpc = await supabase.rpc('get_contact_party_gl_balances', {
      p_company_id: companyId,
      p_branch_id: b,
    });
    if (!glRpc.error && Array.isArray(glRpc.data)) {
      const rows = glRpc.data as { contact_id: string; gl_ar_receivable?: number | string }[];
      sumPartyAr = rows.reduce((s, r) => s + (Number(r.gl_ar_receivable ?? 0) || 0), 0);
      partyAttributedGlSum = roundMoney(sumPartyAr);
      const ids = rows.filter((r) => Number(r.gl_ar_receivable ?? 0) !== 0).map((r) => r.contact_id);
      const names = await loadContactNames(companyId, ids);
      partyRows = rows
        .map((r) => ({
          contactId: r.contact_id,
          name: names.get(r.contact_id) || r.contact_id,
          glAmount: Number(r.gl_ar_receivable ?? 0) || 0,
          kind: 'ar' as const,
        }))
        .filter((r) => Math.abs(r.glAmount) > 0.0001)
        .sort((a, b) => Math.abs(b.glAmount) - Math.abs(a.glAmount));
    } else {
      partySectionNote = 'Party GL slice unavailable (RPC error).';
    }

    unmappedGlByReference = await fetchUnmappedPartyGlBuckets(companyId, b, accountCode || '1100');

    if (glAccountBalance != null) {
      unmappedGlResidual = Math.round((glAccountBalance - sumPartyAr) * 100) / 100;
      const bucketSum = roundMoney(unmappedGlByReference.reduce((s, x) => s + x.amount, 0));
      unmappedNote =
        'TB on this control account id (Dr−Cr) minus Σ party-attributed AR on **account code 1100** (all contacts, signed). Negative residual usually means net **credits** on 1100 with no resolved party (e.g. manual journal, expense wash, mis-linked payment).';
      if (unmappedGlByReference.length > 0) {
        unmappedNote += ` Unmapped buckets (reference_type) sum to ${roundMoney(bucketSum)} (Dr−Cr) — expect ≈ residual when migration get_control_unmapped_party_gl_buckets is applied.`;
      }
    }

    // Operational slices (document tables) — non-overlapping where possible
    try {
      let qSales = supabase
        .from('sales')
        .select('due_amount, total, paid_amount, status, invoice_no')
        .eq('company_id', companyId)
        .eq('status', 'final');
      if (b) qSales = qSales.eq('branch_id', b);
      const { data: sales } = await qSales;
      let studioDue = 0;
      let retailDue = 0;
      (sales || []).forEach((s: any) => {
        const due = Math.max(0, Number(s.due_amount ?? 0) || (Number(s.total) || 0) - (Number(s.paid_amount) || 0));
        if (due <= 0) return;
        if (isStudioSaleInvoiceNo(s.invoice_no)) studioDue += due;
        else retailDue += due;
      });
      subcategories.push({
        label: 'Customer receivables (sales due, non-studio pattern)',
        amount: Math.round(retailDue * 100) / 100,
        source: 'operational',
        status: 'ok',
        note: 'Final sales with due; studio heuristic = invoice STD-/ST-/STUDIO.',
      });
      subcategories.push({
        label: 'Studio receivables (sales due, studio invoice heuristic)',
        amount: Math.round(studioDue * 100) / 100,
        source: 'operational',
        status: 'ok',
      });

      let qRent = supabase.from('rentals').select('due_amount').eq('company_id', companyId).gt('due_amount', 0);
      if (b) qRent = qRent.eq('branch_id', b);
      const { data: rentals } = await qRent;
      const rentalDue = (rentals || []).reduce((s, r: any) => s + Math.max(0, Number(r.due_amount) || 0), 0);
      subcategories.push({
        label: 'Rental receivables (rentals.due_amount)',
        amount: Math.round(rentalDue * 100) / 100,
        source: 'operational',
        status: 'ok',
        note: 'Rental AR may not all post to 1100 in every JE pattern — compare to GL.',
      });

      const { data: openRows } = await supabase
        .from('contacts')
        .select('opening_balance')
        .eq('company_id', companyId)
        .in('type', ['customer', 'both']);
      const openingRecv = (openRows || []).reduce(
        (s, c: any) => s + Math.max(0, Number(c.opening_balance) || 0),
        0
      );
      subcategories.push({
        label: 'Opening receivables (contacts.opening_balance, customer/both)',
        amount: Math.round(openingRecv * 100) / 100,
        source: 'operational',
        status: 'ok',
      });

      const rpcRecvTotal =
        !opMapError
          ? [...opMap.values()].reduce((s, v) => s + (Number(v.receivables) || 0), 0)
          : null;
      subcategories.push({
        label: 'Total operational receivables (get_contact_balances_summary sum)',
        amount: rpcRecvTotal,
        source: 'operational',
        status: rpcRecvTotal != null ? 'ok' : 'unavailable',
        note:
          rpcRecvTotal != null
            ? 'Authoritative for Contacts column; sum of components above may differ (scope / returns / timing).'
            : 'RPC unavailable.',
      });

      subcategories.push({
        label: 'Manual / unmatched receivables (operational)',
        amount: null,
        source: 'operational',
        status: 'pending_mapping',
        note: 'Not split: includes manual receipts, on-account, and non–sale-linked patterns without a stable rule here.',
      });
    } catch (e) {
      subcategories.push({
        label: 'Operational subcategory detail',
        amount: null,
        source: 'operational',
        status: 'unavailable',
        note: e instanceof Error ? e.message : 'Query failed',
      });
    }

    subcategories.push({
      label: 'Sum party-attributed AR (get_contact_party_gl_balances)',
      amount: partySectionNote ? null : roundMoney(sumPartyAr),
      source: 'gl',
      status: partySectionNote ? 'unavailable' : 'ok',
      note: 'Σ gl_ar_receivable over **all** contacts (signed). Listed parties omit exact zeros; sum uses full RPC.',
    });
    if (
      glSubtreeDrMinusCr != null &&
      glAccountBalance != null &&
      Math.abs(glSubtreeDrMinusCr - glAccountBalance) >= 0.02
    ) {
      subcategories.push({
        label: 'Subtree TB (control id + descendants, Dr−Cr)',
        amount: glSubtreeDrMinusCr,
        source: 'gl',
        status: 'ok',
        note: 'Party RPC attributes lines on **code 1100 account id only** — not other account ids under this COA group.',
      });
    }
    subcategories.push({
      label: 'Residual / unmatched on 1100 (control balance − party sum)',
      amount: unmappedGlResidual,
      source: 'reconciliation',
      status: glAccountBalance != null && unmappedGlResidual != null ? 'ok' : 'pending_mapping',
      note: unmappedNote,
    });
  }

  if (controlKind === 'ap') {
    let sumPartyAp = 0;
    const glRpc = await supabase.rpc('get_contact_party_gl_balances', {
      p_company_id: companyId,
      p_branch_id: b,
    });
    if (!glRpc.error && Array.isArray(glRpc.data)) {
      const rows = glRpc.data as { contact_id: string; gl_ap_payable?: number | string }[];
      sumPartyAp = rows.reduce((s, r) => s + (Number(r.gl_ap_payable ?? 0) || 0), 0);
      partyAttributedGlSum = roundMoney(sumPartyAp);
      const ids = rows.filter((r) => Number(r.gl_ap_payable ?? 0) !== 0).map((r) => r.contact_id);
      const names = await loadContactNames(companyId, ids);
      partyRows = rows
        .map((r) => ({
          contactId: r.contact_id,
          name: names.get(r.contact_id) || r.contact_id,
          glAmount: Number(r.gl_ap_payable ?? 0) || 0,
          kind: 'ap' as const,
        }))
        .filter((r) => Math.abs(r.glAmount) > 0.0001)
        .sort((a, b) => Math.abs(b.glAmount) - Math.abs(a.glAmount));
    } else {
      partySectionNote = 'Party GL slice unavailable (RPC error).';
    }

    unmappedGlByReference = await fetchUnmappedPartyGlBuckets(companyId, b, accountCode || '2000');

    // AP GL control is liability: compare net credit = -balance if balance is Dr-Cr
    const apNetCredit = glAccountBalance != null ? -glAccountBalance : null;
    if (apNetCredit != null) {
      unmappedGlResidual = Math.round((apNetCredit - sumPartyAp) * 100) / 100;
      const bucketSum = roundMoney(unmappedGlByReference.reduce((s, x) => s + x.amount, 0));
      unmappedNote =
        'AP net (Cr−Dr) on **account code 2000** minus Σ party AP from resolver (all contacts). Unmapped buckets use Cr−Dr per line.';
      if (unmappedGlByReference.length > 0) {
        unmappedNote += ` Unmapped buckets sum: ${roundMoney(bucketSum)} (Cr−Dr) — expect ≈ residual with migration get_control_unmapped_party_gl_buckets.`;
      }
    }

    try {
      let qPur = supabase
        .from('purchases')
        .select('due_amount, total, paid_amount, status, supplier_id')
        .eq('company_id', companyId)
        .in('status', ['received', 'final', 'ordered']);
      if (b) qPur = qPur.eq('branch_id', b);
      const { data: purchases } = await qPur;
      const { data: supContacts } = await supabase
        .from('contacts')
        .select('id, type, name')
        .eq('company_id', companyId)
        .in('type', ['supplier', 'both']);
      const supplierIds = new Set((supContacts || []).map((c: any) => c.id));
      let supplierDue = 0;
      let otherDue = 0;
      (purchases || []).forEach((p: any) => {
        const due = Math.max(0, Number(p.due_amount ?? 0) || (Number(p.total) || 0) - (Number(p.paid_amount) || 0));
        if (due <= 0) return;
        if (p.supplier_id && supplierIds.has(p.supplier_id)) supplierDue += due;
        else otherDue += due;
      });
      subcategories.push({
        label: 'Supplier payables (purchases due, supplier/both contact)',
        amount: Math.round(supplierDue * 100) / 100,
        source: 'operational',
        status: 'ok',
      });
      subcategories.push({
        label: 'Courier / other vendor payables (purchases due, supplier not in supplier/both contacts)',
        amount: Math.round(otherDue * 100) / 100,
        source: 'operational',
        status: otherDue > 0 ? 'pending_mapping' : 'ok',
        note:
          otherDue > 0
            ? 'Includes purchases whose supplier_id is not a supplier/both contact row — may be courier or data gap; not a courier subtype split.'
            : undefined,
      });
      subcategories.push({
        label: 'Manual / unmatched payables (operational)',
        amount: null,
        source: 'operational',
        status: 'pending_mapping',
        note: 'Not split: manual_payment / non-purchase AP without stable categorization here.',
      });

      const rpcPayTotal =
        !opMapError ? [...opMap.values()].reduce((s, v) => s + (Number(v.payables) || 0), 0) : null;
      subcategories.push({
        label: 'Total operational payables (get_contact_balances_summary sum)',
        amount: rpcPayTotal,
        source: 'operational',
        status: rpcPayTotal != null ? 'ok' : 'unavailable',
      });
    } catch (e) {
      subcategories.push({
        label: 'Operational subcategory detail',
        amount: null,
        source: 'operational',
        status: 'unavailable',
        note: e instanceof Error ? e.message : 'Query failed',
      });
    }

    subcategories.push({
      label: 'Sum party-attributed AP (get_contact_party_gl_balances)',
      amount: partySectionNote ? null : roundMoney(sumPartyAp),
      source: 'gl',
      status: partySectionNote ? 'unavailable' : 'ok',
      note: 'Σ gl_ap_payable over **all** contacts (signed). Resolver uses **code 2000** account id only.',
    });
    if (
      glSubtreeDrMinusCr != null &&
      glAccountBalance != null &&
      Math.abs(glSubtreeDrMinusCr - glAccountBalance) >= 0.02
    ) {
      subcategories.push({
        label: 'Subtree TB (control id + descendants, Dr−Cr)',
        amount: glSubtreeDrMinusCr,
        source: 'gl',
        status: 'ok',
        note: 'If payables post to child AP accounts, subtree may exceed single-id TB; party list stays on code 2000.',
      });
    }
    subcategories.push({
      label: 'Residual / unmatched on 2000 (AP net credit − party sum)',
      amount: unmappedGlResidual,
      source: 'reconciliation',
      status: apNetCredit != null && unmappedGlResidual != null ? 'ok' : 'pending_mapping',
      note: unmappedNote,
    });
  }

  if (controlKind === 'worker_payable' || controlKind === 'worker_advance') {
    partySectionNote =
      controlKind === 'worker_payable'
        ? 'Per-party amount = GL worker net (WP−WA) from journal resolver — not 2010-only.'
        : 'Party rows show **net worker GL** (WP−WA), not 1180 advance-only; per-party advance split is pending_mapping.';

    const glRpc = await supabase.rpc('get_contact_party_gl_balances', {
      p_company_id: companyId,
      p_branch_id: b,
    });
    if (!glRpc.error && Array.isArray(glRpc.data)) {
      const rows = glRpc.data as { contact_id: string; gl_worker_payable?: number | string }[];
      const ids = rows.filter((r) => Number(r.gl_worker_payable ?? 0) !== 0).map((r) => r.contact_id);
      const names = await loadContactNames(companyId, ids);
      partyRows = rows
        .map((r) => ({
          contactId: r.contact_id,
          name: names.get(r.contact_id) || r.contact_id,
          glAmount: Number(r.gl_worker_payable ?? 0) || 0,
          kind: 'worker_net' as const,
        }))
        .filter((r) => Math.abs(r.glAmount) > 0.0001)
        .sort((a, b) => Math.abs(b.glAmount) - Math.abs(a.glAmount));
      if (partyRows.length > 0) {
        const { data: ctype } = await supabase
          .from('contacts')
          .select('id, type')
          .eq('company_id', companyId)
          .in(
            'id',
            partyRows.map((p) => p.contactId)
          );
        const workerIds = new Set(
          (ctype || []).filter((c: any) => String(c.type || '').toLowerCase() === 'worker').map((c: any) => c.id)
        );
        partyRows = partyRows.filter((p) => workerIds.has(p.contactId));
      }
    }

    if (controlKind === 'worker_payable') {
      partyAttributedGlSum = roundMoney(partyRows.reduce((s, p) => s + p.glAmount, 0));
      unmappedGlByReference = await fetchUnmappedPartyGlBuckets(companyId, b, accountCode || '2010');
    } else {
      unmappedGlByReference = await fetchUnmappedPartyGlBuckets(companyId, b, accountCode || '1180');
    }

    unmappedGlResidual = null;
    unmappedNote =
      controlKind === 'worker_payable'
        ? 'Party sum = Σ worker_net (WP−WA) for **worker** contacts. Unmapped buckets below are **2010 only** (Cr−Dr) where party_id is null — not the same as WP−WA residual.'
        : 'Per-party 1180 (advance) split not computed here — use GL statement and worker payment JEs. Unmapped buckets = **1180** lines without party (Dr−Cr).';

    if (controlKind === 'worker_payable') {
      try {
        const { data: wle } = await supabase
          .from('worker_ledger_entries')
          .select('amount, status')
          .eq('company_id', companyId);
        const unpaid = (wle || []).filter((r: any) => String(r.status || '').toLowerCase() !== 'paid');
        const unpaidSum = unpaid.reduce((s, r: any) => s + Math.max(0, Number(r.amount) || 0), 0);
        subcategories.push({
          label: 'Unpaid worker ledger entries (operational, company total)',
          amount: Math.round(unpaidSum * 100) / 100,
          source: 'operational',
          status: 'ok',
          note: 'All unpaid worker_ledger rows — not allocated to 2010 only.',
        });

        let workerRpcPayTotal: number | null = null;
        if (!opMapError) {
          const { data: wkRows } = await supabase
            .from('contacts')
            .select('id')
            .eq('company_id', companyId)
            .eq('type', 'worker');
          workerRpcPayTotal = (wkRows || []).reduce((s, c: { id: string }) => {
            const row = opMap.get(String(c.id));
            return s + (row ? Number(row.payables) || 0 : 0);
          }, 0);
        }
        subcategories.push({
          label: 'Total worker operational pending (get_contact_balances_summary, worker contacts)',
          amount: workerRpcPayTotal != null ? roundMoney(workerRpcPayTotal) : null,
          source: 'operational',
          status: workerRpcPayTotal != null ? 'ok' : 'unavailable',
          note:
            workerRpcPayTotal != null
              ? 'Same RPC scope as Contacts Workers payables column; compare to worker_ledger unpaid and 2010 GL buckets (not interchangeable).'
              : 'RPC unavailable — cannot sum worker operational pending here.',
        });

        const agg = await aggregateLineNetByJeReferenceType(companyId, accountId, b, 'cr_minus_dr');
        if (agg.truncated) {
          subcategories.push({
            label: '2010 journal lines by reference_type',
            amount: null,
            source: 'gl',
            status: 'unavailable',
            note: `Line cap ${MAX_LINES_REF_BREAKDOWN} exceeded — open GL ledger for full detail.`,
          });
        } else {
          const m = agg.map;
          const bills =
            (m.get('studio_production_stage') || 0) + (m.get('studio_production_stage_reversal') || 0);
          const settle = m.get('worker_advance_settlement') || 0;
          const wpay = m.get('worker_payment') || 0;
          let other = 0;
          for (const [k, v] of m) {
            if (
              ![
                'studio_production_stage',
                'studio_production_stage_reversal',
                'worker_advance_settlement',
                'worker_payment',
              ].includes(k)
            ) {
              other += v;
            }
          }
          subcategories.push({
            label: 'Worker bills (2010, studio_production_stage ± reversal)',
            amount: roundMoney(bills),
            source: 'gl',
            status: 'ok',
            note: 'Net credit − debit on 2010 for stage JEs (journal truth).',
          });
          subcategories.push({
            label: 'Advance settlements on bill (2010, worker_advance_settlement)',
            amount: roundMoney(settle),
            source: 'gl',
            status: 'ok',
          });
          subcategories.push({
            label: 'Worker payments hitting 2010 (worker_payment)',
            amount: roundMoney(wpay),
            source: 'gl',
            status: 'ok',
            note: 'Typically post-bill Dr 2010; pre-bill may post to 1180 instead.',
          });
          subcategories.push({
            label: 'Other reference types on 2010 (residual / unmatched)',
            amount: roundMoney(other),
            source: 'gl',
            status: Math.abs(other) > 0.01 ? 'pending_mapping' : 'ok',
            note: 'Anything not in stage / settlement / worker_payment buckets on this account.',
          });
        }

        const sumPartyWk = partyRows.reduce((s, p) => s + p.glAmount, 0);
        subcategories.push({
          label: 'Sum party worker net (get_contact_party_gl_balances, worker contacts)',
          amount: roundMoney(sumPartyWk),
          source: 'gl',
          status: 'ok',
          note: 'WP−WA per party — same basis as party list below.',
        });
        subcategories.push({
          label: 'Residual / unmatched (2010 vs party net)',
          amount: null,
          source: 'reconciliation',
          status: 'pending_mapping',
          note: unmappedNote || undefined,
        });
      } catch (e) {
        subcategories.push({
          label: 'Worker operational / GL detail',
          amount: null,
          source: 'operational',
          status: 'unavailable',
          note: e instanceof Error ? e.message : 'Query failed',
        });
      }
    }

    if (controlKind === 'worker_advance') {
      try {
        const agg = await aggregateLineNetByJeReferenceType(companyId, accountId, b, 'dr_minus_cr');
        if (agg.truncated) {
          subcategories.push({
            label: '1180 journal lines by reference_type',
            amount: null,
            source: 'gl',
            status: 'unavailable',
            note: `Line cap ${MAX_LINES_REF_BREAKDOWN} exceeded — open GL ledger for full detail.`,
          });
        } else {
          const m = agg.map;
          const pre = m.get('worker_payment') || 0;
          const settle = m.get('worker_advance_settlement') || 0;
          let other = 0;
          for (const [k, v] of m) {
            if (!['worker_payment', 'worker_advance_settlement'].includes(k)) other += v;
          }
          subcategories.push({
            label: 'Pre-bill advances (1180, worker_payment)',
            amount: roundMoney(pre),
            source: 'gl',
            status: 'ok',
            note: 'Net Dr − Cr on 1180 for worker_payment JEs.',
          });
          subcategories.push({
            label: 'Settlements clearing advance (1180, worker_advance_settlement)',
            amount: roundMoney(settle),
            source: 'gl',
            status: 'ok',
            note: 'Typically Cr 1180 when applying advance to bill.',
          });
          subcategories.push({
            label: 'Other reference types on 1180 (residual / unmatched)',
            amount: roundMoney(other),
            source: 'gl',
            status: Math.abs(other) > 0.01 ? 'pending_mapping' : 'ok',
          });
        }
        subcategories.push({
          label: 'Party list (worker net WP−WA)',
          amount: null,
          source: 'gl',
          status: 'unavailable',
          note: 'Per-party advance-only on 1180 is not in get_contact_party_gl_balances — party rows below are net worker GL.',
        });
      } catch (e) {
        subcategories.push({
          label: '1180 GL breakdown',
          amount: null,
          source: 'gl',
          status: 'unavailable',
          note: e instanceof Error ? e.message : 'Query failed',
        });
      }
    }
  }

  if (controlKind === 'suspense') {
    partyRows = [];
    partySectionNote = 'Suspense is not party-mapped in this breakdown.';
    try {
      let q = supabase
        .from('journal_entry_lines')
        .select(
          `
          debit,
          credit,
          journal_entry:journal_entries(reference_type, is_void, branch_id, company_id)
        `
        )
        .eq('account_id', accountId);
      const { data: lines, error } = await q;
      if (error) throw new Error(error.message);
      const byRt = new Map<string, { debit: number; credit: number }>();
      (lines || []).forEach((row: any) => {
        const je = row.journal_entry;
        if (!je || je.company_id !== companyId) return;
        if (je.is_void) return;
        if (b && je.branch_id && je.branch_id !== b) return;
        const rt = String(je.reference_type || '(blank)').toLowerCase() || '(blank)';
        const cur = byRt.get(rt) || { debit: 0, credit: 0 };
        cur.debit += Number(row.debit) || 0;
        cur.credit += Number(row.credit) || 0;
        byRt.set(rt, cur);
      });
      const entries = [...byRt.entries()].sort((a, b) => b[1].debit + b[1].credit - (a[1].debit + a[1].credit));
      entries.forEach(([rt, v]) => {
        const net = v.debit - v.credit;
        subcategories.push({
          label: `JE reference_type: ${rt}`,
          amount: Math.round(net * 100) / 100,
          source: 'gl',
          status: 'ok',
          note: 'Net Dr−Cr on 1195 for this reference_type (life-to-date, branch filter if set).',
        });
      });
      if (entries.length === 0) {
        subcategories.push({
          label: 'Suspense line detail',
          amount: null,
          source: 'gl',
          status: 'unavailable',
          note: 'No lines found for this account.',
        });
      }
      subcategories.push({
        label: 'AR/AP tagged manual adjustments vs unresolved recon items',
        amount: null,
        source: 'reconciliation',
        status: 'pending_mapping',
        note: 'Use AR/AP Reconciliation Center for workflow state; not duplicated here.',
      });
    } catch (e) {
      subcategories.push({
        label: 'Suspense breakdown',
        amount: null,
        source: 'gl',
        status: 'unavailable',
        note: e instanceof Error ? e.message : 'Query failed',
      });
    }
  }

  return {
    controlKind,
    accountId,
    accountCode,
    accountName,
    asOfDate: asOf,
    glAccountBalance,
    glBalanceStatus,
    glBalanceNote,
    subcategories,
    partyRows,
    partySectionNote,
    unmappedGlResidual,
    unmappedNote,
    partyAttributedGlSum,
    unmappedGlByReference,
    glSubtreeDrMinusCr,
  };
}
