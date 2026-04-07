/**
 * Manual "Add account" flows: only real COA rows as parents — exclude AR/AP/worker party sub-ledgers.
 * Child code suggestion: next numeric code after max(parent, siblings), unique in company.
 */

export type CoaPickerAccount = {
  id: string;
  parent_id?: string | null;
  code?: string | null;
  name?: string | null;
  linked_contact_id?: string | null;
};

const PARTY_PREFIX = /^(AR|AP|WP)-[A-F0-9-]{8,}/i;

/** Linked contact pseudo accounts and obvious party rows — not valid parents for manual GL accounts. */
export function isPartyOrLinkedLeafAccount(a: CoaPickerAccount): boolean {
  if (String(a.linked_contact_id ?? '').trim()) return true;
  const name = String(a.name ?? '').trim();
  if (PARTY_PREFIX.test(name)) return true;
  if (/\s[—–-]\s+(Receivable|Payable)\s[—–-]\s/i.test(name)) return true;
  return false;
}

/** Parents shown in Professional → parent account (category already filtered elsewhere). */
export function filterManualCoaParentCandidates(
  accounts: CoaPickerAccount[],
  categoryFilter: (a: CoaPickerAccount) => boolean
): CoaPickerAccount[] {
  return accounts.filter((a) => categoryFilter(a) && !isPartyOrLinkedLeafAccount(a));
}

/**
 * Next unique child code under parent: max(parent code, sibling codes) + 1, or parent-1, parent-2 if non-numeric.
 */
export function getNextChildAccountCode(parent: CoaPickerAccount, allAccounts: CoaPickerAccount[]): string {
  const siblings = allAccounts.filter((x) => x.parent_id === parent.id);
  const allCodes = new Set(
    allAccounts.map((x) => String(x.code ?? '').trim()).filter(Boolean)
  );
  const p = String(parent.code ?? '').trim();
  if (/^\d+$/.test(p)) {
    const base = parseInt(p, 10);
    let max = base;
    for (const s of siblings) {
      const c = String(s.code ?? '').trim();
      if (/^\d+$/.test(c)) {
        const n = parseInt(c, 10);
        if (n > max) max = n;
      }
    }
    let candidate = max + 1;
    while (allCodes.has(String(candidate))) candidate += 1;
    return String(candidate);
  }
  if (p) {
    let n = 1;
    let cand = `${p}-${n}`;
    while (allCodes.has(cand)) {
      n += 1;
      cand = `${p}-${n}`;
    }
    return cand;
  }
  let k = 1;
  let gen = `SUB-${k}`;
  while (allCodes.has(gen)) {
    k += 1;
    gen = `SUB-${k}`;
  }
  return gen;
}
