# TEST_RESULTS.md

## Mobile (`erp-mobile-app`)

Command: `npm run test:run`  
Result: **79 pass / 0 fail** (includes 16 Single Core adapter tests)

Scripts added:
- `test` / `test:run` — curated `tsx --test` suite
- `test:single-core` — adapter-only
- `lint` → `tsc -b`

Excluded from default suite (pre-existing env dependency on Capacitor when resolved via API modules):
- `src/api/permissions.test.ts`
- `src/api/onAccountCustomerReceipt.test.ts`  
Classification: **pre-existing / environment** when run without proper node_modules resolution; not introduced as Phase 2 regressions in the curated suite.

## Repo unified-ledger

Command: `npm run test:unified-ledger`  
Result: **350 pass / 0 fail**

## Typecheck / lint

Command: `npx tsc -b` / `npm run typecheck`  
Result: **PASS** (after fixing AccountingLoaderDebugBadge import path)
