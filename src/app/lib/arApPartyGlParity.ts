import type { ContactPartyGlBalancesSlice } from '@/app/services/contactService';
import { DEFAULT_COMPARE_TOLERANCE } from '@/app/lib/unifiedLedgerCompareTypes';

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
