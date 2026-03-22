/**
 * Developer Integrity Lab — facade over diagnostics + issue repository.
 */

export {
  runTraceSearch,
  loadJournalWithLines,
  fetchJournalAnomalies,
  fetchAccountHealth,
  buildAccountHealthFromScan,
  fetchJournalExplorer,
  runIntegrityJournalScan,
  rollupDiagnosticsHits,
  computeRuleCountsFromHits,
  computeActionableForQueue,
  DIAGNOSTICS_RULE_CATALOG,
  type TraceSearchResult,
  type JournalTraceRow,
  type JournalAnomalyRow,
  type JournalExplorerRow,
  type IntegrityScanSummary,
  type IntegrityLabScanPack,
  type DiagnosticsSeverity,
  type DiagnosticsRuleHit,
} from '@/app/services/developerAccountingDiagnosticsService';

export type { AccountingUiRef } from '@/app/lib/accountingDisplayReference';
export { resolveJournalUiRefsByJournalIds } from '@/app/services/accountingDisplayRefResolver';

export { INTEGRITY_RULE_REGISTRY, getRuleDefinition, countRuleHitsFromScan } from '@/app/services/integrityRuleEngine';

export {
  listIntegrityIssues,
  insertIntegrityIssue,
  updateIntegrityIssueStatus,
  type IntegrityLabIssueRow,
  type IntegrityIssueStatus,
} from '@/app/services/integrityIssueRepository';
