# Phase 2.13 — Party Ledger loader rollback plan

## Immediate rollback triggers

- Party Ledger crash or blank table
- Golden party closing ≠ legacy golden
- LV2 / AS / TB golden breaks
- Pilot Batch ≠ 9/9
- Wrong company/screen flags ON
- RPC/console error spike

## L1 — loader OFF (first response)

```sql
UPDATE feature_flags
SET enabled = false, updated_at = now()
WHERE company_id = '30bd8592-3384-4f34-899a-f3907e336485'
  AND feature_key = 'unified_ledger_loader_party_ledger';
```

**Effect:** Party Ledger main returns legacy immediately (no redeploy).

## L2 — screen OFF

```sql
UPDATE feature_flags
SET enabled = false, updated_at = now()
WHERE company_id = '30bd8592-3384-4f34-899a-f3907e336485'
  AND feature_key = 'unified_ledger_screen_party_ledger';
```

## L3 — engine OFF (all unified screens)

```sql
UPDATE feature_flags
SET enabled = false, updated_at = now()
WHERE company_id = '30bd8592-3384-4f34-899a-f3907e336485'
  AND feature_key = 'unified_ledger_engine';
```

## L4 — kill switch

Env `VITE_UNIFIED_LEDGER_ENGINE_KILLED=true` or DB `unified_ledger_kill_switch`.

## Frontend rollback

Redeploy prior Docker tag (`erp-frontend:rollback-before-213-*`) if code defect; flags-only issues do not require redeploy.

## Verification after rollback

Run `run-phase-213-party-ledger-loader-browser-qa.mjs rollback` — expect `data-party-ledger-main-loader="legacy"`.
