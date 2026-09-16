# Phase 2.15 — Rollback plan

## L1 — Roznamcha loader OFF

```sql
UPDATE feature_flags
SET enabled = false, updated_at = now()
WHERE company_id = '30bd8592-3384-4f34-899a-f3907e336485'
  AND feature_key = 'unified_ledger_loader_roznamcha';
```

## L2 — Roznamcha screen OFF

```sql
UPDATE feature_flags
SET enabled = false, updated_at = now()
WHERE company_id = '30bd8592-3384-4f34-899a-f3907e336485'
  AND feature_key = 'unified_ledger_screen_roznamcha';
```

## L3 — Frontend rollback

Retag `erp-frontend:rollback-before-215-*` on VPS if bundle regression.

## Triggers

- Roznamcha totals ≠ legacy golden
- LV2/AS/TB/PL MR JALIL ≠ 216,300
- Trial Balance debit ≠ credit
- Wrong company flags

## Unaffected loaders (do not disable)

- `unified_ledger_loader_ledger_v2`
- `unified_ledger_loader_account_statement`
- `unified_ledger_loader_trial_balance`
- `unified_ledger_loader_party_ledger`
