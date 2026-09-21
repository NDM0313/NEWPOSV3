/**
 * General JE party posting helpers — resolve role-correct GL accounts and
 * reject retired/invalid selections without inventing PAY documents.
 *
 * Party attribution for GL: accounts.linked_contact_id per line.
 * Verified remaps (journal_account_verified_remaps / fixture maps) cover
 * unlinked retired accounts (e.g. IBRAHIM 210026) — never name inference.
 */

import type { PartySubledgerAccountLike } from '@/app/lib/preferCanonicalPartySubledgerAccounts';
import { isCanonicalPartySubledgerCode } from '@/app/lib/preferCanonicalPartySubledgerAccounts';

export type JournalPartyRoleHint = 'supplier_ap' | 'customer_ar' | 'worker' | 'courier' | 'generic';

export type JournalGlComponent =
  | 'ap_2000'
  | 'ar_1100'
  | 'worker_2010'
  | 'worker_1180'
  | 'courier_2030'
  | 'legacy_2090'
  | 'other';

export type JournalAccountLike = PartySubledgerAccountLike & {
  name?: string | null;
  parent_id?: string | null;
  parent_code?: string | null;
  type?: string | null;
  code?: string | null;
};

export type VerifiedAccountRemap = {
  fromAccountId: string;
  toAccountId: string;
};

function isActive(a: JournalAccountLike): boolean {
  if (a.isActive === false || a.is_active === false) return false;
  return true;
}

export function journalPartyRoleHintFromContactType(
  contactType: string | null | undefined,
): JournalPartyRoleHint {
  const t = String(contactType || '').toLowerCase();
  if (t.includes('worker')) return 'worker';
  if (t.includes('customer') && !t.includes('supplier')) return 'customer_ar';
  if (t.includes('supplier') || t === 'both' || t === 'money_exchange') return 'supplier_ap';
  return 'generic';
}

/** Classify leaf for labels / party-ledger components (not for AP control totals). */
export function classifyJournalGlComponent(
  account: JournalAccountLike,
  accountsById?: Map<string, JournalAccountLike>,
): JournalGlComponent {
  const code = String(account.code || '').trim().toUpperCase();
  if (code.startsWith('AR-') || code === '1100') return 'ar_1100';
  if (code.startsWith('AP-') || code === '2000') return 'ap_2000';
  if (code === '2010' || code.startsWith('WP-')) return 'worker_2010';
  if (code === '1180' || code.startsWith('WA-')) return 'worker_1180';
  if (code === '2030' || /^203\d/.test(code)) return 'courier_2030';
  if (/^210\d+/.test(code) || code === '2090') return 'legacy_2090';

  let parent: JournalAccountLike | undefined =
    account.parent_id && accountsById ? accountsById.get(account.parent_id) : undefined;
  const parentCode = String(account.parent_code || parent?.code || '').trim();
  if (parentCode === '1100') return 'ar_1100';
  if (parentCode === '2000') return 'ap_2000';
  if (parentCode === '2010') return 'worker_2010';
  if (parentCode === '1180') return 'worker_1180';
  if (parentCode === '2030' || parentCode === '2090') {
    return parentCode === '2030' ? 'courier_2030' : 'legacy_2090';
  }
  return 'other';
}

export function journalGlComponentLabel(c: JournalGlComponent): string {
  switch (c) {
    case 'ap_2000':
      return 'Supplier AP (2000)';
    case 'ar_1100':
      return 'Customer AR (1100)';
    case 'worker_2010':
      return 'Worker Payable (2010)';
    case 'worker_1180':
      return 'Worker Advance (1180)';
    case 'courier_2030':
      return 'Courier (2030)';
    case 'legacy_2090':
      return 'Legacy payable (2090/210xxx)';
    default:
      return 'Other GL';
  }
}

export type PartyJeAccountChoice = {
  accountId: string;
  code: string;
  name: string;
  component: JournalGlComponent;
  label: string;
};

/**
 * All active accounts linked to the party, with role/control labels.
 * Caller must require explicit selection when length > 1 (no silent pick).
 */
export function listPartyJeAccountChoices(
  accounts: JournalAccountLike[],
  contactId: string,
): PartyJeAccountChoice[] {
  const cid = String(contactId || '').trim();
  if (!cid) return [];
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const linked = accounts.filter(
    (a) => isActive(a) && String(a.linked_contact_id || '').trim() === cid,
  );
  const choices = linked.map((a) => {
    const component = classifyJournalGlComponent(a, byId);
    const code = String(a.code || '').trim() || a.id.slice(0, 8);
    const name = String(a.name || '').trim() || code;
    return {
      accountId: a.id,
      code,
      name,
      component,
      label: `${journalGlComponentLabel(component)} · ${code} · ${name}`,
    };
  });
  return choices.sort(
    (a, b) =>
      a.component.localeCompare(b.component) ||
      a.code.localeCompare(b.code) ||
      a.accountId.localeCompare(b.accountId),
  );
}

/**
 * Prefer canonical AP-/AR- only when it is the sole linked active account,
 * or when preferCanonical and exactly one canonical exists among linked.
 * When multiple valid accounts exist, returns null — UI must require a pick.
 */
