# Report boundaries — diagnostic baseline (2026-06-03)

Company: `597a5292-14c8-4cd8-96bd-c61b5a0d8c92` (DIN BRIDAL)

## Roznamcha duplicate same-day same-amount

```sql
SELECT payment_date, amount, COUNT(*) AS cnt, array_agg(reference_number) AS refs
FROM payments
WHERE company_id = '597a5292-14c8-4cd8-96bd-c61b5a0d8c92'
  AND payment_type = 'received' AND voided_at IS NULL
GROUP BY payment_date, amount HAVING COUNT(*) > 1;
```

**Result:** 0 rows (no duplicate same-day same-amount received payments in live data).

## Advance payments on non-final sales

```sql
SELECT p.id, p.reference_number, p.payment_date, p.amount, s.invoice_no, s.status::text
FROM payments p
JOIN sales s ON s.id = p.reference_id AND p.reference_type = 'sale'
WHERE p.company_id = '597a5292-14c8-4cd8-96bd-c61b5a0d8c92'
  AND p.payment_type = 'received' AND p.voided_at IS NULL
  AND lower(s.status::text) <> 'final';
```

**Result:** Run after deploy to compare — code path now uses `fetchCustomerReceivedPaymentsForRange` (any sale status).

## JE-0188 / JE-0189 balance

```sql
SELECT je.entry_no, SUM(l.debit) AS dr, SUM(l.credit) AS cr, SUM(l.debit)-SUM(l.credit) AS diff
FROM journal_entries je
JOIN journal_entry_lines l ON l.journal_entry_id = je.id
WHERE je.company_id = '597a5292-14c8-4cd8-96bd-c61b5a0d8c92'
  AND je.entry_no IN ('JE-0188', 'JE-0189')
GROUP BY je.id, je.entry_no;
```

**Note:** Day Book now shows raw totals and per-voucher diff panel; no display-only rounding row. JE repair is out of scope unless separately approved.
