/** Payment row shape used by ledger / roznamcha filters. */
export type PaymentRowWithId = { id?: string | null };

/**
 * Exclude payments whose primary journal entry is voided but payments.voided_at was never set
 * (legacy manual JE void before unified lifecycle).
 */
export async function filterLivePaymentsExcludingVoidedJournals<T extends PaymentRowWithId>(
  companyId: string,
  payments: T[],
): Promise<T[]> {
  if (!companyId || !payments.length) return payments;

  const ids = payments.map((p) => String(p.id ?? '').trim()).filter(Boolean);
  if (!ids.length) return payments;

  const { supabase } = await import('@/lib/supabase');
  const voidedIds = new Set<string>();
  const chunk = 50;
  const slices: string[][] = [];
  for (let i = 0; i < ids.length; i += chunk) {
    slices.push(ids.slice(i, i + chunk));
  }
  const results = await Promise.all(
    slices.map(async (slice) => {
      const { data, error } = await supabase
        .from('journal_entries')
        .select('payment_id')
        .eq('company_id', companyId)
        .in('payment_id', slice)
        .eq('is_void', true);
      if (error) {
        console.warn('[paymentVoidVisibility] voided JE lookup failed:', error.message);
        return [] as { payment_id?: string }[];
      }
      return data || [];
    }),
  );
  for (const rows of results) {
    for (const row of rows) {
      const pid = String((row as { payment_id?: string }).payment_id ?? '').trim();
      if (pid) voidedIds.add(pid);
    }
  }

  if (!voidedIds.size) return payments;
  return payments.filter((p) => !voidedIds.has(String(p.id ?? '').trim()));
}

/** Sync filter when caller already has voided payment ids (e.g. from journal line batch). */
export function excludePaymentsByVoidedJournalIds<T extends PaymentRowWithId>(
  payments: T[],
  voidedPaymentIds: Set<string>,
): T[] {
  if (!voidedPaymentIds.size) return payments;
  return payments.filter((p) => !voidedPaymentIds.has(String(p.id ?? '').trim()));
}
