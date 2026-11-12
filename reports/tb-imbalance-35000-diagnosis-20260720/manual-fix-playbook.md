# Manual fix playbook — DIN BRIDAL TB −35,000

**Named JEs (historical 2026-07-20 apply):** JE-0222, JE-0247 — **already fixed in production**.

## Preferred path going forward (admin UI)

Use **Live TB repair** — see [`admin-self-fix-tb-imbalance.md`](./admin-self-fix-tb-imbalance.md):

1. Tie-out → Open Live TB repair  
2. Preview → Fix (or Fix all auto-fixable) for `sale` / `sale_reversal`  
3. Verify TB difference = 0  

## Legacy SQL (emergency only — prefer UI rebuild)

### Fix A — JE-0222 (SL-0031): set COGS debit = 26,000

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

Alternate: `rebuildSaleDocumentAccounting(SL-0031)` — payments untouched.

### Fix B — JE-0247 (SL-0042): Extra Service Income reverse 9,000

Prefer `rebuildSaleReversalAccounting(saleId)` in UI. SQL insert was one-time emergency only.

## Verify

Integrity Lab H → unbalanced count 0; Tie-out TB DIFFERENCE ≈ 0.

## Do not

- Sync account balances alone (does not fix TB)
- Invent a suspense balancing JE
- Physically DELETE journal history
