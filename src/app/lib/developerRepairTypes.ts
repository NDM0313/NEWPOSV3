/**
 * Shared types for Developer Center controlled repair actions (Phase F).
 */

export type DeveloperRepairRiskLevel = 'low' | 'medium' | 'high';

export type DeveloperRepairRequiredRole = 'developer' | 'super-admin';

export interface DeveloperRepairContext {
  companyId: string;
  userId: string | null;
  userRole: string | null;
}

export interface DryRunResult {
  ok: boolean;
  dryRunHash: string;
  before: Record<string, unknown>;
  afterPreview: Record<string, unknown>;
  blockedReason?: string;
  targetTable?: string;
  targetId?: string;
  title?: string;
  impactSummary?: string;
}

export interface ApplyResult {
  ok: boolean;
  auditId?: string;
  error?: string;
  after?: Record<string, unknown>;
  message?: string;
}

export interface DeveloperRepairAction {
  id: string;
  title: string;
  description: string;
  riskLevel: DeveloperRepairRiskLevel;
  requiredRole: DeveloperRepairRequiredRole;
  /** Static phrase or derived from params via resolveConfirmPhrase */
  confirmPhrase: string | ((params: Record<string, unknown>) => string);
  whatItChanges: string[];
  whatItNeverChanges: string[];
  dryRun: (params: Record<string, unknown>, ctx: DeveloperRepairContext) => Promise<DryRunResult>;
  apply: (
    params: Record<string, unknown>,
    ctx: DeveloperRepairContext,
    dryRunHash: string
  ) => Promise<ApplyResult>;
  auditPayload: (
    before: Record<string, unknown>,
    after: Record<string, unknown>
  ) => Record<string, unknown>;
  rollbackNote: string;
}

export interface RepairQueueItem {
  queueId: string;
  actionId: string;
  sourceTab: string;
  params: Record<string, unknown>;
  detectedReason: string;
  severity: DeveloperRepairRiskLevel;
  title?: string;
}

export function resolveConfirmPhrase(
  action: DeveloperRepairAction,
  params: Record<string, unknown>
): string {
  return typeof action.confirmPhrase === 'function'
    ? action.confirmPhrase(params)
    : action.confirmPhrase;
}
