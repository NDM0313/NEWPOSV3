/**
 * Device quick PIN → counter tablet PIN enrollment (LoginScreen / SetPinModal).
 */

import { isAdminOrOwnerAppRole } from '../config/functionalRoles';
import {
  countWorkers,
  saveCounterWorker,
  type CounterWorkerSaveInput,
} from './counterWorkerRegistry';
import { setLastCounterCompanyId, setSharedCounterModeEnabled } from './sharedCounterMode';

export const COUNTER_REGISTRY_UPDATED_EVENT = 'erp-mobile:counter-registry-updated';

export function notifyCounterRegistryUpdated(): void {
  window.dispatchEvent(new CustomEvent(COUNTER_REGISTRY_UPDATED_EVENT));
}

export function subscribeCounterRegistryUpdated(onChange: () => void): () => void {
  window.addEventListener(COUNTER_REGISTRY_UPDATED_EVENT, onChange);
  return () => window.removeEventListener(COUNTER_REGISTRY_UPDATED_EVENT, onChange);
}

function isFourDigitPin(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

function hasConcreteBranch(branchId: string | null | undefined): boolean {
  const id = branchId?.trim();
  return !!id && id !== 'all';
}

/** Whether to offer counter PIN sync after saving device PIN. */
export function shouldOfferCounterPinSync(
  pin: string,
  role: string | null | undefined,
  companyId: string | null | undefined,
  branchId?: string | null,
): boolean {
  if (!isFourDigitPin(pin) || !companyId?.trim()) return false;
  if (isAdminOrOwnerAppRole(role)) return true;
  return hasConcreteBranch(branchId);
}

/** Resolve branch stored on counter worker row (admin/owner may have null). */
export function resolveCounterEnrollBranchId(
  role: string | null | undefined,
  branchId?: string | null,
): string | null {
  if (isAdminOrOwnerAppRole(role)) {
    const id = branchId?.trim();
    if (!id || id === 'all') return null;
    return id;
  }
  const id = branchId?.trim();
  return id && id !== 'all' ? id : null;
}

export async function finalizeCounterWorkerEnrollment(
  pin: string,
  worker: CounterWorkerSaveInput,
  companyId: string,
): Promise<void> {
  const cid = companyId.trim();
  const hadNoSlots = (await countWorkers(cid)) === 0;
  await saveCounterWorker(pin, { ...worker, companyId: cid });
  setLastCounterCompanyId(cid);
  if (hadNoSlots) {
    setSharedCounterModeEnabled(true);
  }
  notifyCounterRegistryUpdated();
}
