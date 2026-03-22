/**
 * Developer Accounting Test Bench — trace search, rule validation, anomaly listing.
 * Read-only / advisory; uses Supabase client (RLS applies).
 */

import { supabase } from '@/lib/supabase';
import {
  SALE_BUSINESS_ONLY_STATUSES,
  SALE_POSTED_ACCOUNTING_STATUS,
  PURCHASE_BUSINESS_ONLY_STATUSES,
  PURCHASE_POSTED_ACCOUNTING_STATUSES,
} from '@/app/lib/documentStatusConstants';
import {
  getWorkerAdvanceAccountId,
  getWorkerNetAdvanceBalanceFromJournals,
  shouldDebitWorkerPayableForPayment,
} from '@/app/services/workerAdvanceService';
import { accountingReportsService } from '@/app/services/accountingReportsService';
import type { AccountingUiRef } from '@/app/lib/accountingDisplayReference';
import {
  buildTechnicalRef,
  formatJournalEntryBadge,
  sourceLabelFromReferenceType,
} from '@/app/lib/accountingDisplayReference';
import { getSaleDisplayNumber, getPurchaseDisplayNumber } from '@/app/lib/documentDisplayNumbers';
import { resolveJournalUiRefsByJournalIds, searchJournalIdsByDisplayRef } from '@/app/services/accountingDisplayRefResolver';

const EPS = 0.01;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type DiagnosticsSeverity = 'clean' | 'info' | 'warning' | 'error';

export interface DiagnosticsRuleHit {
  ruleId: string;
  title: string;
  severity: DiagnosticsSeverity;
  detail: string;
  suggestedAction?: string;
  /** Set when produced from a specific journal in a trace */
  journalId?: string;
  /**
   * When true: still listed in trace/detail for audit, but excluded from scan row severity,
   * rule violation counts, and fix queue eligibility (policy / expected states).
   */
  ignoredForLabRollup?: boolean;
}

/** Static catalog — RULE_XX codes align with Developer Integrity Lab spec. */
export const DIAGNOSTICS_RULE_CATALOG: {
  id: string;
  title: string;
  defaultSeverity: DiagnosticsSeverity;
  module?: string;
}[] = [
  { id: 'RULE_01', title: 'Draft purchase has GL activity (unexpected)', defaultSeverity: 'info', module: 'purchase' },
  { id: 'RULE_02', title: 'Draft sale has GL activity (unexpected)', defaultSeverity: 'info', module: 'sales' },
  { id: 'RULE_03', title: 'Worker payment vs advance/payable (ledger heuristic)', defaultSeverity: 'warning', module: 'studio' },
  { id: 'RULE_04', title: 'Worker bill finalization: Dr 5000 / Cr 2010', defaultSeverity: 'error', module: 'studio' },
  { id: 'RULE_05', title: 'Worker advance settlement: Dr 2010 / Cr 1180 pattern', defaultSeverity: 'error', module: 'studio' },
  { id: 'RULE_06', title: 'Worker payment vs advance/payable (ledger heuristic)', defaultSeverity: 'warning', module: 'studio' },
  { id: 'RULE_07', title: 'Manual JE on control account (1100/1180/1195/2000/2010)', defaultSeverity: 'warning', module: 'gl' },
  { id: 'RULE_08', title: 'Sensitive GL line — document reference / payment link', defaultSeverity: 'error', module: 'gl' },
  { id: 'RULE_09', title: 'Duplicate canonical sale/purchase JE (no payment_id)', defaultSeverity: 'error', module: 'gl' },
  { id: 'RULE_10', title: 'Voided JE — reporting policy (informational)', defaultSeverity: 'info', module: 'gl' },
  { id: 'RULE_10B', title: 'Voided JE with payment_id (informational)', defaultSeverity: 'info', module: 'gl' },
  { id: 'RULE_11', title: 'Unusual sign on sensitive account (heuristic)', defaultSeverity: 'info', module: 'gl' },
  { id: 'RULE_12', title: 'Suspense 1195 — review in AR/AP Reconciliation Center', defaultSeverity: 'info', module: 'reconciliation' },
  { id: 'RULE_13', title: 'Unlinked AR/AP context (heuristic)', defaultSeverity: 'warning', module: 'reconciliation' },
  { id: 'RULE_14', title: 'Draft / operational-only document context', defaultSeverity: 'info', module: 'general' },
  { id: 'RULE_15', title: 'Bill posted — verify advance settlement if prepaid', defaultSeverity: 'warning', module: 'studio' },
  { id: 'RULE_W01', title: 'Unusual sale status with JE', defaultSeverity: 'warning', module: 'sales' },
  { id: 'RULE_W02', title: 'Unusual purchase status with JE', defaultSeverity: 'warning', module: 'purchase' },
  { id: 'RULE_W03', title: 'Weak document link (manual journal)', defaultSeverity: 'warning', module: 'gl' },
];

export interface LineWithAccount {
  id?: string;
  debit: number;
  credit: number;
  description?: string | null;
  account_id: string;
  account_code?: string | null;
  account_name?: string | null;
}

export interface JournalTraceRow {
  id: string;
  entry_no: string | null;
  entry_date: string | null;
  description: string | null;
  reference_type: string | null;
  reference_id: string | null;
  company_id: string;
  branch_id: string | null;
  is_void: boolean | null;
  payment_id: string | null;
  lines: LineWithAccount[];
}

export interface TraceEntitySummary {
  kind: 'sale' | 'purchase' | 'payment' | 'worker' | 'stage' | 'journal' | 'none';
  id: string;
  label: string;
  status?: string | null;
  branch_id?: string | null;
  extra?: Record<string, unknown>;
}

export interface ExpectedLine {
  side: 'dr' | 'cr';
  account_code: string;
  amount: number;
  note: string;
}

export interface TraceSearchResult {
  query: string;
  mode: string;
  overall: DiagnosticsSeverity;
  entities: TraceEntitySummary[];
  journals: JournalTraceRow[];
  /** Resolved human-facing refs per journal id (same keys as journals[].id) */
  journalUiRefs?: Record<string, AccountingUiRef>;
  ruleHits: DiagnosticsRuleHit[];
  expectedVsActual?: {
    journalId: string;
    expected: ExpectedLine[];
    actual: ExpectedLine[];
    diffNote: string;
    tbImpact: string;
    suggestedAction: string;
  }[];
  sourceDocNarrative: string;
  /** Trace UX: resolution + next steps (single path) */
  traceGuidance?: {
    sourceResolved: boolean;
    sourceSummary: string;
    expectedPostingSummary: string[];
    actualPostingSummary: string[];
    nextSteps: string[];
  };
}

export interface JournalAnomalyRow {
  journalId: string;
  entryNo: string | null;
  entryDate: string | null;
  referenceType: string | null;
  referenceId: string | null;
  /** From journal_entries.payment_id when present */
  paymentId?: string | null;
  /** Batch-resolved display layer */
  uiRef?: AccountingUiRef;
  severity: DiagnosticsSeverity;
  badges: string[];
  summary: string;
  ruleIds: string[];
  /** Full rule hits for this JE (single scan source of truth) */
  hits: DiagnosticsRuleHit[];
  /** Account codes touched on this JE (for health aggregation) */
  touchedAccountCodes: string[];
  /** Eligible for fix queue (excludes info-only / policy / suspense hints) */
  actionableForQueue: boolean;
  /** Why this row has its severity */
  severityReason: string;
}

