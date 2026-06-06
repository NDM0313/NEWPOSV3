/**
 * Central repair action registry (Phase F1+).
 */

import { COA_REPAIR_ACTIONS } from '@/app/lib/developerRepairActions/coaActions';
import { numberingSyncSequenceAction } from '@/app/lib/developerRepairActions/numberingAction';
import { OPENING_REPAIR_ACTIONS } from '@/app/lib/developerRepairActions/openingActions';
import { PAYMENT_REPAIR_ACTIONS } from '@/app/lib/developerRepairActions/paymentActions';
import { ROZNAMCHA_REPAIR_ACTIONS } from '@/app/lib/developerRepairActions/roznamchaActions';
import type { DeveloperRepairAction } from '@/app/lib/developerRepairTypes';

export * from '@/app/lib/developerRepairTypes';
export * from '@/app/lib/developerRepairHash';
export { numberingSyncSequenceAction } from '@/app/lib/developerRepairActions/numberingAction';
export { COA_REPAIR_ACTIONS } from '@/app/lib/developerRepairActions/coaActions';
export { PAYMENT_REPAIR_ACTIONS } from '@/app/lib/developerRepairActions/paymentActions';
export { OPENING_REPAIR_ACTIONS } from '@/app/lib/developerRepairActions/openingActions';
export { ROZNAMCHA_REPAIR_ACTIONS } from '@/app/lib/developerRepairActions/roznamchaActions';

const ALL_ACTIONS: DeveloperRepairAction[] = [
  numberingSyncSequenceAction,
  ...COA_REPAIR_ACTIONS,
  ...PAYMENT_REPAIR_ACTIONS,
  ...OPENING_REPAIR_ACTIONS,
  ...ROZNAMCHA_REPAIR_ACTIONS,
];

const byId = new Map<string, DeveloperRepairAction>();
for (const action of ALL_ACTIONS) {
  if (byId.has(action.id)) {
    throw new Error(`Duplicate developer repair action id: ${action.id}`);
  }
  byId.set(action.id, action);
}

export const DEVELOPER_REPAIR_ACTIONS = ALL_ACTIONS;

export function getDeveloperRepairAction(actionId: string): DeveloperRepairAction | undefined {
  return byId.get(actionId);
}

export function listDeveloperRepairActionIds(): string[] {
  return [...byId.keys()].sort();
}
