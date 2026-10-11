/**
 * Mobile-safe subset of web `journalPartyPosting` attribution helpers.
 * Same classify + line-level party attribution rules — no name inference.
 */

export type JournalGlComponent =
  | 'ap_2000'
  | 'ar_1100'
  | 'worker_2010'
  | 'worker_1180'
  | 'courier_2030'
  | 'legacy_2090'
  | 'other';

export type VerifiedAccountRemap = {
  fromAccountId: string;
  toAccountId: string;
};

export type JournalAccountLike = {
  id: string;
  code?: string | null;
  name?: string | null;
  parent_id?: string | null;
  parent_code?: string | null;
  linked_contact_id?: string | null;
  is_active?: boolean | null;
  isActive?: boolean | null;
};

function remapLookup(
  remaps: VerifiedAccountRemap[] | undefined,
  fromId: string,
): string | null {
  if (!remaps?.length) return null;
  const hit = remaps.find((r) => r.fromAccountId === fromId);
  return hit?.toAccountId ?? null;
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

/**
 * Line-level party id. Never use JE-wide fallback —
 * multi-party JEs must attribute each line from account link (or remap contact).
 */
export function attributePartyIdForJournalLine(opts: {
  accountLinkedContactId: string | null | undefined;
  accountId: string;
  verifiedRemaps?: VerifiedAccountRemap[];
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