export interface AccountHealthRow {
  code: string;
  name: string;
  accountId: string;
  /** Journal-derived balance (TB SOT — same engine as Trial Balance) */
  journalBalance?: number;
  /** accounts.balance cache — secondary */
  storedBalance?: number;
  /** storedBalance − journalBalance (materiality heuristic) */
  balanceVariance?: number;
  anomalyCount: number;
  latestAnomalies: {
    journalId: string;
    entryNo: string | null;
    summary: string;
    severity: DiagnosticsSeverity;
    displayRef?: string;
    sourceLabel?: string;
    technicalRef?: string;
  }[];
}

async function fetchAccountsByIds(ids: string[]): Promise<Map<string, { code: string; name: string }>> {
  const uniq = [...new Set(ids.filter(Boolean))];
  const map = new Map<string, { code: string; name: string }>();
  if (!uniq.length) return map;
  const chunk = 80;
  for (let i = 0; i < uniq.length; i += chunk) {
    const { data } = await supabase.from('accounts').select('id, code, name').in('id', uniq.slice(i, i + chunk));
    for (const a of data || []) {
      map.set((a as { id: string }).id, {
        code: String((a as { code?: string }).code || ''),
        name: String((a as { name?: string }).name || ''),
      });
    }
  }
  return map;
}

export async function loadJournalWithLines(companyId: string, journalId: string): Promise<JournalTraceRow | null> {
  const { data: je, error } = await supabase
    .from('journal_entries')
    .select('*')
    .eq('company_id', companyId)
    .eq('id', journalId)
    .maybeSingle();
  if (error || !je) return null;
  const { data: rawLines } = await supabase.from('journal_entry_lines').select('*').eq('journal_entry_id', journalId);
  const accountIds = (rawLines || []).map((l: { account_id: string }) => l.account_id);
  const accMap = await fetchAccountsByIds(accountIds);
  const lines: LineWithAccount[] = (rawLines || []).map((l: any) => ({
    id: l.id,
    debit: Number(l.debit) || 0,
    credit: Number(l.credit) || 0,
    description: l.description,
    account_id: l.account_id,
    account_code: accMap.get(l.account_id)?.code ?? null,
    account_name: accMap.get(l.account_id)?.name ?? null,
  }));
  const row = je as Record<string, unknown>;
  return {
    id: row.id as string,
    entry_no: (row.entry_no as string) ?? null,
    entry_date: (row.entry_date as string) ?? null,
    description: (row.description as string) ?? null,
    reference_type: (row.reference_type as string) ?? null,
    reference_id: (row.reference_id as string) ?? null,
    company_id: row.company_id as string,
    branch_id: (row.branch_id as string) ?? null,
    is_void: (row.is_void as boolean) ?? null,
    payment_id: (row.payment_id as string) ?? null,
    lines,
  };
}

function linesToExpectedActual(lines: LineWithAccount[]): ExpectedLine[] {
  const out: ExpectedLine[] = [];
  for (const l of lines) {
    const code = l.account_code || l.account_id.slice(0, 8);
    if (l.debit > EPS) out.push({ side: 'dr', account_code: code, amount: l.debit, note: l.description || '' });
    if (l.credit > EPS) out.push({ side: 'cr', account_code: code, amount: l.credit, note: l.description || '' });
  }
  return out;
}

function compareExpectedActual(expected: ExpectedLine[], actual: ExpectedLine[]): string {
  const key = (x: ExpectedLine) => `${x.side}|${x.account_code}|${x.amount.toFixed(2)}`;
  const expSet = new Set(expected.map(key));
  const actSet = new Set(actual.map(key));
  const missing = expected.filter((e) => !actSet.has(key(e)));
  const extra = actual.filter((a) => !expSet.has(key(a)));
  const parts: string[] = [];
  if (missing.length) parts.push(`Missing expected: ${missing.map((m) => `${m.side} ${m.account_code} ${m.amount}`).join('; ')}`);
  if (extra.length) parts.push(`Unexpected lines: ${extra.map((m) => `${m.side} ${m.account_code} ${m.amount}`).join('; ')}`);
  if (!parts.length) return 'GL lines match expected pattern.';
  return parts.join(' ');
}

