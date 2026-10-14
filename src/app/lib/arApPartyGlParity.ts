import type { ContactPartyGlBalancesSlice } from '@/app/services/contactService';
import type { UnifiedLedgerBasis } from '@/app/lib/unifiedLedgerBasisFilter';
import { DEFAULT_COMPARE_TOLERANCE } from '@/app/lib/unifiedLedgerCompareTypes';

/** Operational rollup for AR/AP party GL cards (economic / effective view). */
export const AR_AP_PARTY_GL_OPERATIONAL_BASIS: UnifiedLedgerBasis = 'effective_party';

/**
 * Production parity baseline vs Contacts legacy RPC.
 * Must match `get_contact_party_gl_balances` semantics — not effective_party.
 * Approval: APPROVE_AR_AP_PHASE2B_PARITY_BASELINE_OFFICIAL_GL
 */
export const AR_AP_PARTY_GL_PARITY_BASIS: UnifiedLedgerBasis = 'official_gl';

export type ArApPartyGlParityStatus = 'pass' | 'fail' | 'skipped' | 'n_a';

function sliceMaxDelta(a: ContactPartyGlBalancesSlice, b: ContactPartyGlBalancesSlice): number {
  return Math.max(
    Math.abs(a.glArReceivable - b.glArReceivable),
    Math.abs(a.glApPayable - b.glApPayable),
    Math.abs(a.glWorkerPayable - b.glWorkerPayable)
  );
}

export function computePartyGlMapMaxDelta(
  unified: Map<string, ContactPartyGlBalancesSlice>,
  legacy: Map<string, ContactPartyGlBalancesSlice>
): number {
  let max = 0;
  const keys = new Set([...unified.keys(), ...legacy.keys()]);
  keys.forEach((id) => {
    const u = unified.get(id) ?? { glArReceivable: 0, glApPayable: 0, glWorkerPayable: 0 };
    const l = legacy.get(id) ?? { glArReceivable: 0, glApPayable: 0, glWorkerPayable: 0 };
    max = Math.max(max, sliceMaxDelta(u, l));
  });
  return max;
}

export function partyGlParityWithinTolerance(
  maxDelta: number | undefined,
  tolerance = DEFAULT_COMPARE_TOLERANCE
): boolean {
  if (maxDelta == null) return true;
  return maxDelta <= tolerance;
}

/** Resolve admin parity chip / report status from a baseline compare max delta. */
export function resolvePartyGlParityStatus(
  maxDelta: number | undefined,
  opts?: { unifiedActive?: boolean; parityMapAvailable?: boolean }
): ArApPartyGlParityStatus {
  if (!opts?.unifiedActive) return 'n_a';
  if (opts.parityMapAvailable === false) return 'skipped';
  if (maxDelta == null) return 'skipped';
  return partyGlParityWithinTolerance(maxDelta) ? 'pass' : 'fail';
}
