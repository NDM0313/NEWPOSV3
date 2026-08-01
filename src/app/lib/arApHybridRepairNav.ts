/** Session flag: AR/AP page scrolls to Hybrid Repair panel on next mount. */
export const AR_AP_FOCUS_HYBRID_REPAIR_KEY = 'arApFocusHybridRepair';

export function markOpenArApHybridRepair(): void {
  try {
    sessionStorage.setItem(AR_AP_FOCUS_HYBRID_REPAIR_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function consumeOpenArApHybridRepairFocus(): boolean {
  try {
    const v = sessionStorage.getItem(AR_AP_FOCUS_HYBRID_REPAIR_KEY);
    if (v === '1') {
      sessionStorage.removeItem(AR_AP_FOCUS_HYBRID_REPAIR_KEY);
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}
