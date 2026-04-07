/** Real GL controls that host party / worker sub-ledgers in COA. */
export const PARTY_CONTROL_CODES = new Set(['1100', '2000', '2010', '1180']);

export const GL_PARTY_CHILD_CONTROL_CODES = new Set(['1100', '2000', '2010']);

export function nearestPartyControlCode<T extends { parent_id?: string | null; code?: string }>(
  startParentId: string | null | undefined,
  accountsById: Map<string, T>
): string | null {
  let pid: string | null | undefined = startParentId;
  let guard = 0;
  while (pid && guard++ < 40) {
    const p = accountsById.get(pid);
    if (!p) break;
    const c = String(p.code || '').trim();
    if (PARTY_CONTROL_CODES.has(c)) return c;
    pid = p.parent_id ?? undefined;
  }
  return null;
}

export function nearestPartyControlAncestorId<T extends { id: string; parent_id?: string | null; code?: string }>(
  account: { parent_id?: string | null },
  accountsById: Map<string, T>
): string | null {
  let pid: string | null | undefined = account.parent_id;
  let guard = 0;
  while (pid && guard++ < 40) {
    const p = accountsById.get(pid);
    if (!p) break;
    const c = String(p.code || '').trim();
    if (PARTY_CONTROL_CODES.has(c)) return p.id;
    pid = p.parent_id ?? undefined;
  }
  return null;
}

export function isPartySubledgerLeaf(
  account: { parent_id?: string | null; linked_contact_id?: string | null },
  accountsById: Map<string, { parent_id?: string | null; code?: string }>
): boolean {
  const lc = String((account as { linked_contact_id?: string | null }).linked_contact_id || '').trim();
  if (!lc) return false;
  const code = nearestPartyControlCode(account.parent_id, accountsById);
  return Boolean(code && (GL_PARTY_CHILD_CONTROL_CODES.has(code) || code === '1180'));
}

export function officialPartyControlTitle(controlCode: string): string {
  switch (String(controlCode || '').trim()) {
    case '1100':
      return 'Accounts Receivable';
    case '2000':
      return 'Accounts Payable';
    case '2010':
      return 'Worker Payable';
    case '1180':
      return 'Worker Advance';
    default:
      return 'Control account';
  }
}
