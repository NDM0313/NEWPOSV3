# Post-deploy monitoring

**Run:** `npm run monitor:three-company-unified-ledger`  
**Generated:** 2026-06-30T09:12:14Z  
**Overall:** **FAIL** (exit code 1)  
**Deployed commit:** `a83522f7`

## Profile results

| Profile | Result | Notes |
|---------|--------|-------|
| din-china | **FAIL** | TB + MR JALIL goldens PASS; Admin Compare 9/9 FAIL |
| din-bridal | **PASS** | Unchanged |
| din-couture | **PASS** | Unchanged |

## DIN CHINA — closed drift items

| Check | Result |
|-------|--------|
| MR JALIL closing (Account Stmt / Party Ledger / Ledger V2) | **PASS** — 216299 |
| Trial Balance golden total | **PASS** — 407957272.02 |
| Trial Balance debit = credit | **PASS** |

## Remaining failure

| Check | Result | Classification |
|-------|--------|----------------|
| Admin Compare Pilot Batch 9/9 | **FAIL** — pass=0 fail=9 | `RETAINED_JE_ENGINE_TIEOUT_BASELINE` |

Pilot batch tie-out compares **legacy hybrid engine vs unified engine** closing balances per row. Retained **JE-0003** (`party_discount`, PKR 1) is reflected in unified loaders (216299) but legacy hybrid path still closes at **216300**, producing |diff|=1 on all 9 matrix rows.

This is **not** stale frontend constant drift — production bundle contains **216299** (`CompareSummaryCards-*.js`).

## Guards

- `migrations_run`: false  
- `gl_mutations`: false  
- `other_company_loaders_on`: 0  

## Scope closure

| Approved item | Status |
|---------------|--------|
| TB golden +PKR 1 | **CLOSED** |
| Frontend constant deploy | **CLOSED** |
| Full monitoring exit 0 | **OPEN** — tie-out baseline needs separate operator decision (waiver / monitoring rule / hybrid engine alignment) |
