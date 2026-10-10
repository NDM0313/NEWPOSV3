/**
 * Pure classifier for unbalanced JE → admin auto-fix strategy.
 * Used by Live TB repair preview (no DB).
 */

export type UnbalancedJeRepairStrategy =
  | 'REBUILD_SALE'
  | 'REBUILD_SALE_REVERSAL'
  | 'MANUAL_REVIEW';

export type ClassifyUnbalancedJeInput = {
  referenceType: string | null | undefined;
  saleStatus?: string | null;
  hasPaymentId?: boolean;
  hasReferenceId?: boolean;
};

export type ClassifyUnbalancedJeResult = {
  strategy: UnbalancedJeRepairStrategy;
  canAutoFix: boolean;
  reasonIfNot: string | null;
  actionLabel: string;
};

export function classifyUnbalancedJeRepair(
  input: ClassifyUnbalancedJeInput
): ClassifyUnbalancedJeResult {
  const rt = String(input.referenceType || '')
    .toLowerCase()
    .trim();
  const status = String(input.saleStatus || '')
    .toLowerCase()
    .trim();

  if (input.hasPaymentId) {
    return {
      strategy: 'MANUAL_REVIEW',
      canAutoFix: false,
      reasonIfNot: 'Payment-linked journals cannot be rebuilt from this tool.',
      actionLabel: 'Manual review',
    };
  }

  if (!input.hasReferenceId) {
    return {
      strategy: 'MANUAL_REVIEW',
      canAutoFix: false,
      reasonIfNot: 'No linked document reference_id.',
      actionLabel: 'Manual review',
    };
  }

  if (rt === 'sale') {
    if (status && status !== 'final') {
      return {
        strategy: 'MANUAL_REVIEW',
        canAutoFix: false,
        reasonIfNot: `Sale status is "${status}" — rebuild requires final.`,
        actionLabel: 'Manual review',
      };
    }
    return {
      strategy: 'REBUILD_SALE',
      canAutoFix: true,
      reasonIfNot: null,
      actionLabel: 'Rebuild from sale',
    };
  }

  if (rt === 'sale_reversal') {
    if (status && status !== 'cancelled') {
      return {
        strategy: 'MANUAL_REVIEW',
        canAutoFix: false,
        reasonIfNot: `Sale status is "${status}" — reversal rebuild requires cancelled.`,
        actionLabel: 'Manual review',
      };
    }
    return {
      strategy: 'REBUILD_SALE_REVERSAL',
      canAutoFix: true,
      reasonIfNot: null,
      actionLabel: 'Rebuild sale reversal',
    };
  }

  return {
    strategy: 'MANUAL_REVIEW',
    canAutoFix: false,
    reasonIfNot: `Reference type "${rt || 'unknown'}" is not auto-fixable (sale / sale_reversal only).`,
    actionLabel: 'Manual review',
  };
}
