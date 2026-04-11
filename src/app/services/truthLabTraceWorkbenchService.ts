/**
 * Truth Lab / payment trace workbench — compatibility layer.
 *
 * This module ships minimal no-op implementations so production builds and the
 * `/test/ar-ap-truth-lab` page compile. Replace with the full Supabase-backed
 * implementation when you commit the complete workbench to the repo.
 */

import type { TruthLabSnapshot } from '@/app/services/arApTruthLabService';
import type { TransactionEntityType } from '@/app/services/transactionMutationService';

export type PaymentDeepTraceOpts = {
  journalEntryId?: string;
  paymentId?: string;
  referenceNumber?: string;
};

export interface TableLineageRecord {
  source_table: string;
  source_pk: string;
  parent_pk?: string | null;
  document_number?: string | null;
  amount_primary?: number | null;
  allocation_amount?: number | null;
  journal_entry_id?: string | null;
  payment_id?: string | null;
  badges: string[];
  extra?: Record<string, unknown>;
}

export interface ContactLineageBundle {
  errors: string[];
  records: TableLineageRecord[];
}

export interface PaymentDeepTrace {
  errors: string[];
  payment?: unknown;
  paymentAccount?: { code?: string; name?: string };
  journalEntries?: unknown[];
  journalLines?: Array<{
    id: string;
    journal_entry_id?: string;
    account_id?: string;
    account_code?: string;
    account_name?: string;
    debit?: number;
    credit?: number;
  }>;
  transactionMutations?: unknown[];
  allocations?: unknown[];
  lineage?: TableLineageRecord[];
  timeline?: Array<{
    step: string;
    event_type: string;
    at: string;
    notes: string;
    row_id: string;
    in_place: boolean;
  }>;
}

export interface PaymentPostingCheckRow {
  check: string;
  expected: string;
  actual: string;
  ok: boolean;
  detail?: string;
}

export interface PaymentPostingAnalysis {
  overallOk: boolean;
  narrative: string;
  checks: PaymentPostingCheckRow[];
  liquidityNetByAccountId: Record<string, number>;
  primaryLiquidityAccountId: string | null;
  finalLiquidityAccountId: string | null;
  finalAmount: number;
  amountDeltaLiquidityFromFingerprint: string | null;
}

export interface DuplicatePostingAuditFlag {
  code: string;
  severity: 'critical' | 'warn' | 'info';
  message: string;
  journalEntryIds: string[];
  detail?: string;
}

export interface DuplicatePostingAudit {
  overallClean: boolean;
  flags: DuplicatePostingAuditFlag[];
  fingerprints: string[];
  economicEventIds: string[];
}

export interface PaymentRepairAssessment {
  classification: string;
  duplicateCriticalCount: number;
  postingChecksFailed: number;
  summary: string;
  repairRecommendation: string[];
}

export interface EffectiveVsAuditCompare {
  narrative: string;
  effective_amount_payment_row: string;
  audit_journal_voucher_count: number;
  transfer_je_count: number;
  amount_delta_je_count: number;
}

export interface ReflectionMatrixRow {
  surface: string;
  source_used: string;
  amount_shown: string;
  account_shown: string;
  row_ids: string;
  expected: string;
  mismatch_reason: string;
}

export interface Phase4EntityBundle {
  errors: string[];
  feedRow: Record<string, unknown> | null;
  mutations: Array<{
    id: string;
    mutation_type?: string;
    created_at?: string;
    adjustment_journal_entry_id?: string | null;
    reason?: string | null;
  }>;
}

export async function fetchPaymentDeepTrace(
  _companyId: string,
  _opts: PaymentDeepTraceOpts
): Promise<PaymentDeepTrace> {
  return {
    errors: [],
    journalEntries: [],
    journalLines: [],
    transactionMutations: [],
    allocations: [],
    timeline: [],
  };
}

export async function fetchContactTableLineage(
  _companyId: string,
  _contactId: string,
  _dateFrom: string,
  _dateTo: string,
  _includeVoided: boolean
): Promise<ContactLineageBundle> {
  return { errors: [], records: [] };
}

export function buildReflectionMatrix(
  _snap: TruthLabSnapshot | null,
  _trace: PaymentDeepTrace | null,
  _contactName: string
): ReflectionMatrixRow[] {
  return [];
}

export function buildDebugPayload(payload: Record<string, unknown>): string {
  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return '{}';
  }
}

export async function loadPhase4EntityBundle(
  _companyId: string,
  _entityType: TransactionEntityType,
  _entityId: string
): Promise<Phase4EntityBundle> {
  return { errors: [], feedRow: null, mutations: [] };
}

export function buildEffectiveVsAuditCompare(
  trace: PaymentDeepTrace | null
): EffectiveVsAuditCompare | null {
  if (!trace?.payment) return null;
  return {
    narrative: 'Stub workbench — effective vs audit compare not populated in this build.',
    effective_amount_payment_row: '—',
    audit_journal_voucher_count: 0,
    transfer_je_count: 0,
    amount_delta_je_count: 0,
  };
}

export function buildPaymentPostingExpectedVsActual(
  trace: PaymentDeepTrace | null
): PaymentPostingAnalysis | null {
  if (!trace?.payment) return null;
  return {
    overallOk: true,
    narrative: 'Stub workbench — posting heuristics not loaded in this build.',
    checks: [],
    liquidityNetByAccountId: {},
    primaryLiquidityAccountId: null,
    finalLiquidityAccountId: null,
    finalAmount: 0,
    amountDeltaLiquidityFromFingerprint: null,
  };
}

export function buildDuplicatePostingAudit(trace: PaymentDeepTrace | null): DuplicatePostingAudit | null {
  if (!trace?.payment) return null;
  return {
    overallClean: true,
    flags: [],
    fingerprints: [],
    economicEventIds: [],
  };
}

export function buildPaymentRepairAssessment(trace: PaymentDeepTrace | null): PaymentRepairAssessment | null {
  if (!trace?.payment) return null;
  return {
    classification: 'stub',
    duplicateCriticalCount: 0,
    postingChecksFailed: 0,
    summary: 'Stub workbench — no repair assessment in this build.',
    repairRecommendation: [],
  };
}
