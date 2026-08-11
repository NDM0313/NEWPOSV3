/**
 * Import FX Case Wave W1 — resumable case/stage persistence (non-posting).
 * Money events (advance, USD, transfer, conversion, allocation) are later waves.
 */

import { supabase } from '@/lib/supabase';
import { fetchCompanyImportFxEnabled, formatImportFxServerError } from '@/app/lib/importFxServerGate';
import { normalizeImportDocCurrency } from '@/app/lib/importFxHelpers';
import {
  IMPORT_FX_STAGE_ORDER,
  type ImportFxStageCode,
  type ImportFxStageStatus,
} from '@/app/lib/importFxCaseHelpers';

export type { ImportFxStageCode, ImportFxStageStatus };
export { IMPORT_FX_STAGE_ORDER };

export type ImportFxArrangementType =
  | 'PATH_21_AGENT_DUAL_CREDIT'
  | 'POOLED_USD_CNY'
  | 'AGENT_PREPAID';

export type ImportFxCaseOperationalStatus =
  | 'DRAFT'
  | 'ARRANGED'
  | 'AWAITING_ADVANCE'
  | 'PARTIALLY_FUNDED'
  | 'FUNDED'
  | 'USD_PARTIALLY_ACQUIRED'
  | 'USD_ACQUIRED'
  | 'USD_TRANSFER_PENDING'
  | 'USD_TRANSFERRED'
  | 'CONVERSION_PENDING'
  | 'CNY_PARTIALLY_RECEIVED'
  | 'CNY_POOL_AVAILABLE'
  | 'PARTIALLY_ALLOCATED'
  | 'FULLY_ALLOCATED'
  | 'RECONCILIATION_REQUIRED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REVERSED';

export type ImportFxAccountingStatus =
  | 'NOT_POSTED'
  | 'PARTIALLY_POSTED'
  | 'POSTED'
  | 'RECONCILIATION_REQUIRED'
  | 'REVERSED';

