export type HybridRepairCategory =
  | 'orphan_ar_gl_correction'
  | 'expense_payment_sync'
  | 'control_unmapped_diagnostic';

export type HybridRepairRiskLevel = 'low' | 'medium' | 'high';

export type HybridRepairCandidate = {
  id: string;
  category: HybridRepairCategory;
  title: string;
  description?: string;
  amount: number;
  riskLevel: HybridRepairRiskLevel;
  canAutoApply: boolean;
  canManualApply: boolean;
  blockedReason?: string;
  repairActionId?: string;
  params: Record<string, unknown>;
  confirmPhrase?: string;
  diagnosticOnly?: boolean;
};

export type HybridRepairBatchResult = {
  applied: Array<{ id: string; message?: string }>;
  skipped: Array<{ id: string; reason: string }>;
  errors: Array<{ id: string; error: string }>;
};

const AUTO_FIX_STORAGE_KEY = 'arApHybridAutoFix';

export function getHybridAutoFixEnabled(): boolean {
  try {
    return localStorage.getItem(AUTO_FIX_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setHybridAutoFixEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(AUTO_FIX_STORAGE_KEY, enabled ? '1' : '0');
  } catch {
    /* ignore */
  }
}

export function filterAutoApplyCandidates(candidates: HybridRepairCandidate[]): HybridRepairCandidate[] {
  return candidates.filter((c) => c.canAutoApply && c.canManualApply && !c.diagnosticOnly && !c.blockedReason);
}
