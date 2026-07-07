/** Cash / bank / wallet (liquidity) detection — shared by Roznamcha, expenses, journal payment backfill. */

export type LiquidityAccountRef = {
  code?: string | null;
  name?: string | null;
  type?: string | null;
  linked_contact_id?: string | null;
  is_active?: boolean | null;
};

function accountCodeDigits(code: string | null | undefined): string {
  return String(code ?? '').trim().replace(/\D/g, '');
}

/** Cash sub-accounts under 1000 (1002, 1003, …) — aligned with paymentAccountFilters. */
function isCashSubAccountCode(digits: string): boolean {
  return digits.length >= 4 && digits.startsWith('100');
}

/** Bank sub-accounts under 1010 (1011, 1012, …). */
function isBankSubAccountCode(digits: string): boolean {
  return digits.length >= 3 && digits.startsWith('101');
}

/** Wallet sub-accounts under 1020 (102x). */
function isWalletSubAccountCode(digits: string): boolean {
  return digits.length >= 3 && digits.startsWith('102');
}

function isStandardLiquidityCode(digits: string): boolean {
  return isCashSubAccountCode(digits) || isBankSubAccountCode(digits) || isWalletSubAccountCode(digits);
}

/** TT / agent clearing accounts (e.g. USD TT Agent Clearing 1201). */
function nameLooksLikeTtClearingAccount(name: string): boolean {
  const n = name.toLowerCase();
  if (!/\bclearing\b/.test(n)) return false;
  return /\b(tt|telegraphic|bank|agent)\b/.test(n) || /\btt\s*agent\b/.test(n);
}

function isTtClearingAccountCode(digits: string, name: string): boolean {
  if (!nameLooksLikeTtClearingAccount(name)) return false;
  return digits.length >= 3 && digits.startsWith('12');
}

/**
 * Party TT agent foreign-currency wallet (e.g. HAMID IK RMB 1205) — not company roznamcha cash.
 */
export function isPartyTtAgentWalletAccount(acc: LiquidityAccountRef | null | undefined): boolean {
  if (!acc) return false;
  const name = String(acc.name ?? '').trim();
  const n = name.toLowerCase();
  if (/\bclearing\b/i.test(name)) return false;
  const digits = accountCodeDigits(acc.code);
  if (digits.length < 3 || !digits.startsWith('12')) return false;
  if (/\btt\s*agent\b/i.test(name)) return true;
  if (/\bik\s*rmb\b/i.test(name)) return true;
  if (/\bhamid\b/i.test(name) && /\brmb\b/i.test(name)) return true;
  return false;
}

/**
 * Party payee T/T routing (e.g. WALI T/T) — not company cash/bank/wallet roznamcha.
 * Company clearing accounts (USD TT Agent Clearing) stay included.
 */
export function isPartyTtRoutingAccount(acc: LiquidityAccountRef | null | undefined): boolean {
  if (!acc) return false;
  const name = String(acc.name ?? '').trim();
  const n = name.toLowerCase();
  if (nameLooksLikeTtClearingAccount(n) || isTtClearingAccountCode(accountCodeDigits(acc.code), n)) {
    return false;
  }
  if (/\bt\/t\b/i.test(name) && !/\bclearing\b/i.test(n)) return true;
  if (/\btt\b/i.test(name) && !/\bclearing\b/i.test(n) && /\bwali\b/i.test(name)) return true;
  if (/\bwali\b/i.test(name) && /\b(t\/t|tt)\b/i.test(name) && !/\bclearing\b/i.test(n)) return true;
  return false;
}

/** True when account is cash/bank/wallet (including 102x sub-accounts), not party/committee subledgers. */
export function isLiquidityPaymentAccount(acc: LiquidityAccountRef | null | undefined): boolean {
  if (!acc) return false;
  if (acc.is_active === false) return false;
  const code = String(acc.code ?? '').trim();
  const digits = accountCodeDigits(code);
  const type = String(acc.type ?? '').toLowerCase();
  const name = String(acc.name ?? '').toLowerCase();
  if (['1000', '1010', '1020'].includes(code)) return true;
  if (isCashSubAccountCode(digits)) return true;
  if (isBankSubAccountCode(digits)) return true;
  if (isWalletSubAccountCode(digits)) return true;
  if (isTtClearingAccountCode(digits, name)) return true;
  if (['cash', 'bank', 'mobile_wallet', 'wallet', 'card', 'pos'].includes(type)) return true;
  if (/cash|bank|mobile wallet|wallet|jazz|easypaisa|ndm|easy\s*paisa|mobicash|finja|upaisa|sadapay|nayapay/.test(name)) {
    return true;
  }
  if (nameLooksLikeTtClearingAccount(name)) return true;
  if (isPartyTtAgentWalletAccount(acc)) return true;
  return false;
}

/** Stricter filter for Roznamcha — excludes party T/T routing and contact-linked non-standard accounts. */
export function isRoznamchaLiquidityAccount(acc: LiquidityAccountRef | null | undefined): boolean {
  if (!isLiquidityPaymentAccount(acc)) return false;
  if (isPartyTtRoutingAccount(acc)) return false;
  if (isPartyTtAgentWalletAccount(acc)) return false;
  const linked = acc?.linked_contact_id != null && String(acc.linked_contact_id).trim() !== '';
  if (linked) {
    const digits = accountCodeDigits(acc?.code);
    if (!isStandardLiquidityCode(digits) && !isTtClearingAccountCode(digits, String(acc?.name ?? ''))) {
      return false;
    }
  }
  return true;
}

/** Map liquidity account to payments.payment_method enum. */
export function paymentMethodForLiquidityAccount(acc: LiquidityAccountRef | null | undefined): string {
  if (!acc) return 'cash';
  const type = String(acc.type ?? '').toLowerCase();
  const code = String(acc.code ?? '').trim();
  const digits = accountCodeDigits(code);
  const name = String(acc.name ?? '').toLowerCase();
  if (
    type === 'bank' ||
    type === 'card' ||
    code === '1010' ||
    isBankSubAccountCode(digits) ||
    name.includes('bank') ||
    nameLooksLikeTtClearingAccount(name) ||
    isTtClearingAccountCode(digits, name)
  ) {
    return 'bank';
  }
  if (
    type === 'mobile_wallet' ||
    type === 'wallet' ||
    code === '1020' ||
    isWalletSubAccountCode(digits)
  ) {
    return 'other';
  }
  if (type === 'cash' || type === 'pos' || code === '1000' || isCashSubAccountCode(digits) || name.includes('cash')) {
    return 'cash';
  }
  return 'cash';
}