async function rulesForJournal(companyId: string, je: JournalTraceRow): Promise<DiagnosticsRuleHit[]> {
  const hits: DiagnosticsRuleHit[] = [];
  const rt = (je.reference_type || '').toLowerCase();
  const voided = je.is_void === true;

  const SENSITIVE_CODES = ['1100', '1180', '1195', '2000', '2010'];
  const linesTouchSensitive = je.lines.some((l) => SENSITIVE_CODES.includes(l.account_code || ''));

  if (voided) {
    hits.push({
      ruleId: 'RULE_10',
      title: 'Voided journal — TB / report policy',
      severity: 'info',
      detail: 'Entry is voided; TB / feeds should exclude voids per policy — informational.',
      suggestedAction: 'Confirm Trial Balance and reconciliation filters exclude voided JEs.',
      ignoredForLabRollup: true,
    });
    if (je.payment_id) {
      hits.push({
        ruleId: 'RULE_10B',
        title: 'Voided JE still linked to payment',
        severity: 'info',
        detail: 'payment_id is set on a voided JE — trace only; verify payment workflow if investigating duplicates.',
        suggestedAction: 'Review payment + void workflow if amounts look duplicated in ops views.',
        ignoredForLabRollup: true,
      });
    }
  }

  if (!je.reference_type || je.reference_type === 'journal') {
    const codes = je.lines.map((l) => l.account_code || '');
    const touched = codes.filter((c) => SENSITIVE_CODES.includes(c));
    if (touched.length) {
      hits.push({
        ruleId: 'RULE_07',
        title: 'Manual / unclassified JE on control account',
        severity: 'warning',
        detail: `Lines touch control account(s): ${touched.join(', ')} without canonical reference_type.`,
        suggestedAction: 'Review business source; prefer typed flows (sale, payment, worker_payment, etc.).',
      });
    }
  }

  if (
    linesTouchSensitive &&
    (!je.reference_type || !je.reference_id) &&
    !voided
  ) {
    const linkedViaPayment = Boolean(je.payment_id);
    hits.push({
      ruleId: 'RULE_08',
      title: linkedViaPayment
        ? 'Sensitive GL line — weak document reference (payment-linked JE)'
        : 'Sensitive account line without document reference',
      severity: linkedViaPayment ? 'warning' : 'error',
      detail: linkedViaPayment
        ? 'AR/AP/worker/suspense touched; reference_type/id missing but payment_id is set — often valid for payment/settlement JEs; confirm trace.'
        : 'Posting hits AR/AP/worker/suspense but journal is missing reference_type or reference_id.',
      suggestedAction: linkedViaPayment
        ? 'Trace via payment row; add reference if policy requires typed document link.'
        : 'Relink to source document or reverse and repost via canonical flow.',
    });
  }

  if (je.lines.some((l) => l.account_code === '1195')) {
    hits.push({
      ruleId: 'RULE_12',
      title: 'Suspense 1195 touched',
      severity: 'info',
      detail: 'AR/AP reconciliation suspense — clear via Reconciliation Center when matched.',
      suggestedAction: 'Open AR/AP Reconciliation Center; resolve suspense items.',
    });
  }

  if (!voided && rt === 'sale' && je.reference_id) {
    const { data: sale } = await supabase
      .from('sales')
      .select('id, status, invoice_no, branch_id')
      .eq('company_id', companyId)
      .eq('id', je.reference_id)
      .maybeSingle();
    if (sale) {
      const st = String((sale as { status?: string }).status || '').toLowerCase();
      if ((SALE_BUSINESS_ONLY_STATUSES as readonly string[]).includes(st)) {
        hits.push({
          ruleId: 'RULE_02',
          title: 'Draft / non-final sale shows GL activity (unexpected)',
          severity: 'info',
          detail: `Sale ${(sale as { invoice_no?: string }).invoice_no || je.reference_id} status=${st} — no posting usually expected until final; review if JE is historical/void counterpart.`,
          suggestedAction: 'Confirm sale lifecycle vs posting; void stray JEs if needed.',
          ignoredForLabRollup: true,
        });
      } else if (st !== SALE_POSTED_ACCOUNTING_STATUS && st !== 'cancelled') {
        hits.push({
          ruleId: 'RULE_W01',
          title: 'Unusual sale status with JE',
          severity: 'warning',
          detail: `Sale status=${st}`,
        });
      }
    }
  }

  if (!voided && rt === 'purchase' && je.reference_id) {
    const { data: pur } = await supabase
      .from('purchases')
      .select('id, status, po_no, branch_id')
      .eq('company_id', companyId)
      .eq('id', je.reference_id)
      .maybeSingle();
    if (pur) {
      const st = String((pur as { status?: string }).status || '').toLowerCase();
      if ((PURCHASE_BUSINESS_ONLY_STATUSES as readonly string[]).includes(st)) {
        hits.push({
          ruleId: 'RULE_01',
          title: 'Draft / non-posted purchase shows GL activity (unexpected)',
          severity: 'info',
          detail: `Purchase ${(pur as { po_no?: string }).po_no || je.reference_id} status=${st} — no AP/stock GL usually expected until posted; review if JE is valid correction.`,
          suggestedAction: 'Confirm purchase lifecycle vs posting; void stray JEs if needed.',
          ignoredForLabRollup: true,
        });
      } else if (!(PURCHASE_POSTED_ACCOUNTING_STATUSES as readonly string[]).includes(st) && st !== 'cancelled') {
        hits.push({
          ruleId: 'RULE_W02',
          title: 'Unusual purchase status with JE',
          severity: 'warning',
          detail: `Purchase status=${st}`,
        });
      }
    }
  }

  if (!voided && rt === 'studio_production_stage' && je.lines.length >= 2) {
    const has5000Dr = je.lines.some((l) => l.account_code === '5000' && l.debit > EPS);
    const has2010Cr = je.lines.some((l) => l.account_code === '2010' && l.credit > EPS);
    if (!has5000Dr || !has2010Cr) {
      hits.push({
        ruleId: 'RULE_04',
        title: 'Stage bill JE pattern',
        severity: 'error',
        detail: 'Expected Dr 5000 (Cost of Production) and Cr 2010 (Worker Payable).',
        suggestedAction: 'Compare to studioProductionService.createProductionCostJournalEntry.',
      });
    }
    if (je.reference_id && has5000Dr && has2010Cr) {
      const { data: stage } = await supabase
        .from('studio_production_stages')
        .select('assigned_worker_id, cost')
        .eq('id', je.reference_id)
        .maybeSingle();
      const wid = (stage as { assigned_worker_id?: string } | null)?.assigned_worker_id;
      if (wid) {
        const advBal = await getWorkerNetAdvanceBalanceFromJournals(companyId, wid);
        if (advBal > EPS) {
          hits.push({
            ruleId: 'RULE_15',
            title: 'Bill posted — verify advance settlement',
            severity: 'warning',
            detail: `Worker still shows net advance ${advBal.toFixed(2)} on 1180; confirm Dr 2010/Cr 1180 was posted for this bill if applicable.`,
            suggestedAction: 'Trace worker_advance_settlement JEs; re-run worker advance apply if missing.',
          });
        }
      }
    }
  }

  if (!voided && rt === 'worker_advance_settlement' && je.lines.length >= 2) {
    const has2010Dr = je.lines.some((l) => l.account_code === '2010' && l.debit > EPS);
    const has1180Cr = je.lines.some((l) => l.account_code === '1180' && l.credit > EPS);
    if (!has2010Dr || !has1180Cr) {
      hits.push({
        ruleId: 'RULE_05',
        title: 'Worker advance settlement pattern',
        severity: 'error',
        detail: 'Expected Dr 2010 and Cr 1180.',
        suggestedAction: 'See workerAdvanceService.applyWorkerAdvanceAgainstNewBill.',
      });
    }
  }

  if (!voided && rt === 'worker_payment' && je.reference_id && je.lines.length >= 2) {
    const payToPayable = await shouldDebitWorkerPayableForPayment(companyId, je.reference_id, null, je.branch_id);
    const debitLine = je.lines.find((l) => l.debit > EPS);
    const code = debitLine?.account_code || '';
    const advId = await getWorkerAdvanceAccountId(companyId);
    const { data: wp } = await supabase
      .from('accounts')
      .select('id, code')
      .eq('company_id', companyId)
      .or('code.eq.2010,name.ilike.%Worker Payable%')
      .limit(1)
      .maybeSingle();
    const wpId = (wp as { id?: string } | null)?.id;
    const wrongAdvance =
      !payToPayable && (code === '2010' || (wpId && debitLine?.account_id === wpId));
    const wrongPayable =
      payToPayable && advId && debitLine?.account_id === advId && code === '1180';
    if (wrongAdvance) {
      hits.push({
        ruleId: 'RULE_03',
        title: 'Worker payment debit vs routing heuristic',
        severity: 'warning',
        detail:
          'Routing expected Dr 1180 (no unpaid bill / no GL net payable) but main debit is 2010. May still be valid (manual adjustment). Verify.',
        suggestedAction:
          'Cross-check worker_ledger, stage-bill JEs, and get_contact_party_gl_balances worker column; use trace before reposting.',
      });
    }
    if (wrongPayable) {
      hits.push({
        ruleId: 'RULE_06',
        title: 'Worker payment debit vs routing heuristic',
        severity: 'warning',
        detail:
          'Routing expected Dr 2010 (unpaid bill / stage JE / GL net payable) but main debit is 1180. May be valid for pure prepayment; verify.',
        suggestedAction:
          'Cross-check worker_ledger, stage-bill JEs, GL worker net, and createWorkerPayment routing.',
      });
    }
  }

  /** Canonical document JE only: excludes payment-linked & void rows */
  if (
    !voided &&
    je.reference_id &&
    ['sale', 'purchase'].includes(rt) &&
    !je.payment_id
  ) {
    const { count, error } = await supabase
      .from('journal_entries')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('reference_type', je.reference_type)
      .eq('reference_id', je.reference_id)
      .is('payment_id', null)
      .or('is_void.is.null,is_void.eq.false');
    if (!error && (count ?? 0) > 1) {
      hits.push({
        ruleId: 'RULE_09',
        title: 'Duplicate canonical document JE (same sale/purchase, no payment link)',
        severity: 'error',
        detail: `Found ${count} active JEs with same ${je.reference_type} reference and payment_id empty — expected a single recognition JE; payment/settlement uses payment_id or other reference types.`,
        suggestedAction: 'Void duplicate recognition JE; keep one canonical document posting.',
      });
    }
  }

  const unknownRefs = ['', 'null', 'manual', 'journal', 'adjustment'];
  if (je.reference_type && unknownRefs.includes(rt) && !je.payment_id) {
    hits.push({
      ruleId: 'RULE_W03',
      title: 'Weak document link',
      severity: 'warning',
      detail: `reference_type=${je.reference_type} and no payment_id — harder to trace.`,
    });
  }

  return hits;
}

