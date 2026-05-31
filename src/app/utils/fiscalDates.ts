/** Normalize Postgres date/timestamp to YYYY-MM-DD for HTML date inputs. */
export function normalizeDateOnly(value?: string | null): string {
  if (!value) return '';
  return String(value).split('T')[0];
}

/** Fiscal year end = start + 1 year − 1 day. */
export function suggestFiscalYearEnd(start?: string | null): string {
  const normalized = normalizeDateOnly(start);
  if (!normalized) return '';
  const d = new Date(`${normalized}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  d.setFullYear(d.getFullYear() + 1);
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}
