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

  const { supabase } = await import('./supabase');
  const voidedIds = new Set<string>();
  const chunk = 30;
  for (let i = 0; i < ids.length; i += chunk) {
    const slice = ids.slice(i, i + chunk);
    const { data, error } = await supabase
      .from('journal_entries')
      .select('payment_id')
      .eq('company_id', companyId)
      .in('payment_id', slice)
      .eq('is_void', true);
    if (error) {
      console.warn('[paymentVoidVisibility] voided JE lookup failed:', error.message);
      continue;
    }
    for (const row of data || []) {
      const pid = String((row as { payment_id?: string }).payment_id ?? '').trim();
      if (pid) voidedIds.add(pid);
    }
  }

  if (!voidedIds.size) return payments;
  return payments.filter((p) => !voidedIds.has(String(p.id ?? '').trim()));
}