function buildExpectedForJournal(je: JournalTraceRow): ExpectedLine[] | null {
  const rt = (je.reference_type || '').toLowerCase();
  if (rt === 'studio_production_stage') {
    const amt = je.lines.reduce((s, l) => s + (l.debit > EPS ? l.debit : 0), 0);
    if (amt <= EPS) return null;
    return [
      { side: 'dr', account_code: '5000', amount: amt, note: 'Production cost' },
      { side: 'cr', account_code: '2010', amount: amt, note: 'Worker payable' },
    ];
  }
  if (rt === 'worker_advance_settlement') {
    const amt = je.lines.reduce((s, l) => s + (l.debit > EPS ? l.debit : 0), 0);
    if (amt <= EPS) return null;
    return [
      { side: 'dr', account_code: '2010', amount: amt, note: 'Reduce payable' },
      { side: 'cr', account_code: '1180', amount: amt, note: 'Clear advance' },
    ];
  }
  return null;
}

function severityRank(s: DiagnosticsSeverity): number {
  if (s === 'error') return 3;
  if (s === 'warning') return 2;
  if (s === 'info') return 1;
  return 0;
}

function maxSeverity(a: DiagnosticsSeverity, b: DiagnosticsSeverity): DiagnosticsSeverity {
  return severityRank(a) >= severityRank(b) ? a : b;
}

/** Fix queue: allow errors + material warnings only (exclude policy/suspense hints). */
const QUEUE_ELIGIBLE_WARNING_RULES = new Set([
  'RULE_03',
  'RULE_04',
  'RULE_05',
  'RULE_06',
  'RULE_07',
  'RULE_08',
  'RULE_09',
  'RULE_W01',
  'RULE_W02',
]);

export function computeActionableForQueue(hits: DiagnosticsRuleHit[]): boolean {
  return hits.some((h) => {
    if (h.severity === 'error') return true;
    if (h.severity === 'warning' && QUEUE_ELIGIBLE_WARNING_RULES.has(h.ruleId)) return true;
    return false;
  });
}

export function buildSeverityReason(hits: DiagnosticsRuleHit[]): string {
  if (!hits.length) return 'No rules fired; treated as clean for this scan.';
  return hits.map((h) => `${h.ruleId} [${h.severity}]: ${h.detail}`).join(' | ');
}

function touchedCodesFromLines(lines: LineWithAccount[]): string[] {
  return [...new Set(lines.map((l) => l.account_code).filter(Boolean) as string[])];
}

function fallbackJournalUiRef(args: {
  journalId: string;
  entryNo: string | null;
  referenceType: string | null;
  referenceId: string | null;
}): AccountingUiRef {
  const technicalRef = buildTechnicalRef(args.referenceType, args.referenceId, args.journalId);
  return {
    displayRef: technicalRef,
    technicalRef,
    sourceLabel: sourceLabelFromReferenceType(args.referenceType),
    entryNoBadge: formatJournalEntryBadge(args.entryNo, args.journalId),
    documentResolved: false,
  };
}

/** Hits that affect severity, rule tab counts, and queue eligibility */
export function rollupDiagnosticsHits(hits: DiagnosticsRuleHit[]): DiagnosticsRuleHit[] {
  return hits.filter((h) => !h.ignoredForLabRollup);
}

export function computeRuleCountsFromHits(rows: JournalAnomalyRow[]): Record<string, number> {
  const m: Record<string, number> = {};
  for (const r of rows) {
    for (const h of rollupDiagnosticsHits(r.hits)) {
      m[h.ruleId] = (m[h.ruleId] || 0) + 1;
    }
  }
  return m;
}

function buildTraceGuidance(trace: TraceSearchResult): TraceSearchResult['traceGuidance'] {
  const sourceResolved = trace.entities.length > 0 || trace.journals.length > 0;
  const sourceSummary = sourceResolved
    ? trace.entities.map((e) => `${e.kind}: ${e.label}${e.status ? ` (${e.status})` : ''}`).join('; ') || trace.sourceDocNarrative
    : 'No matching sale, purchase, payment, worker, stage, or journal id was resolved. Refine query or mode.';

  const expectedPostingSummary: string[] = [
    'Draft sale / draft purchase → no GL expected.',
    'Final sale / posted purchase → canonical document JE expected.',
    'Pre-bill worker pay → Dr 1180 / Cr bank; post-bill → Dr 2010 / Cr bank.',
    'Stage bill → Dr 5000 / Cr 2010; advance settlement → Dr 2010 / Cr 1180.',
  ];

  const actualPostingSummary =
    trace.journals.length === 0
      ? ['No journal entries returned for this trace.']
      : trace.journals.map((j) => {
          const ui = trace.journalUiRefs?.[j.id];
          const head = ui?.displayRef || j.entry_no || j.id.slice(0, 8);
          return `${head} · ${j.reference_type || '—'} · void=${j.is_void === true} · lines=${j.lines.length}`;
        });

  const nextSteps: string[] = [];
  if (!sourceResolved) nextSteps.push('Try UUID mode, payment ref, or explicit reference_type:id.');
  if (trace.overall === 'error' || trace.overall === 'warning') {
    nextSteps.push('Review rule hits below; void duplicate or repost via canonical flows.');
    nextSteps.push('Open AR/AP Reconciliation Center if 1100/2000/1195 involved.');
  } else if (trace.overall === 'info') {
    nextSteps.push('Informational only — confirm policy (e.g. suspense 1195) in Reconciliation Center.');
  } else {
    nextSteps.push('No blocking findings in trace sample; spot-check lines vs business document.');
  }
  if (trace.ruleHits.length) {
    nextSteps.push(`Exact rule hits: ${trace.ruleHits.map((h) => `${h.ruleId}(${h.severity})`).join(', ')}`);
  }
  for (const h of trace.ruleHits.slice(0, 8)) {
    if (h.suggestedAction) nextSteps.push(`${h.ruleId}: ${h.suggestedAction}`);
  }

  return {
    sourceResolved,
    sourceSummary,
    expectedPostingSummary,
    actualPostingSummary,
    nextSteps: [...new Set(nextSteps)].slice(0, 16),
  };
}

