/**
 * AR/AP integrity summary — effective vs raw variance using party statement visibility rules.
 */

import {
  shouldIncludePartyEffectiveRow,
  type PartyEffectiveRowInput,
} from '@/app/lib/reportVisibilityContract';

export type PartyGlLineForVariance = PartyEffectiveRowInput & {
  netDrMinusCr: number;
};

/** Sum of Dr−Cr on lines excluded from effective/normal party statements (audit-only chains). */
export function sumAuditOnlyPartyGlNet(lines: PartyGlLineForVariance[]): number {
  return lines
    .filter((line) => !shouldIncludePartyEffectiveRow(line))
    .reduce((sum, line) => sum + (Number(line.netDrMinusCr) || 0), 0);
}

export function computeEffectiveGlAr(rawGlAr: number | null, auditOnlyArNet: number): number | null {
  if (rawGlAr == null) return null;
  return rawGlAr - auditOnlyArNet;
}

export function computeEffectiveGlAp(rawGlAp: number | null, auditOnlyApNet: number): number | null {
  if (rawGlAp == null) return null;
  return rawGlAp - auditOnlyApNet;
}

export function computeEffectiveVariance(
  operational: number,
  effectiveGl: number | null
): number | null {
  if (effectiveGl == null) return null;
  return operational - effectiveGl;
}
