/**
 * Shared Counter Mode — show full-page POS lock instead of full sign-out.
 * Preference only; does not change server contracts.
 */

import { countCounterUsers } from './counterUserVault';

const STORAGE_KEY = 'erp_mobile_shared_counter_mode';
const LAST_COUNTER_COMPANY_KEY = 'erp_mobile_counter_company_id';

export function getLastCounterCompanyId(): string | null {
  try {
    const v = localStorage.getItem(LAST_COUNTER_COMPANY_KEY)?.trim();
    return v || null;
  } catch {
    return null;
  }
}

export function setLastCounterCompanyId(companyId: string | null): void {
  try {
    if (companyId?.trim()) {
      localStorage.setItem(LAST_COUNTER_COMPANY_KEY, companyId.trim());
    } else {
      localStorage.removeItem(LAST_COUNTER_COMPANY_KEY);
    }
  } catch {
    /* ignore */
  }
}

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

/** True when the app should show the POS lock screen (mode on + at least one enrolled user for this company). */
export async function shouldActivateCounterLockScreen(companyId: string | null): Promise<boolean> {
  if (!isSharedCounterModeEnabled() || !companyId) return false;
  return (await countCounterUsers(companyId)) > 0;
}

/** Boot-safe wrapper — never throws; returns false on vault/storage errors. */
export async function safeShouldActivateCounterLockScreen(companyId: string | null): Promise<boolean> {
  try {
    return await shouldActivateCounterLockScreen(companyId);
  } catch (e) {
    console.warn('[ERP Mobile] safeShouldActivateCounterLockScreen failed:', e);
    return false;
  }
}

export function requestCounterLockScreen(): void {
  window.dispatchEvent(new CustomEvent('erp-mobile:counter-lock-requested'));
}