export async function runTraceSearch(
  companyId: string,
  rawQuery: string,
  mode: 'auto' | 'entry_no' | 'payment_ref' | 'sale' | 'purchase' | 'reference' | 'account_code' | 'uuid' = 'auto'
): Promise<TraceSearchResult> {
  const query = rawQuery.trim();
  const entities: TraceEntitySummary[] = [];
  const journalIds = new Set<string>();
  let modeUsed = mode;
  let sourceDocNarrative = '';

  const pushJe = (id: string) => {
    if (id) journalIds.add(id);
  };

  if (!query) {
    const empty: TraceSearchResult = {
      query,
      mode: modeUsed,
      overall: 'clean',
      entities,
      journals: [],
      ruleHits: [],
      sourceDocNarrative: 'Enter a search value.',
    };
    empty.traceGuidance = buildTraceGuidance(empty);
    return empty;
  }

  const runUuidResolution = async () => {
    const id = query;
    const { data: je1 } = await supabase.from('journal_entries').select('id').eq('company_id', companyId).eq('id', id).maybeSingle();
    if (je1) {
      pushJe(id);
      entities.push({ kind: 'journal', id, label: `Journal ${id.slice(0, 8)}…` });
    }
    const { data: sale } = await supabase
      .from('sales')
      .select('id, invoice_no, status, branch_id, draft_no, quotation_no, order_no')
      .eq('company_id', companyId)
      .eq('id', id)
      .maybeSingle();
    if (sale) {
      const row = sale as {
        id: string;
        invoice_no?: string;
        status?: string;
        branch_id?: string;
        draft_no?: string;
        quotation_no?: string;
        order_no?: string;
      };
      const disp = getSaleDisplayNumber(row) || row.invoice_no || row.id;
      entities.push({
        kind: 'sale',
        id: row.id,
        label: disp,
        status: row.status,
        branch_id: row.branch_id ?? null,
      });
      const { data: jrows } = await supabase
        .from('journal_entries')
        .select('id')
        .eq('company_id', companyId)
        .eq('reference_type', 'sale')
        .eq('reference_id', id)
        .limit(20);
      for (const j of jrows || []) pushJe((j as { id: string }).id);
    }
    const { data: pur } = await supabase
      .from('purchases')
      .select('id, po_no, status, branch_id, draft_no, order_no')
      .eq('company_id', companyId)
      .eq('id', id)
      .maybeSingle();
    if (pur) {
      const row = pur as { id: string; po_no?: string; status?: string; branch_id?: string; draft_no?: string; order_no?: string };
      const disp = getPurchaseDisplayNumber(row) || row.po_no || row.id;
      entities.push({
        kind: 'purchase',
        id: row.id,
        label: disp,
        status: row.status,
        branch_id: row.branch_id ?? null,
      });
      const { data: jrows } = await supabase
        .from('journal_entries')
        .select('id')
        .eq('company_id', companyId)
        .eq('reference_type', 'purchase')
        .eq('reference_id', id)
        .limit(20);
      for (const j of jrows || []) pushJe((j as { id: string }).id);
    }
    const { data: st } = await supabase
      .from('studio_production_stages')
      .select('id, production_id, status, stage_type')
      .eq('id', id)
      .maybeSingle();
    if (st) {
      const stRow = st as { production_id?: string; status?: string; stage_type?: string };
      let prodNo = '';
      if (stRow.production_id) {
        const { data: pr } = await supabase
          .from('studio_productions')
          .select('production_no')
          .eq('company_id', companyId)
          .eq('id', stRow.production_id)
          .maybeSingle();
        prodNo = String((pr as { production_no?: string } | null)?.production_no || '').trim();
      }
      const stype = String(stRow.stage_type || '').trim();
      const label = [prodNo || `Stage ${id.slice(0, 8)}…`, stype].filter(Boolean).join(' · ');
      entities.push({ kind: 'stage', id, label, status: stRow.status });
      const { data: jrows } = await supabase
        .from('journal_entries')
        .select('id')
        .eq('company_id', companyId)
        .eq('reference_type', 'studio_production_stage')
        .eq('reference_id', id)
        .limit(10);
      for (const j of jrows || []) pushJe((j as { id: string }).id);
    }
    const { data: wrk } = await supabase.from('workers').select('id, name').eq('company_id', companyId).eq('id', id).maybeSingle();
    if (wrk) {
      entities.push({ kind: 'worker', id, label: (wrk as { name?: string }).name || id });
      const { data: jrows } = await supabase
        .from('journal_entries')
        .select('id')
        .eq('company_id', companyId)
        .eq('reference_type', 'worker_payment')
        .eq('reference_id', id)
        .limit(30);
      for (const j of jrows || []) pushJe((j as { id: string }).id);
      const { data: j2 } = await supabase
        .from('journal_entries')
        .select('id')
        .eq('company_id', companyId)
        .eq('reference_type', 'worker_advance_settlement')
        .eq('reference_id', id)
        .limit(30);
      for (const j of j2 || []) pushJe((j as { id: string }).id);
    }
    if (!sourceDocNarrative) sourceDocNarrative = 'Resolved UUID against journal, sale, purchase, stage, worker.';
  };

  if (mode === 'reference') {
    if (query.includes(':')) {
      const [t, ...rest] = query.split(':');
      const refId = rest.join(':').trim();
      const refType = t.trim();
      if (refType && refId) {
        const { data: jrows } = await supabase
          .from('journal_entries')
          .select('id')
          .eq('company_id', companyId)
          .eq('reference_type', refType)
          .eq('reference_id', refId)
          .or('is_void.is.null,is_void.eq.false')
          .limit(50);
        for (const j of jrows || []) pushJe((j as { id: string }).id);
        entities.push({ kind: 'none', id: refId, label: `${refType}:${refId}`, extra: { reference_type: refType } });
        sourceDocNarrative = `Journals with reference_type=${refType}, reference_id=${refId}.`;
      }
    }
    modeUsed = 'reference';
  } else if (mode === 'account_code') {
    const { data: acc } = await supabase.from('accounts').select('id, code, name').eq('company_id', companyId).eq('code', query).limit(5);
    const accList = acc || [];
    if (accList.length === 1) {
      const aid = (accList[0] as { id: string }).id;
      const { data: lines } = await supabase.from('journal_entry_lines').select('journal_entry_id').eq('account_id', aid).limit(80);
      const jeIds = [...new Set((lines || []).map((l: { journal_entry_id: string }) => l.journal_entry_id))];
      for (const id of jeIds) pushJe(id);
      entities.push({ kind: 'none', id: aid, label: `Account ${query}`, extra: { account_id: aid } });
      sourceDocNarrative = `Recent lines on account code ${query} (capped).`;
    }
    modeUsed = 'account_code';
  } else if (mode === 'payment_ref') {
    const { data: pay } = await supabase
      .from('payments')
      .select('id, reference_number, reference_type, reference_id, branch_id, amount')
      .eq('company_id', companyId)
      .ilike('reference_number', query)
      .limit(5);
    const p0 = pay?.[0] as
      | { id: string; reference_number?: string; reference_type?: string; reference_id?: string; branch_id?: string }
      | undefined;
    if (p0) {
      entities.push({
        kind: 'payment',
        id: p0.id,
        label: p0.reference_number || p0.id,
        branch_id: p0.branch_id ?? null,
        extra: { reference_type: p0.reference_type, reference_id: p0.reference_id },
      });
      const { data: jrows } = await supabase.from('journal_entries').select('id').eq('company_id', companyId).eq('payment_id', p0.id).limit(20);
      for (const j of jrows || []) pushJe((j as { id: string }).id);
      sourceDocNarrative = `Payment ${p0.reference_number} → linked journal entries.`;
    }
    modeUsed = 'payment_ref';
  } else if (mode === 'entry_no') {
    const { data: jrows } = await supabase
      .from('journal_entries')
      .select('id')
      .eq('company_id', companyId)
      .ilike('entry_no', `%${query}%`)
      .limit(25);
    for (const j of jrows || []) pushJe((j as { id: string }).id);
    if (jrows?.length) sourceDocNarrative = `entry_no ILIKE %${query}%`;
    modeUsed = 'entry_no';
  } else if (mode === 'sale') {
    const { data: sales } = await supabase
      .from('sales')
      .select('id, invoice_no, status, branch_id, draft_no, quotation_no, order_no')
      .eq('company_id', companyId)
      .or(`invoice_no.ilike.%${query}%,draft_no.ilike.%${query}%,quotation_no.ilike.%${query}%,order_no.ilike.%${query}%`)
      .limit(8);
    for (const s of sales || []) {
      const row = s as {
        id: string;
        invoice_no?: string;
        status?: string;
        branch_id?: string;
        draft_no?: string;
        quotation_no?: string;
        order_no?: string;
      };
      const disp = getSaleDisplayNumber(row) || row.invoice_no || row.id.slice(0, 8);
      entities.push({
        kind: 'sale',
        id: row.id,
        label: disp,
        status: row.status,
        branch_id: row.branch_id ?? null,
      });
      const { data: jrows } = await supabase
        .from('journal_entries')
        .select('id')
        .eq('company_id', companyId)
        .eq('reference_type', 'sale')
        .eq('reference_id', row.id)
        .limit(20);
      for (const j of jrows || []) pushJe((j as { id: string }).id);
    }
    modeUsed = 'sale';
  } else if (mode === 'purchase') {
    const { data: purs } = await supabase
      .from('purchases')
      .select('id, po_no, status, branch_id, draft_no, order_no')
      .eq('company_id', companyId)
      .or(`po_no.ilike.%${query}%,draft_no.ilike.%${query}%,order_no.ilike.%${query}%`)
      .limit(8);
    for (const p of purs || []) {
      const row = p as { id: string; po_no?: string; status?: string; branch_id?: string; draft_no?: string; order_no?: string };
      const disp = getPurchaseDisplayNumber(row) || row.po_no || row.id.slice(0, 8);
      entities.push({
        kind: 'purchase',
        id: row.id,
        label: disp,
        status: row.status,
        branch_id: row.branch_id ?? null,
      });
      const { data: jrows } = await supabase
        .from('journal_entries')
        .select('id')
        .eq('company_id', companyId)
        .eq('reference_type', 'purchase')
        .eq('reference_id', row.id)
        .limit(20);
      for (const j of jrows || []) pushJe((j as { id: string }).id);
    }
    modeUsed = 'purchase';
  } else if (mode === 'uuid') {
    await runUuidResolution();
    modeUsed = 'uuid';
  } else {
    /** auto — strict priority (UUID before fuzzy entry_no) */
    if (UUID_RE.test(query)) {
      await runUuidResolution();
      modeUsed = 'uuid';
    } else if (/^PAY-/i.test(query)) {
      const { data: pay } = await supabase
        .from('payments')
        .select('id, reference_number, reference_type, reference_id, branch_id')
        .eq('company_id', companyId)
        .ilike('reference_number', query)
        .limit(5);
      const p0 = pay?.[0] as
        | { id: string; reference_number?: string; reference_type?: string; reference_id?: string; branch_id?: string }
        | undefined;
      if (p0) {
        entities.push({
          kind: 'payment',
          id: p0.id,
          label: p0.reference_number || p0.id,
          branch_id: p0.branch_id ?? null,
          extra: { reference_type: p0.reference_type, reference_id: p0.reference_id },
        });
        const { data: jrows } = await supabase.from('journal_entries').select('id').eq('company_id', companyId).eq('payment_id', p0.id).limit(20);
        for (const j of jrows || []) pushJe((j as { id: string }).id);
        sourceDocNarrative = `Payment ${p0.reference_number} → linked JEs.`;
      }
      modeUsed = 'payment_ref';
    } else if (/^JE/i.test(query)) {
      const { data: jrows } = await supabase
        .from('journal_entries')
        .select('id')
        .eq('company_id', companyId)
        .ilike('entry_no', `%${query}%`)
        .limit(25);
      for (const j of jrows || []) pushJe((j as { id: string }).id);
      if (jrows?.length) sourceDocNarrative = `entry_no ILIKE %${query}%`;
      modeUsed = 'entry_no';
    } else if (/^\d{3,5}$/.test(query)) {
      const { data: acc } = await supabase.from('accounts').select('id, code, name').eq('company_id', companyId).eq('code', query).limit(2);
      if (acc?.length === 1) {
        const aid = (acc[0] as { id: string }).id;
        const { data: lines } = await supabase.from('journal_entry_lines').select('journal_entry_id').eq('account_id', aid).limit(80);
        const jeIds = [...new Set((lines || []).map((l: { journal_entry_id: string }) => l.journal_entry_id))];
        for (const id of jeIds) pushJe(id);
        entities.push({ kind: 'none', id: aid, label: `Account ${query}`, extra: { account_id: aid } });
        sourceDocNarrative = `Lines on account ${query} (capped).`;
      }
      modeUsed = 'account_code';
    } else if (query.includes(':')) {
      const [t, ...rest] = query.split(':');
      const refId = rest.join(':').trim();
      const refType = t.trim();
      if (refType && refId) {
        const { data: jrows } = await supabase
          .from('journal_entries')
          .select('id')
          .eq('company_id', companyId)
          .eq('reference_type', refType)
          .eq('reference_id', refId)
          .or('is_void.is.null,is_void.eq.false')
          .limit(50);
        for (const j of jrows || []) pushJe((j as { id: string }).id);
        entities.push({ kind: 'none', id: refId, label: `${refType}:${refId}`, extra: { reference_type: refType } });
        sourceDocNarrative = `reference_type=${refType}, reference_id=${refId}.`;
      }
      modeUsed = 'reference';
    } else {
      const { data: sales } = await supabase
        .from('sales')
        .select('id, invoice_no, status, branch_id, draft_no, quotation_no, order_no')
        .eq('company_id', companyId)
        .or(`invoice_no.ilike.%${query}%,draft_no.ilike.%${query}%,quotation_no.ilike.%${query}%,order_no.ilike.%${query}%`)
        .limit(8);
      for (const s of sales || []) {
        const row = s as {
          id: string;
          invoice_no?: string;
          status?: string;
          branch_id?: string;
          draft_no?: string;
          quotation_no?: string;
          order_no?: string;
        };
        const disp = getSaleDisplayNumber(row) || row.invoice_no || row.id.slice(0, 8);
        entities.push({
          kind: 'sale',
          id: row.id,
          label: disp,
          status: row.status,
          branch_id: row.branch_id ?? null,
        });
        const { data: jrows } = await supabase
          .from('journal_entries')
          .select('id')
          .eq('company_id', companyId)
          .eq('reference_type', 'sale')
          .eq('reference_id', row.id)
          .limit(20);
        for (const j of jrows || []) pushJe((j as { id: string }).id);
      }
      const { data: purs } = await supabase
        .from('purchases')
        .select('id, po_no, status, branch_id, draft_no, order_no')
        .eq('company_id', companyId)
        .or(`po_no.ilike.%${query}%,draft_no.ilike.%${query}%,order_no.ilike.%${query}%`)
        .limit(8);
      for (const p of purs || []) {
        const row = p as {
          id: string;
          po_no?: string;
          status?: string;
          branch_id?: string;
          draft_no?: string;
          order_no?: string;
        };
        const disp = getPurchaseDisplayNumber(row) || row.po_no || row.id.slice(0, 8);
        entities.push({
          kind: 'purchase',
          id: row.id,
          label: disp,
          status: row.status,
          branch_id: row.branch_id ?? null,
        });
        const { data: jrows } = await supabase
          .from('journal_entries')
          .select('id')
          .eq('company_id', companyId)
          .eq('reference_type', 'purchase')
          .eq('reference_id', row.id)
          .limit(20);
        for (const j of jrows || []) pushJe((j as { id: string }).id);
      }
      modeUsed = sales?.length || purs?.length ? 'sale/purchase' : 'auto';
      if (!sourceDocNarrative) sourceDocNarrative = 'Sale/purchase number search (fuzzy).';
    }
  }

  if (journalIds.size === 0 && query.length >= 2) {
    const fromDisplay = await searchJournalIdsByDisplayRef(companyId, query);
    for (const jid of fromDisplay) pushJe(jid);
    if (fromDisplay.length && !sourceDocNarrative) {
      sourceDocNarrative = `Display ref / document number → ${fromDisplay.length} journal(s).`;
    }
  }

  const journals: JournalTraceRow[] = [];
  const allRuleHits: DiagnosticsRuleHit[] = [];
  const eva: TraceSearchResult['expectedVsActual'] = [];

  for (const jid of journalIds) {
    const loaded = await loadJournalWithLines(companyId, jid);
    if (!loaded) continue;
    journals.push(loaded);
    const rh = await rulesForJournal(companyId, loaded);
    allRuleHits.push(...rh.map((h) => ({ ...h, journalId: loaded.id })));
    const expected = buildExpectedForJournal(loaded);
    if (expected) {
      const actual = linesToExpectedActual(loaded.lines);
      eva.push({
        journalId: loaded.id,
        expected,
        actual,
        diffNote: compareExpectedActual(expected, actual),
        tbImpact: 'Pattern mismatch affects expense, worker payable, and/or advance on TB.',
        suggestedAction: 'Reconcile with studio / worker payment services or void and repost.',
      });
    }
  }

  const rollupTraceHits = allRuleHits.filter((h) => !h.ignoredForLabRollup);
  let overall: DiagnosticsSeverity = 'clean';
  for (const h of rollupTraceHits) overall = maxSeverity(overall, h.severity);
  for (const e of eva) {
    if (e.diffNote && !e.diffNote.includes('match')) overall = maxSeverity(overall, 'error');
  }

  const journalUiRefs: Record<string, AccountingUiRef> = {};
  if (journals.length) {
    const uiMap = await resolveJournalUiRefsByJournalIds(
      companyId,
      journals.map((j) => ({ key: j.id, journalEntryId: j.id }))
    );
    for (const j of journals) {
      journalUiRefs[j.id] =
        uiMap.get(j.id) ??
        fallbackJournalUiRef({
          journalId: j.id,
          entryNo: j.entry_no,
          referenceType: j.reference_type,
          referenceId: j.reference_id,
        });
    }
  }

  const result: TraceSearchResult = {
    query,
    mode: modeUsed,
    overall,
    entities,
    journals,
    journalUiRefs: Object.keys(journalUiRefs).length ? journalUiRefs : undefined,
    ruleHits: allRuleHits,
    expectedVsActual: eva.length ? eva : undefined,
    sourceDocNarrative: sourceDocNarrative || `Found ${journals.length} journal(s).`,
  };
  result.traceGuidance = buildTraceGuidance(result);
  return result;
}

