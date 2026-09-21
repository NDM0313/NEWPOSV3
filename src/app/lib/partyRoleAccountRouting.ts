/**
 * Explicit contact-type → accounting role routing.
 * Role comes only from contact.type (or explicit opts) — never name heuristics.
 */

export type PartyAccountingRole = 'supplier' | 'customer' | 'worker' | 'courier' | 'money_exchange' | 'unknown';

export type WorkerPostingIntent = 'advance' | 'payable' | 'ambiguous';

export function partyAccountingRoleFromContactType(
  contactType: string | null | undefined,
): PartyAccountingRole {
  const t = String(contactType || '')
    .trim()
    .toLowerCase();
  if (t === 'worker' || t.includes('worker')) return 'worker';
  if (t === 'courier' || t.includes('courier')) return 'courier';
  if (t === 'money_exchange') return 'money_exchange';
  if (t === 'customer') return 'customer';
  if (t === 'supplier' || t === 'both') return 'supplier';
  if (t.includes('customer') && !t.includes('supplier')) return 'customer';
  if (t.includes('supplier')) return 'supplier';
  return 'unknown';
}

/** Worker JE / payment: which leaf side when intent is known. */
export function workerLeafIntentLabel(intent: WorkerPostingIntent): string {
  switch (intent) {
    case 'advance':
      return 'Worker Advance (WA / 1180)';
    case 'payable':
      return 'Worker Payable (WP / 2010)';
    default:
      return 'Worker (choose Advance vs Payable)';
  }
}

/** When both WA and WP leaves exist, require explicit intent — null means do not auto-pick. */
export function workerGlComponentForIntent(
  intent: WorkerPostingIntent | null | undefined,
): 'worker_1180' | 'worker_2010' | null {
  if (intent === 'advance') return 'worker_1180';
  if (intent === 'payable') return 'worker_2010';
  return null;
}

/** Filter party JE choices to the intent side when provided. */
export function filterWorkerJeChoicesByIntent<
  T extends { component: string },
>(choices: T[], intent: WorkerPostingIntent | null | undefined): T[] {
  const want = workerGlComponentForIntent(intent);
  if (!want) return choices;
  return choices.filter((c) => c.component === want);
}

export function isMerchandiseSupplierContactType(contactType: string | null | undefined): boolean {
  const role = partyAccountingRoleFromContactType(contactType);
  return role === 'supplier' || role === 'money_exchange';
}

export function isWorkerOrCourierContactType(contactType: string | null | undefined): boolean {
  const role = partyAccountingRoleFromContactType(contactType);
  return role === 'worker' || role === 'courier';
}
