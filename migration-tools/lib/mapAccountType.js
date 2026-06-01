/** Map UltimatePOS accounting_accounts rows to modern ERP account `type` (accounts.ts). */

const MOBILE_WALLET_HINTS = /easypaisa|easypasia|jazz\s*cash|jazzcash|wallet|sadapay|nayapay/i;

/** Known legacy group header ids for business_id=2 (DIN COUTURE). */
export const LEGACY_GROUP_IDS = {
  cashInHand: 2,
  bankAccounts: 3,
  accountsReceivable: 10,
  accountsPayable: 12,
};

/**
 * @param {Record<string, unknown>} row Legacy accounting_accounts row
 * @param {Map<number, Record<string, unknown>>} byId All rows by legacy id
 */
export function mapLegacyAccountType(row, byId) {
  const primary = String(row.account_primary_type || '').toLowerCase();
  const parentId = row.parent_account_id != null ? Number(row.parent_account_id) : null;
  const name = String(row.name || '');

  if (parentId === LEGACY_GROUP_IDS.cashInHand) return 'cash';
  if (parentId === LEGACY_GROUP_IDS.bankAccounts) {
    return MOBILE_WALLET_HINTS.test(name) ? 'mobile_wallet' : 'bank';
  }
  if (parentId === LEGACY_GROUP_IDS.accountsReceivable) return 'receivable';
  if (parentId === LEGACY_GROUP_IDS.accountsPayable) return 'payable';

  if (primary === 'income') return 'revenue';
  if (primary === 'expenses') return 'expense';
  if (primary === 'equity') return 'equity';
  if (primary === 'liability') return 'liability';
  if (primary === 'asset') {
    const parent = parentId != null ? byId.get(parentId) : null;
    const parentName = parent ? String(parent.name || '').toUpperCase() : '';
    if (parentName.includes('CASH')) return 'cash';
    if (parentName.includes('BANK')) return MOBILE_WALLET_HINTS.test(name) ? 'mobile_wallet' : 'bank';
    if (parentName.includes('RECEIVABLE')) return 'receivable';
    return 'asset';
  }
  return 'asset';
}

export function provisionalAccountCode(row, type, legacyId) {
  const gl = row.gl_code != null ? String(row.gl_code).trim() : '';
  if (gl && gl !== 'gl_code' && /^\d+$/.test(gl)) return gl;
  const padded = String(legacyId).padStart(4, '0');
  if (type === 'cash') return `100${padded}`.slice(0, 6);
  if (type === 'bank') return `101${padded}`.slice(0, 6);
  if (type === 'mobile_wallet') return `102${padded}`.slice(0, 6);
  return `LEG${padded}`;
}
