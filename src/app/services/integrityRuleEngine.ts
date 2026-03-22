/**
 * Developer Integrity Lab — rule registry (codes RULE_01 …) for dashboard + trace.
 * Evaluators live in developerAccountingDiagnosticsService (single source for JE walks).
 */

import { DIAGNOSTICS_RULE_CATALOG } from '@/app/services/developerAccountingDiagnosticsService';

export const INTEGRITY_RULE_REGISTRY = DIAGNOSTICS_RULE_CATALOG;

export function getRuleDefinition(ruleCode: string) {
  return INTEGRITY_RULE_REGISTRY.find((r) => r.id === ruleCode);
}

export function countRuleHitsFromScan(ruleCode: string, ruleIdsPerRow: string[][]): number {
  let n = 0;
  for (const ids of ruleIdsPerRow) {
    if (ids.includes(ruleCode)) n++;
  }
  return n;
}