export interface JournalAnomalyScanFilters {
  branchId?: string | null;
  dateFrom?: string;
  dateTo?: string;
}

export async function fetchJournalAnomalies(
  companyId: string,
  limit = 80,
  filters?: JournalAnomalyScanFilters
): Promise<JournalAnomalyRow[]> {
  let jq = supabase
    .from('journal_entries')
    .select('id, entry_no, entry_date, reference_type, reference_id, is_void, payment_id')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (filters?.branchId) jq = jq.eq('branch_id', filters.branchId);
  if (filters?.dateFrom) jq = jq.gte('entry_date', filters.dateFrom);
  if (filters?.dateTo) jq = jq.lte('entry_date', filters.dateTo);
  const { data: entries } = await jq;

  const rows: JournalAnomalyRow[] = [];
  for (const e of entries || []) {
    const je = e as {
      id: string;
      entry_no?: string;
      entry_date?: string;
      reference_type?: string;
      reference_id?: string;
      is_void?: boolean;
      payment_id?: string | null;
    };
    const paymentId = je.payment_id ?? null;
    const full = await loadJournalWithLines(companyId, je.id);
    if (!full) continue;
    const hits = await rulesForJournal(companyId, full);
    const rolled = rollupDiagnosticsHits(hits);
    const touchedAccountCodes = touchedCodesFromLines(full.lines);
    if (!hits.length) {
      rows.push({
        journalId: je.id,
        entryNo: je.entry_no ?? null,
        entryDate: je.entry_date ?? null,
        referenceType: je.reference_type ?? null,
        referenceId: je.reference_id ?? null,
        paymentId,
        severity: 'clean',
        badges: ['clean'],
        summary: 'No rule flags.',
        ruleIds: [],
        hits: [],
        touchedAccountCodes,
        actionableForQueue: false,
        severityReason: buildSeverityReason([]),
      });
      continue;
    }
    if (!rolled.length) {
      rows.push({
        journalId: je.id,
        entryNo: je.entry_no ?? null,
        entryDate: je.entry_date ?? null,
        referenceType: je.reference_type ?? null,
        referenceId: je.reference_id ?? null,
        paymentId,
        severity: 'clean',
        badges: ['clean'],
        summary: 'Policy / trace notes only (ignored_for_lab_rollup).',
        ruleIds: [],
        hits,
        touchedAccountCodes,
        actionableForQueue: false,
        severityReason: buildSeverityReason(rolled),
      });
      continue;
    }
    let sev: DiagnosticsSeverity = 'clean';
    for (const h of rolled) sev = maxSeverity(sev, h.severity);
    rows.push({
      journalId: je.id,
      entryNo: je.entry_no ?? null,
      entryDate: je.entry_date ?? null,
      referenceType: je.reference_type ?? null,
      referenceId: je.reference_id ?? null,
      paymentId,
      severity: sev,
      badges: rolled.map((h) => h.ruleId),
      summary: rolled.map((h) => h.title).join(' · '),
      ruleIds: rolled.map((h) => h.ruleId),
      hits,
      touchedAccountCodes,
      actionableForQueue: computeActionableForQueue(rolled),
      severityReason: buildSeverityReason(rolled),
    });
  }

  const uiMap = await resolveJournalUiRefsByJournalIds(
    companyId,
    rows.map((r) => ({ key: r.journalId, journalEntryId: r.journalId }))
  );
  for (const r of rows) {
    r.uiRef =
      uiMap.get(r.journalId) ??
      fallbackJournalUiRef({
        journalId: r.journalId,
        entryNo: r.entryNo,
        referenceType: r.referenceType,
        referenceId: r.referenceId,
      });
  }

  return rows.sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
}

