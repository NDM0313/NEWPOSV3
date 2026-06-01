/** Financial-year cut-off helpers for Track B operational extracts. */

export function toTransactionDate(raw) {
  const s = String(raw || '').trim();
  if (!s || s.startsWith('0000-00-00')) return '';
  return s.slice(0, 10);
}

/**
 * @param {string} transactionDate YYYY-MM-DD or datetime prefix
 * @param {string} cutoffDate YYYY-MM-DD inclusive lower bound
 */
export function passesFinancialYearCutoff(transactionDate, cutoffDate) {
  const d = toTransactionDate(transactionDate);
  const c = toTransactionDate(cutoffDate);
  if (!d || !c) return false;
  return d >= c;
}
