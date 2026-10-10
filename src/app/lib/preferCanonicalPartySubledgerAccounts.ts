/**
 * When a contact has both a legacy numeric payable leaf (e.g. 210177 under 2090)
 * and a canonical party subledger (AP-* under 2000 / AR-* under 1100), pickers
 * should only offer the canonical leaf so General JE and Payments post together.
 */

export type PartySubledgerAccountLike = {
  id: string;
  code?: string | null;
  linked_contact_id?: string | null;
  isActive?: boolean;
  is_active?: boolean;
};

export function isCanonicalPartySubledgerCode(code: string | null | undefined): boolean {
  const c = String(code ?? '').trim().toUpperCase();
  return c.startsWith('AP-') || c.startsWith('AR-');
}

function isAccountActive(a: PartySubledgerAccountLike): boolean {
  if (a.isActive === false || a.is_active === false) return false;
  return true;
}

/**
 * Hide non-canonical leaves that share linked_contact_id with an active
 * AP- or AR- party subledger sibling.
 * Accounts without linked_contact_id are unchanged.
 */
export function filterPreferCanonicalPartySubledgerAccounts<T extends PartySubledgerAccountLike>(
  accounts: T[],
): T[] {
  const byContact = new Map<string, T[]>();
  for (const a of accounts) {
    const cid = String(a.linked_contact_id ?? '').trim();
    if (!cid || !isAccountActive(a)) continue;
    const list = byContact.get(cid);
    if (list) list.push(a);
    else byContact.set(cid, [a]);
  }

  const hideIds = new Set<string>();
  for (const group of byContact.values()) {
    if (group.length < 2) continue;
    const canonical = group.filter((a) => isCanonicalPartySubledgerCode(a.code));
    if (canonical.length === 0) continue;
    const keep = new Set(canonical.map((a) => a.id));
    for (const a of group) {
      if (!keep.has(a.id)) hideIds.add(a.id);
    }
  }

  if (hideIds.size === 0) return accounts;
  return accounts.filter((a) => !hideIds.has(a.id));
}

/** If accountId is a hidden legacy sibling, return the canonical AP-/AR- id; else accountId. */
export function resolveCanonicalPartySubledgerAccountId(
  accounts: PartySubledgerAccountLike[],
  accountId: string,
): string {
  const id = String(accountId ?? '').trim();
  if (!id) return id;
  const selected = accounts.find((a) => a.id === id);
  if (!selected) return id;
  if (isCanonicalPartySubledgerCode(selected.code)) return id;
  const cid = String(selected.linked_contact_id ?? '').trim();
  if (!cid) return id;
  const canonical = accounts.find(
    (a) =>
      a.id !== id &&
      isAccountActive(a) &&
      String(a.linked_contact_id ?? '').trim() === cid &&
      isCanonicalPartySubledgerCode(a.code),
  );
  return canonical?.id ?? id;
}
