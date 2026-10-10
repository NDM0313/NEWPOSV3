# Phase 2.9A-4 — Staff / manager visibility

**Status:** BLOCKED — no staff/manager user on DIN CHINA company

## Read-only DB (2026-06-25)

```sql
SELECT email, role FROM users
WHERE company_id = '30bd8592-3384-4f34-899a-f3907e336485'
  AND role IN ('staff','manager','viewer');
-- 0 rows
```

Only admin on DIN CHINA: `din@yahoo.com` (admin).

## Unit test evidence (unchanged)

`ledgerV2UnifiedPreviewAccess.test.ts` — staff cannot access Ledger V2 unified preview; admin/developer can.

## Operator follow-up

Create or use a staff login on DIN CHINA (or another pilot company) and confirm **no** “Unified engine preview” toggle on Ledger V2 + one other preview screen.
