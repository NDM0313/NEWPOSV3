/**
 * Phase 2b — AR/AP Diagnostics party GL balance source (unified vs legacy).
 * Gates on Party Ledger main loader flags; falls back to legacy on kill switch or RPC miss.
 */

import { supabase } from '@/lib/supabase';
import type { ContactPartyGlBalancesSlice } from '@/app/services/contactService';
import { contactService } from '@/app/services/contactService';
import { resolvePartyLedgerMainLoaderSource } from '@/app/lib/resolvePartyLedgerMainLoaderSource';
import type { UnifiedLedgerBasis } from '@/app/lib/unifiedLedgerBasisFilter';
import { computePartyGlMapMaxDelta } from '@/app/lib/arApPartyGlParity';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ArApPartyGlBalanceSource = 'legacy' | 'unified';

export type PartyGlBalancesFetchResult = {
  source: ArApPartyGlBalanceSource;
  basis: UnifiedLedgerBasis;
  map: Map<string, ContactPartyGlBalancesSlice>;
  /** Shadow compare when unified path active (admin diagnostics). */
  legacyMap?: Map<string, ContactPartyGlBalancesSlice>;
  maxAbsPartyDelta?: number;
  unifiedRpcAvailable: boolean;
};

function safeBranchForRpc(branchId: string | null | undefined): string | null {
  if (!branchId || branchId === 'all') return null;
  return UUID_RE.test(branchId.trim()) ? branchId.trim() : null;
}

function mapRpcRows(
  data: unknown
): Map<string, ContactPartyGlBalancesSlice> {
  const map = new Map<string, ContactPartyGlBalancesSlice>();
  if (!Array.isArray(data)) return map;
  data.forEach((row) => {
    const r = row as {
      contact_id?: string;
      gl_ar_receivable?: number | string | null;
      gl_ap_payable?: number | string | null;
      gl_worker_payable?: number | string | null;
    };
    if (!r?.contact_id) return;
    map.set(String(r.contact_id), {
      glArReceivable: Number(r.gl_ar_receivable ?? 0) || 0,
      glApPayable: Number(r.gl_ap_payable ?? 0) || 0,
      glWorkerPayable: Number(r.gl_worker_payable ?? 0) || 0,
    });
  });
  return map;
}

export async function resolveArApPartyGlBalanceSource(
  companyId: string
): Promise<{ useUnified: boolean; killSwitchActive: boolean }> {
  const resolved = await resolvePartyLedgerMainLoaderSource(companyId);
  return {
    useUnified: resolved.source === 'unified',
    killSwitchActive: resolved.killSwitchActive,
  };
}

export async function fetchLegacyPartyGlBalancesMap(
  companyId: string,
  branchId: string | null | undefined,
  asOfDate?: string | null
): Promise<Map<string, ContactPartyGlBalancesSlice> | null> {
  return contactService.getContactPartyGlBalancesMap(companyId, branchId, asOfDate);
}

export async function fetchUnifiedPartyGlBalancesMap(
  companyId: string,
  branchId: string | null | undefined,
  asOfDate?: string | null,
  basis: UnifiedLedgerBasis = 'effective_party'
): Promise<{ map: Map<string, ContactPartyGlBalancesSlice>; rpcAvailable: boolean }> {
  const asOf = asOfDate?.slice(0, 10) || null;
  const { data, error } = await supabase.rpc('get_unified_contact_party_gl_balances', {
    p_company_id: companyId,
    p_branch_id: safeBranchForRpc(branchId),
    p_as_of_date: asOf,
    p_basis: basis,
  });
  if (error) {
    if (import.meta.env?.DEV) {
      console.warn('[arApUnifiedPartyBalance] get_unified_contact_party_gl_balances:', error.message);
    }
    return { map: new Map(), rpcAvailable: false };
  }
  return { map: mapRpcRows(data), rpcAvailable: true };
}

function computeMaxPartyDelta(
  unified: Map<string, ContactPartyGlBalancesSlice>,
  legacy: Map<string, ContactPartyGlBalancesSlice>
): number {
  return computePartyGlMapMaxDelta(unified, legacy);
}

export { computePartyGlMapMaxDelta, partyGlParityWithinTolerance } from '@/app/lib/arApPartyGlParity';

export async function fetchPartyGlBalancesWithSource(
  companyId: string,
  branchId: string | null | undefined,
  asOfDate?: string | null,
  options?: { includeShadowParity?: boolean; basis?: UnifiedLedgerBasis }
): Promise<PartyGlBalancesFetchResult> {
  const basis = options?.basis ?? 'effective_party';
  const { useUnified } = await resolveArApPartyGlBalanceSource(companyId);

  if (!useUnified) {
    const legacyMap = (await fetchLegacyPartyGlBalancesMap(companyId, branchId, asOfDate)) ?? new Map();
    return {
      source: 'legacy',
      basis,
      map: legacyMap,
      unifiedRpcAvailable: false,
    };
  }

  const [unifiedRes, legacyMap] = await Promise.all([
    fetchUnifiedPartyGlBalancesMap(companyId, branchId, asOfDate, basis),
    options?.includeShadowParity
      ? fetchLegacyPartyGlBalancesMap(companyId, branchId, asOfDate)
      : Promise.resolve(null),
  ]);

  if (!unifiedRes.rpcAvailable) {
    const fallback = legacyMap ?? (await fetchLegacyPartyGlBalancesMap(companyId, branchId, asOfDate)) ?? new Map();
    return {
      source: 'legacy',
      basis,
      map: fallback,
      unifiedRpcAvailable: false,
    };
  }

  const result: PartyGlBalancesFetchResult = {
    source: 'unified',
    basis,
    map: unifiedRes.map,
    unifiedRpcAvailable: true,
  };

  if (legacyMap && legacyMap.size > 0) {
    result.legacyMap = legacyMap;
    result.maxAbsPartyDelta = computeMaxPartyDelta(unifiedRes.map, legacyMap);
  }

  return result;
}
