/**
 * Maps Chart of Accounts rows to Professional (IFRS-style) categories for parent pickers.
 * Broad matching: code ranges + type + name hints — so custom Operating Expense etc. are not hidden.
 */
export type ProfessionalCategory = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';

export function accountMatchesProfessionalCategory(
  account: { type?: string; code?: string; name?: string; account_role?: string },
  category: ProfessionalCategory
): boolean {
  const t = String(account.type ?? (account as { account_role?: string }).account_role ?? '')
    .toLowerCase()
    .trim();
  const code = String(account.code ?? '').trim();
  const c0 = code ? code.charAt(0) : '';
  const name = String(account.name ?? '').toLowerCase();

  if (category === 'asset') {
    if (
      t === 'asset' ||
      t === 'cash' ||
      t === 'bank' ||
      t === 'mobile_wallet' ||
      t.includes('receivable') ||
      t.includes('inventory') ||
      t.includes('fixed') ||
      t.includes('prepaid')
    )
      return true;
    if (c0 === '1') return true;
    if (['1000', '1010', '1020', '1100', '1180', '1050', '1060', '1070', '1080', '1090', '1200'].includes(code)) return true;
    return false;
  }
  if (category === 'liability') {
    if (t.includes('liability') || t.includes('payable') || t.includes('deposit') || t === 'credit') return true;
    if (c0 === '2') return true;
    if (['2000', '2010', '2011', '2020', '2030', '2090'].includes(code)) return true;
    return false;
  }
  if (category === 'equity') {
    if (t.includes('equity') || t.includes('capital') || t.includes('retained')) return true;
    if (c0 === '3') return true;
    if (['3000', '3090'].includes(code)) return true;
    return false;
  }
  if (category === 'revenue') {
    if (t.includes('revenue') || t.includes('income') || t.includes('sales')) return true;
    if (c0 === '4') return true;
    if (code === '4050') return true;
    return false;
  }
  if (category === 'expense') {
    if (
      t.includes('expense') ||
      t.includes('cost') ||
      t.includes('cogs') ||
      name.includes('operating') ||
      name.includes('salary') ||
      name.includes('marketing')
    )
      return true;
    if (['5', '6', '7', '8'].includes(c0)) return true;
    if (code === '6090') return true;
    return false;
  }
  return false;
}
