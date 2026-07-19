# Manual fix playbook — DIN BRIDAL TB −35,000

**Named JEs (operator-approved plan implement):** JE-0222, JE-0247  
**Preferred fix:** minimal line correction (not invent a random balancing entry).

## Fix A — JE-0222 (SL-0031): set COGS debit = 26,000

```sql
UPDATE journal_entry_lines
SET debit = 26000
WHERE id = '16973f7a-cbaa-464a-aeb1-0d8f0c31be90'
  AND journal_entry_id = 'a8a3b314-038e-486b-827c-8b58590b9bb7'
  AND debit = 0 AND credit = 0;

UPDATE journal_entries
SET total_debit = 236000,
    total_credit = 236000
WHERE id = 'a8a3b314-038e-486b-827c-8b58590b9bb7';
```

Alternate (document rebuild): void+repost via `rebuildSaleDocumentAccounting(SL-0031)` — only if no conflicting payment-linked document JE rules; payments must stay untouched.

## Fix B — JE-0247 (SL-0042): add Extra Service Income reverse 9,000

```sql
INSERT INTO journal_entry_lines (
  journal_entry_id, account_id, debit, credit, description, account_name
) VALUES (
  '45bb5fe1-b510-4d8e-8b6b-0ba85634f7b2',
  '1d0622a3-0b26-430c-be11-6625b87ef417',
  9000, 0,
  'Reverse Extra Service Income – SL-0042',
  'Extra Service Income'
);

UPDATE journal_entries
SET total_debit = 91000,
    total_credit = 91000
WHERE id = '45bb5fe1-b510-4d8e-8b6b-0ba85634f7b2';
```

## Verify (read-only)

```sql
-- Per-JE imbalance should return 0 rows
-- Company TB difference should be 0.00
```

UI: Integrity Lab Phase 8 → unbalanced count 0; Tie-out TB DIFFERENCE ≈ 0; BS A=L+E DIFF ≈ 0.

## Do not

- Sync account balances alone (does not fix TB)
- Post a random suspense balancing JE without source
- Physically DELETE journal history
