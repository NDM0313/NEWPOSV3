/**
 * Canonical inventory **asset** account for GL posting (stock-valued flows).
 * Default COA uses **1200** as the leaf inventory account; **1090** is the parent **group**
 * (same display name "Inventory") and must never receive transactional postings.
 */

export type InventoryRoutingAccount = {
  id: string;
  code?: string;
  name?: string;
  type?: string;
  accountType?: string;
  is_group?: boolean;
  isActive?: boolean;
};

/** Prefer code 1200, then type `inventory` (non-group), then a non-1090 leaf named Inventory. */
export function pickCanonicalInventoryAssetAccount<T extends InventoryRoutingAccount>(
  accounts: T[]
): T | undefined {
  const active = (a: T) => a.isActive !== false && a.is_group !== true;

  const by1200 = accounts.find((a) => active(a) && String(a.code || '').trim() === '1200');
  if (by1200) return by1200;

  const byType = accounts.find((a) => {
    const t = String(a.type || (a as { accountType?: string }).accountType || '').toLowerCase();
    return active(a) && t === 'inventory';
  });
  if (byType) return byType;

  return accounts.find((a) => {
    if (!active(a)) return false;
    const c = String(a.code || '').trim();
    if (c === '1090') return false;
    const n = String(a.name || '').toLowerCase();
    return n === 'inventory';
  });
}