export interface ImportFxCase {
  id: string;
  company_id: string;
  branch_id: string | null;
  case_no: string;
  arrangement_type: ImportFxArrangementType;
  operational_status: ImportFxCaseOperationalStatus;
  accounting_status: ImportFxAccountingStatus;
  agent_contact_id: string | null;
  third_party_contact_id: string | null;
  planned_source_currency: string | null;
  planned_usd_amount: number | null;
  expected_pkr_per_usd: number | null;
  expected_cny_per_usd: number | null;
  expected_cny_amount: number | null;
  expected_fees_pkr: number | null;
  expected_completion_date: string | null;
  notes: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ImportFxCaseStage {
  id: string;
  case_id: string;
  stage_code: ImportFxStageCode;
  stage_order: number;
  stage_status: ImportFxStageStatus;
  expected_at: string | null;
  completed_at: string | null;
  notes: string | null;
}

export interface ImportFxCaseEvent {
  id: string;
  case_id: string;
  stage_id: string | null;
  event_type: string;
  event_status: string;
  posts_journal: boolean;
  payload: Record<string, unknown>;
  notes: string | null;
  created_at: string;
}

export interface ImportFxCaseLink {
  id: string;
  case_id: string;
  link_type: 'PURCHASE' | 'SUPPLIER' | 'FX_CURRENCY_PURCHASE' | 'CONTACT';
  link_id: string;
  notes: string | null;
}

async function requireImportFxEnabled(companyId: string): Promise<void> {
  const enabled = await fetchCompanyImportFxEnabled(companyId);
  if (!enabled) {
    throw new Error(
      formatImportFxServerError('MULTI_CURRENCY_DISABLED: Import FX Case requires Multi Currency Enabled')
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

export interface CreateImportFxCaseParams {
  companyId: string;
  branchId?: string | null;
  arrangementType?: ImportFxArrangementType;
  agentContactId?: string | null;
  thirdPartyContactId?: string | null;
  plannedSourceCurrency?: string | null;
  plannedUsdAmount?: number | null;
  expectedPkrPerUsd?: number | null;
  expectedCnyPerUsd?: number | null;
  expectedCnyAmount?: number | null;
  expectedFeesPkr?: number | null;
  expectedCompletionDate?: string | null;
  notes?: string | null;
  createdBy?: string | null;
  /** W1 create idempotency: reuse on network retry; rotate only after success or new intent. */
  clientOperationId?: string | null;
}

export async function createImportFxCase(
  params: CreateImportFxCaseParams
): Promise<{
  caseId: string;
  caseNo: string;
  operationalStatus: string;
  idempotentReplay?: boolean;
}> {
  await requireImportFxEnabled(params.companyId);
  const currency = params.plannedSourceCurrency
    ? normalizeImportDocCurrency(params.plannedSourceCurrency)
    : null;
  const { data, error } = await supabase.rpc('create_import_fx_case', {
    p_company_id: params.companyId,
    p_branch_id: params.branchId ?? null,
    p_arrangement_type: params.arrangementType ?? 'POOLED_USD_CNY',
    p_agent_contact_id: params.agentContactId ?? null,
    p_third_party_contact_id: params.thirdPartyContactId ?? null,
    p_planned_source_currency: currency,
    p_planned_usd_amount: params.plannedUsdAmount ?? null,
    p_expected_pkr_per_usd: params.expectedPkrPerUsd ?? null,
    p_expected_cny_per_usd: params.expectedCnyPerUsd ?? null,
    p_expected_cny_amount: params.expectedCnyAmount ?? null,
    p_expected_fees_pkr: params.expectedFeesPkr ?? null,
    p_expected_completion_date: params.expectedCompletionDate ?? null,
    p_notes: params.notes ?? null,
    p_created_by: params.createdBy ?? null,
    p_client_operation_id: params.clientOperationId ?? null,
  });
  if (error) throw new Error(formatImportFxServerError(error));
  const row = parseRpcJson(data);
  return {
    caseId: String(row.case_id ?? ''),
    caseNo: String(row.case_no ?? ''),
    operationalStatus: String(row.operational_status ?? 'DRAFT'),
    idempotentReplay: row.idempotent_replay === true,
  };
}

export async function updateImportFxCaseDraft(params: {
  companyId: string;
  caseId: string;
  agentContactId?: string | null;
  thirdPartyContactId?: string | null;
  plannedSourceCurrency?: string | null;
  plannedUsdAmount?: number | null;
  expectedPkrPerUsd?: number | null;
  expectedCnyPerUsd?: number | null;
  expectedCnyAmount?: number | null;
  expectedFeesPkr?: number | null;
  expectedCompletionDate?: string | null;
  notes?: string | null;
  updatedBy?: string | null;
  clearAgent?: boolean;
  clearThirdParty?: boolean;
}): Promise<void> {
  await requireImportFxEnabled(params.companyId);
  const currency = params.plannedSourceCurrency
    ? normalizeImportDocCurrency(params.plannedSourceCurrency)
    : null;
  const { error } = await supabase.rpc('update_import_fx_case_draft', {
    p_company_id: params.companyId,
    p_case_id: params.caseId,
    p_agent_contact_id: params.agentContactId ?? null,
    p_third_party_contact_id: params.thirdPartyContactId ?? null,
    p_planned_source_currency: currency,
    p_planned_usd_amount: params.plannedUsdAmount ?? null,
    p_expected_pkr_per_usd: params.expectedPkrPerUsd ?? null,
    p_expected_cny_per_usd: params.expectedCnyPerUsd ?? null,
    p_expected_cny_amount: params.expectedCnyAmount ?? null,
    p_expected_fees_pkr: params.expectedFeesPkr ?? null,
    p_expected_completion_date: params.expectedCompletionDate ?? null,
    p_notes: params.notes ?? null,
    p_updated_by: params.updatedBy ?? null,
    p_clear_agent: params.clearAgent === true,
    p_clear_third_party: params.clearThirdParty === true,
  });
  if (error) throw new Error(formatImportFxServerError(error));
}

export async function confirmImportFxCaseStage(params: {
  companyId: string;
  caseId: string;
  stageCode: ImportFxStageCode;
  notes?: string | null;
  markAwaitingConfirmation?: boolean;
  createdBy?: string | null;
  clientOperationId?: string | null;
}): Promise<{ stageStatus: string; operationalStatus: string; idempotentReplay?: boolean }> {
  await requireImportFxEnabled(params.companyId);
  const { data, error } = await supabase.rpc('confirm_import_fx_case_stage', {
    p_company_id: params.companyId,
    p_case_id: params.caseId,
    p_stage_code: params.stageCode,
    p_notes: params.notes ?? null,
    p_mark_awaiting_confirmation: params.markAwaitingConfirmation === true,
    p_created_by: params.createdBy ?? null,
    p_client_operation_id: params.clientOperationId ?? null,
  });
  if (error) throw new Error(formatImportFxServerError(error));
  const row = parseRpcJson(data);
  return {
    stageStatus: String(row.stage_status ?? ''),
    operationalStatus: String(row.operational_status ?? ''),
    idempotentReplay: row.idempotent_replay === true,
  };
}

export async function cancelImportFxCaseUnposted(params: {
  companyId: string;
  caseId: string;
  notes?: string | null;
  updatedBy?: string | null;
}): Promise<void> {
  await requireImportFxEnabled(params.companyId);
  const { error } = await supabase.rpc('cancel_import_fx_case_unposted', {
    p_company_id: params.companyId,
    p_case_id: params.caseId,
    p_notes: params.notes ?? null,
    p_updated_by: params.updatedBy ?? null,
  });
  if (error) throw new Error(formatImportFxServerError(error));
}

export async function listImportFxCases(params: {
  companyId: string;
  branchId?: string | null;
  operationalStatus?: string | null;
  search?: string | null;
  limit?: number;
  offset?: number;
}): Promise<{ total: number; rows: ImportFxCase[] }> {
  await requireImportFxEnabled(params.companyId);
  const { data, error } = await supabase.rpc('list_import_fx_cases', {
    p_company_id: params.companyId,
    p_branch_id: params.branchId ?? null,
    p_operational_status: params.operationalStatus ?? null,
    p_search: params.search ?? null,
    p_limit: params.limit ?? 50,
    p_offset: params.offset ?? 0,
  });
  if (error) throw new Error(formatImportFxServerError(error));
  const row = parseRpcJson(data);
  const rows = Array.isArray(row.rows) ? (row.rows as ImportFxCase[]) : [];
  return { total: Number(row.total ?? rows.length), rows };
}

export async function getImportFxCase(
  companyId: string,
  caseId: string
): Promise<{
  case: ImportFxCase;
  stages: ImportFxCaseStage[];
  events: ImportFxCaseEvent[];
  links: ImportFxCaseLink[];
}> {
  await requireImportFxEnabled(companyId);
  const { data, error } = await supabase.rpc('get_import_fx_case', {
    p_company_id: companyId,
    p_case_id: caseId,
  });
  if (error) throw new Error(formatImportFxServerError(error));
  const row = parseRpcJson(data);
  return {
    case: row.case as ImportFxCase,
    stages: (Array.isArray(row.stages) ? row.stages : []) as ImportFxCaseStage[],
    events: (Array.isArray(row.events) ? row.events : []) as ImportFxCaseEvent[],
    links: (Array.isArray(row.links) ? row.links : []) as ImportFxCaseLink[],
  };
}

export async function linkImportFxCaseTarget(params: {
  companyId: string;
  caseId: string;
  linkType: ImportFxCaseLink['link_type'];
  linkId: string;
  notes?: string | null;
}): Promise<void> {
  await requireImportFxEnabled(params.companyId);
  const { error } = await supabase.rpc('link_import_fx_case_target', {
    p_company_id: params.companyId,
    p_case_id: params.caseId,
    p_link_type: params.linkType,
    p_link_id: params.linkId,
    p_notes: params.notes ?? null,
  });
  if (error) throw new Error(formatImportFxServerError(error));
}