export function resolvePartyLinkedAccountId(
  accounts: JournalAccountLike[],
  contactId: string,
  opts?: { preferCanonical?: boolean; requireSingle?: boolean },
): string | null {
  const choices = listPartyJeAccountChoices(accounts, contactId);
  if (choices.length === 0) return null;
  if (opts?.requireSingle !== false && choices.length > 1) {
    if (opts?.preferCanonical !== false) {
      const canonical = choices.filter((c) => isCanonicalPartySubledgerCode(c.code));
      if (canonical.length === 1) return canonical[0].accountId;
    }
    return null;
  }
  if (opts?.preferCanonical !== false) {
    const canonical = choices.find((c) => isCanonicalPartySubledgerCode(c.code));
    if (canonical) return canonical.accountId;
  }
  return choices[0]?.accountId ?? null;
}

export type AssertJournalAccountResult =
  | { ok: true; accountId: string; resolvedFrom?: string }
  | { ok: false; error: string };

function remapLookup(
  remaps: VerifiedAccountRemap[] | undefined,
  fromId: string,
): string | null {
  if (!remaps?.length) return null;
  const hit = remaps.find((r) => r.fromAccountId === fromId);
  return hit?.toAccountId ?? null;
}

/**
 * Guard before General JE write:
 * - Reject missing / wrong inactive accounts.
 * - Active legacy / courier / AP all allowed (no silent dual remap).
 * - Inactive: verified remap first (covers unlinked retired like IBRAHIM 210026);
 *   else linked_contact_id → active canonical sibling;
 *   else actionable error (no name / first-AP guess).
 */
export function assertOrResolveJournalAccountId(
  accounts: JournalAccountLike[],
  accountId: string,
  opts?: { verifiedRemaps?: VerifiedAccountRemap[]; companyId?: string },
): AssertJournalAccountResult {
  const id = String(accountId || '').trim();
  if (!id) return { ok: false, error: 'Account is required.' };

  const row = accounts.find((a) => a.id === id);
  if (!row) {
    // May still resolve via verified remap when account list omitted inactive rows
    const mapped = remapLookup(opts?.verifiedRemaps, id);
    if (mapped) {
      const target = accounts.find((a) => a.id === mapped);
      if (target && isActive(target)) {
        return { ok: true, accountId: mapped, resolvedFrom: id };
      }
    }
    return {
      ok: false,
      error: 'Selected account was not found. Refresh accounts and choose again.',
    };
  }

  if (isActive(row)) {
    return { ok: true, accountId: id };
  }

  const verifiedTo = remapLookup(opts?.verifiedRemaps, id);
  if (verifiedTo) {
    const target = accounts.find((a) => a.id === verifiedTo);
    if (target && isActive(target)) {
      return { ok: true, accountId: verifiedTo, resolvedFrom: id };
    }
    return {
      ok: false,
      error:
        'Verified remap target is missing or inactive. Ask admin to fix journal_account_verified_remaps.',
    };
  }

  const cid = String(row.linked_contact_id || '').trim();
  if (cid) {
    const canonical = accounts.find(
      (a) =>
        isActive(a) &&
        String(a.linked_contact_id || '').trim() === cid &&
        isCanonicalPartySubledgerCode(a.code),
    );
    if (canonical) {
      return { ok: true, accountId: canonical.id, resolvedFrom: id };
    }
  }

  const code = String(row.code || '').trim() || id.slice(0, 8);
  return {
    ok: false,
    error: `Account ${code} is inactive or retired with no verified remap. Choose the party’s active account or ask admin to add an explicit remap (linked_contact_id alone cannot resolve unlinked retired leaves).`,
  };
}

export function assertPureJournalAccounts(
  accounts: JournalAccountLike[],
  debitAccountId: string,
  creditAccountId: string,
  opts?: { verifiedRemaps?: VerifiedAccountRemap[] },
): AssertJournalAccountResult & { debitAccountId?: string; creditAccountId?: string } {
  const dr = assertOrResolveJournalAccountId(accounts, debitAccountId, opts);
  if (!dr.ok) return dr;
  const cr = assertOrResolveJournalAccountId(accounts, creditAccountId, opts);
  if (!cr.ok) return cr;
  if (dr.accountId === cr.accountId) {
    return { ok: false, error: 'Debit and credit accounts must be different.' };
  }
  return {
    ok: true,
    accountId: dr.accountId,
    debitAccountId: dr.accountId,
    creditAccountId: cr.accountId,
  };
}

/**
 * Line-level party id for a JE line. Never use JE-wide fallback here —
 * multi-party JEs must attribute each line from its account link (or remap contact).
 */
export function attributePartyIdForJournalLine(opts: {
  accountLinkedContactId: string | null | undefined;
  accountId: string;
  verifiedRemaps?: VerifiedAccountRemap[];
  /** contact_id on remap target account */
  contactIdByAccountId?: Map<string, string | null | undefined>;
}): { partyId: string | null; unresolved: boolean } {
  const linked = String(opts.accountLinkedContactId || '').trim();
  if (linked) return { partyId: linked, unresolved: false };

  const toId = remapLookup(opts.verifiedRemaps, opts.accountId);
  if (toId && opts.contactIdByAccountId) {
    const cid = String(opts.contactIdByAccountId.get(toId) || '').trim();
    if (cid) return { partyId: cid, unresolved: false };
  }
  return { partyId: null, unresolved: true };
}
