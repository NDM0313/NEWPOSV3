/**
 * Import FX W3 money service — posts only via SECURITY DEFINER RPCs.
 * When RPCs are missing (production without migration), capability probe fails closed.
 */

import { supabase } from '@/lib/supabase';
import { formatImportFxServerError } from '@/app/lib/importFxServerGate';
import { W3_MIGRATION_NOT_INSTALLED } from '@/app/lib/importFxCaseW3Helpers';

export type ImportFxW3Capability = {
  installed: boolean;
  version?: string;
  message?: string;
};

let capabilityCache: { at: number; value: ImportFxW3Capability } | null = null;

export async function probeImportFxW3Capability(force = false): Promise<ImportFxW3Capability> {
  if (!force && capabilityCache && Date.now() - capabilityCache.at < 30_000) {
    return capabilityCache.value;
  }
  const { data, error } = await supabase.rpc('import_fx_w3_capability');
  if (error) {
    const msg = String(error.message || '');
    const missing =
      /Could not find the function|schema cache|PGRST202|404/i.test(msg) ||
      error.code === 'PGRST202';
    const value: ImportFxW3Capability = {
      installed: false,
      message: missing ? W3_MIGRATION_NOT_INSTALLED : formatImportFxServerError(error),
    };
    capabilityCache = { at: Date.now(), value };
    return value;
  }
  const row = (data || {}) as Record<string, unknown>;
  const value: ImportFxW3Capability = {
    installed: row.installed === true || row.success === true,
    version: typeof row.version === 'string' ? row.version : 'w3',
  };
  capabilityCache = { at: Date.now(), value };
  return value;
}

export async function getImportFxCaseMoneyOverview(companyId: string, caseId: string) {
  const cap = await probeImportFxW3Capability();
  if (!cap.installed) {
    return { success: false as const, code: 'W3_NOT_INSTALLED', error: W3_MIGRATION_NOT_INSTALLED };
  }
  const { data, error } = await supabase.rpc('get_import_fx_case_money_overview', {
    p_company_id: companyId,
    p_case_id: caseId,
  });
  if (error) throw new Error(formatImportFxServerError(error));
  return data as Record<string, unknown>;
}

export async function postImportFxAgentAdvance(params: {
  companyId: string;
  branchId: string | null;
  caseId: string;
  postingDate: string;
  amountPkr: number;
  paymentSourceAccountId: string;
  externalReference?: string;
  notes?: string;
  clientOperationId: string;
  createdBy?: string | null;
}) {
  const cap = await probeImportFxW3Capability();
  if (!cap.installed) {
    return { success: false, code: 'W3_NOT_INSTALLED', error: W3_MIGRATION_NOT_INSTALLED, posts_journal: false };
  }
  const { data, error } = await supabase.rpc('post_import_fx_agent_advance', {
    p_company_id: params.companyId,
    p_branch_id: params.branchId,
    p_case_id: params.caseId,
    p_posting_date: params.postingDate,
    p_amount_pkr: params.amountPkr,
    p_payment_source_account_id: params.paymentSourceAccountId,
    p_external_reference: params.externalReference || null,
    p_notes: params.notes || null,
    p_client_operation_id: params.clientOperationId,
    p_created_by: params.createdBy || null,
  });
  if (error) throw new Error(formatImportFxServerError(error));
  return data as Record<string, unknown>;
}

export async function postImportFxUsdAcquisition(params: {
  companyId: string;
  branchId: string | null;
  caseId: string;
  acquisitionDate: string;
  usdQuantity: number;
  pkrPerUsd: number;
  destinationWalletAccountId: string;
  fundingType: 'ADVANCE' | 'CREDIT' | 'MIXED';
  advanceAppliedPkr?: number | null;
  manualAdvanceAllocations?: { advance_id: string; applied_pkr: number }[] | null;
  useFifo?: boolean;
  externalReference?: string;
  notes?: string;
  clientOperationId: string;
  createdBy?: string | null;
}) {
  const cap = await probeImportFxW3Capability();
  if (!cap.installed) {
    return { success: false, code: 'W3_NOT_INSTALLED', error: W3_MIGRATION_NOT_INSTALLED, posts_journal: false };
  }
  const { data, error } = await supabase.rpc('post_import_fx_usd_acquisition', {
    p_company_id: params.companyId,
    p_branch_id: params.branchId,
    p_case_id: params.caseId,
    p_acquisition_date: params.acquisitionDate,
    p_usd_quantity: params.usdQuantity,
    p_pkr_per_usd: params.pkrPerUsd,
    p_destination_wallet_account_id: params.destinationWalletAccountId,
    p_funding_type: params.fundingType,
    p_advance_applied_pkr: params.advanceAppliedPkr ?? null,
    p_manual_advance_allocations: params.manualAdvanceAllocations || null,
    p_use_fifo: params.useFifo !== false,
    p_external_reference: params.externalReference || null,
    p_notes: params.notes || null,
    p_fee_pkr: null,
    p_client_operation_id: params.clientOperationId,
    p_created_by: params.createdBy || null,
  });
  if (error) throw new Error(formatImportFxServerError(error));
  return data as Record<string, unknown>;
}

export async function reverseImportFxAgentAdvance(params: {
  companyId: string;
  advanceId: string;
  clientOperationId: string;
  createdBy?: string | null;
}) {
  const cap = await probeImportFxW3Capability();
  if (!cap.installed) {
    return { success: false, code: 'W3_NOT_INSTALLED', error: W3_MIGRATION_NOT_INSTALLED };
  }
  const { data, error } = await supabase.rpc('reverse_import_fx_agent_advance', {
    p_company_id: params.companyId,
    p_advance_id: params.advanceId,
    p_client_operation_id: params.clientOperationId,
    p_created_by: params.createdBy || null,
  });
  if (error) throw new Error(formatImportFxServerError(error));
  return data as Record<string, unknown>;
}

export async function reverseImportFxUsdAcquisition(params: {
  companyId: string;
  acquisitionId: string;
  clientOperationId: string;
  createdBy?: string | null;
}) {
  const cap = await probeImportFxW3Capability();
  if (!cap.installed) {
    return { success: false, code: 'W3_NOT_INSTALLED', error: W3_MIGRATION_NOT_INSTALLED };
  }
  const { data, error } = await supabase.rpc('reverse_import_fx_usd_acquisition', {
    p_company_id: params.companyId,
    p_acquisition_id: params.acquisitionId,
    p_client_operation_id: params.clientOperationId,
    p_created_by: params.createdBy || null,
  });
  if (error) throw new Error(formatImportFxServerError(error));
  return data as Record<string, unknown>;
}
