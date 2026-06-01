/**
 * Group legacy accounting_accounts_transactions rows into journal-entry buckets.
 */

export function ledgerGroupKey(row) {
  const mapId = Number(row.acc_trans_mapping_id) || 0;
  const payId =
    row.transaction_payment_id != null && row.transaction_payment_id !== ''
      ? Number(row.transaction_payment_id)
      : 0;
  const txnId =
    row.transaction_id != null && row.transaction_id !== '' && Number(row.transaction_id) > 0
      ? Number(row.transaction_id)
      : 0;

  if (mapId > 0) return { kind: 'mapping', key: `map:${mapId}`, mapId };
  if (payId > 0) return { kind: 'payment', key: `pay:${payId}`, payId };
  if (txnId > 0) {
    const sub = String(row.sub_type || 'general');
    const op = String(row.operation_date || '').slice(0, 16);
    return { kind: 'transaction', key: `txn:${txnId}:${sub}:${op}`, txnId };
  }
  return { kind: 'line', key: `line:${row.id}`, lineId: row.id };
}

export function mapReferenceType(subType, mapType) {
  const s = String(subType || '').toLowerCase();
  if (s === 'opening_balance') return 'opening_balance';
  if (s === 'purchase') return 'purchase';
  if (s === 'purchase_payment') return 'purchase_payment';
  if (s === 'sell' || s === 'sale') return 'sale';
  if (s === 'expense') return 'expense';
  if (s === 'deposit') return 'deposit';
  if (s === 'fund_transfer' || s === 'transfer') return 'transfer';
  if (mapType) return String(mapType).toLowerCase();
  return s || 'general';
}

export function toEntryDate(operationDate) {
  const s = String(operationDate || '');
  if (!s || s.startsWith('0000-00-00')) return '';
  return s.slice(0, 10);
}

export function lineDebitCredit(row) {
  const amount = Math.abs(Number(row.amount) || 0);
  const t = String(row.type || '').toLowerCase();
  if (t === 'debit') return { debit: amount, credit: 0 };
  if (t === 'credit') return { debit: 0, credit: amount };
  return { debit: 0, credit: 0 };
}
