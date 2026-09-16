/**
 * Shared legacy hybrid ledger matchers for party_discount JEs (customer AR / supplier AP).
 * Used by accountingService.getCustomerLedger hybrid path and supplier AP legacy filter.
 */

export function isPartyDiscountJournalForContact(
  entry: { reference_type?: string | null; reference_id?: string | null },
  contactId: string
): boolean {
  const refTypeNorm = String(entry.reference_type || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_');
  return (
    refTypeNorm === 'party_discount' &&
    entry.reference_id != null &&
    String(entry.reference_id) === String(contactId)
  );
}
