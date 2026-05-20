/**
 * Shared Counter Mode — show full-page POS lock instead of full sign-out.
 * Preference only; does not change server contracts.
 */

import { countCounterUsers } from './counterUserVault';

const STORAGE_KEY = 'erp_mobile_shared_counter_mode';

export function isSharedCounterModeEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setSharedCounterModeEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent('erp-mobile:shared-counter-mode'));
}

export function subscribeSharedCounterMode(onChange: () => void): () => void {
  const handler = () => onChange();
  window.addEventListener('erp-mobile:shared-counter-mode', handler);
  return () => window.removeEventListener('erp-mobile:shared-counter-mode', handler);
}

/** True when the app should show the POS lock screen (mode on + at least one enrolled user). */
export async function shouldActivateCounterLockScreen(): Promise<boolean> {
  if (!isSharedCounterModeEnabled()) return false;
  return (await countCounterUsers()) > 0;
}

export function requestCounterLockScreen(): void {
  window.dispatchEvent(new CustomEvent('erp-mobile:counter-lock-requested'));
}
