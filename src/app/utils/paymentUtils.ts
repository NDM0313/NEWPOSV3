/**
 * Generate a unique payment reference to avoid duplicate key (payments_reference_number_unique).
 * Uses timestamp + random so concurrent requests never collide; no DB sequence needed.
 */
export function generatePaymentReference(existing?: string | null): string {
  if (existing != null && String(existing).trim() !== '') return String(existing).trim();
  return `PAY-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
