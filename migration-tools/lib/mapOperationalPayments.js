/** Sum legacy transaction_payments per transaction header for paid/due fields. */

export function buildPaymentIndex(paymentRows, businessId) {
  const byTxn = new Map();
  for (const row of paymentRows) {
    if (Number(row.business_id) !== businessId) continue;
    const txnId = row.transaction_id != null ? Number(row.transaction_id) : 0;
    if (!txnId) continue;
    const amt = Math.abs(Number(row.amount) || 0);
    if (amt <= 0) continue;
    byTxn.set(txnId, (byTxn.get(txnId) || 0) + amt);
  }
  return byTxn;
}

export function resolvePaymentTotals(finalTotal, paidAmount, legacyPaymentStatus) {
  const total = Math.abs(Number(finalTotal) || 0);
  const paid = Math.max(0, Number(paidAmount) || 0);
  const due = Math.max(0, total - paid);
  const ps = String(legacyPaymentStatus || '').toLowerCase();
  let paymentStatus = 'unpaid';
  if (ps === 'paid') paymentStatus = 'paid';
  else if (ps === 'partial') paymentStatus = 'partial';
  else if (paid <= 0) paymentStatus = 'unpaid';
  else if (paid >= total - 0.005) paymentStatus = 'paid';
  else paymentStatus = 'partial';
  return { paidAmount: paid, dueAmount: due, paymentStatus };
}