export interface IntegrityScanSummary {
  scannedJournals: number;
  clean: number;
  info: number;
  warning: number;
  error: number;
  missingPostingSales: number;
  missingPostingPurchases: number;
  unlinkedOrWeak: number;
  manualControlHits: number;
  trialBalanceRiskCount: number;
}

/** Single normalized output for the Integrity Lab UI + export */
export interface IntegrityLabScanPack {
  rows: JournalAnomalyRow[];
  summary: IntegrityScanSummary;
  /** Counts from rollup hits only — matches Rule violations tab */
  ruleCounts: Record<string, number>;
  scannedAt: string;
  filters: { branchId?: string | null; dateFrom?: string; dateTo?: string; limit: number };
}

export async function runIntegrityJournalScan(
  companyId: string,
  opts: { branchId?: string | null; dateFrom?: string; dateTo?: string; limit?: number }
): Promise<IntegrityLabScanPack> {
  const limit = opts.limit ?? 100;
  const filters = { branchId: opts.branchId, dateFrom: opts.dateFrom, dateTo: opts.dateTo, limit };
  const rows = await fetchJournalAnomalies(companyId, limit, {
    branchId: opts.branchId,
    dateFrom: opts.dateFrom,
    dateTo: opts.dateTo,
  });
  let clean = 0;
  let info = 0;
  let warning = 0;
  let error = 0;
  let unlinkedOrWeak = 0;
  let manualControlHits = 0;
  for (const r of rows) {
    if (r.severity === 'clean') clean++;
    else if (r.severity === 'info') info++;
    else if (r.severity === 'warning') warning++;
    else if (r.severity === 'error') error++;
    if (r.ruleIds.some((id) => id === 'RULE_08' || id === 'RULE_W03')) unlinkedOrWeak++;
    if (r.ruleIds.includes('RULE_07')) manualControlHits++;
  }
  let missingPostingSales = 0;
  let missingPostingPurchases = 0;
  try {
    const { data: ms, error: e1 } = await supabase.rpc('rpc_integrity_count_final_sales_missing_je', {
      p_company_id: companyId,
    });
    if (!e1 && typeof ms === 'number') missingPostingSales = ms;
  } catch {
    /* migration not applied */
  }
  try {
    const { data: mp, error: e2 } = await supabase.rpc('rpc_integrity_count_posted_purchases_missing_je', {
      p_company_id: companyId,
    });
    if (!e2 && typeof mp === 'number') missingPostingPurchases = mp;
  } catch {
    /* migration not applied */
  }
  const trialBalanceRiskCount = error + warning + missingPostingSales + missingPostingPurchases;
  const ruleCounts = computeRuleCountsFromHits(rows);
  return {
    rows,
    summary: {
      scannedJournals: rows.length,
      clean,
      info,
      warning,
      error,
      missingPostingSales,
      missingPostingPurchases,
      unlinkedOrWeak,
      manualControlHits,
      trialBalanceRiskCount,
    },
    ruleCounts,
    scannedAt: new Date().toISOString(),
    filters,
  };
}

export interface JournalExplorerRow {
  je: JournalTraceRow;
  severity: DiagnosticsSeverity;
  ruleIds: string[];
  summary: string;
  uiRef?: AccountingUiRef;
}

export async function fetchJournalExplorer(
  companyId: string,
  opts: {
    branchId?: string | null;
    dateFrom?: string;
    dateTo?: string;
    referenceType?: string;
    referenceId?: string;
    isVoid?: 'all' | 'yes' | 'no';
    suspiciousOnly?: boolean;
    limit?: number;
  }
): Promise<JournalExplorerRow[]> {
  const limit = opts.limit ?? 80;
  let q = supabase
    .from('journal_entries')
    .select('id, entry_no, entry_date, reference_type, reference_id, is_void, created_by, branch_id')
    .eq('company_id', companyId)
    .order('entry_date', { ascending: false })
    .limit(limit);
  if (opts.branchId) q = q.eq('branch_id', opts.branchId);
  if (opts.dateFrom) q = q.gte('entry_date', opts.dateFrom);
  if (opts.dateTo) q = q.lte('entry_date', opts.dateTo);
  if (opts.referenceType) q = q.eq('reference_type', opts.referenceType);
  if (opts.referenceId) q = q.eq('reference_id', opts.referenceId);
  if (opts.isVoid === 'yes') q = q.eq('is_void', true);
  if (opts.isVoid === 'no') q = q.or('is_void.is.null,is_void.eq.false');
  const { data: entries } = await q;
  const out: JournalExplorerRow[] = [];
  for (const e of entries || []) {
    const id = (e as { id: string }).id;
    const full = await loadJournalWithLines(companyId, id);
    if (!full) continue;
    const hits = await rulesForJournal(companyId, full);
    const rolled = rollupDiagnosticsHits(hits);
    let sev: DiagnosticsSeverity = 'clean';
    for (const h of rolled) sev = maxSeverity(sev, h.severity);
    if (opts.suspiciousOnly && sev === 'clean') continue;
    out.push({
      je: full,
      severity: sev,
      ruleIds: rolled.map((h) => h.ruleId),
      summary: rolled.length ? rolled.map((h) => h.title).join(' · ') : '—',
    });
  }
  if (out.length) {
    const uiMap = await resolveJournalUiRefsByJournalIds(
      companyId,
      out.map((r) => ({ key: r.je.id, journalEntryId: r.je.id }))
    );
    for (const r of out) {
      r.uiRef =
        uiMap.get(r.je.id) ??
        fallbackJournalUiRef({
          journalId: r.je.id,
          entryNo: r.je.entry_no,
          referenceType: r.je.reference_type,
          referenceId: r.je.reference_id,
        });
    }
  }
  return out;
}

/**
 * Account health from the same scan rows as the lab feed + journal-derived TB balances.
 */
export async function buildAccountHealthFromScan(
  companyId: string,
  codes: string[],
  scanRows: JournalAnomalyRow[],
  opts?: { branchId?: string | null; asOfDate?: string }
): Promise<AccountHealthRow[]> {
  const asOf = (opts?.asOfDate || new Date().toISOString().slice(0, 10)).slice(0, 10);
  const branchId = opts?.branchId ?? undefined;
  const balByAccountId = await accountingReportsService.getAccountBalancesFromJournal(companyId, asOf, branchId);

  const bad = scanRows.filter((a) => a.severity === 'error' || a.severity === 'warning');
  const out: AccountHealthRow[] = [];

  for (const code of codes) {
    const { data: acc } = await supabase
      .from('accounts')
      .select('id, code, name, balance')
      .eq('company_id', companyId)
      .eq('code', code)
      .limit(1)
      .maybeSingle();
    if (!acc) {
      out.push({
        code,
        name: '(missing)',
        accountId: '',
        journalBalance: undefined,
        storedBalance: undefined,
        balanceVariance: undefined,
        anomalyCount: 0,
        latestAnomalies: [],
      });
      continue;
    }
    const aid = (acc as { id: string }).id;
    const stored = Number((acc as { balance?: number }).balance) || 0;
    const journalBal = balByAccountId[aid];
    const journalNum = journalBal !== undefined && journalBal !== null ? Number(journalBal) : 0;
    const variance = stored - journalNum;

    const latest: AccountHealthRow['latestAnomalies'] = [];
    let count = 0;
    for (const a of bad) {
      if (!a.touchedAccountCodes.includes(code)) continue;
      count++;
      if (latest.length < 5) {
        latest.push({
          journalId: a.journalId,
          entryNo: a.entryNo,
          summary: a.summary,
          severity: a.severity,
          displayRef: a.uiRef?.displayRef,
          sourceLabel: a.uiRef?.sourceLabel,
          technicalRef: a.uiRef?.technicalRef,
        });
      }
    }
    out.push({
      code,
      name: (acc as { name?: string }).name || code,
      accountId: aid,
      journalBalance: journalNum,
      storedBalance: stored,
      balanceVariance: variance,
      anomalyCount: count,
      latestAnomalies: latest,
    });
  }
  return out;
}

/** Prefer passing scanRows from the current lab scan for aligned counts */
export async function fetchAccountHealth(
  companyId: string,
  codes: string[],
  opts?: { scanRows?: JournalAnomalyRow[]; branchId?: string | null; asOfDate?: string }
): Promise<AccountHealthRow[]> {
  const scanRows = opts?.scanRows ?? (await fetchJournalAnomalies(companyId, 120));
  return buildAccountHealthFromScan(companyId, codes, scanRows, opts);
}
