# Production unified ledger flag snapshot — post R8-R1

**Date:** 2026-07-10  
**Source:** `scripts/single-core-ledger/query-unified-ledger-flags-readonly.sql` via SSH `dincouture-vps`  
**Command:** `docker exec -i supabase-db psql -U postgres -d postgres`  
**Mutations:** none

## Company IDs

| Company | company_id |
|---------|------------|
| DIN COUTURE | `2ab65903-62a3-4bcf-bced-076b681e9b74` |
| DIN CHINA | `30bd8592-3384-4f34-899a-f3907e336485` |
| DIN BRIDAL | `597a5292-14c8-4cd8-96bd-c61b5a0d8c92` |

## Summary (all three companies)

| Flag group | Count enabled | Notes |
|------------|---------------|-------|
| `unified_ledger_engine` | 3/3 | ON |
| `unified_ledger_pilot` | 3/3 | ON |
| `unified_ledger_loader_*` | 8×3 = 24 | All 8 loader flags ON per company |
| `unified_ledger_screen_*` | 8×3 = 24 | All 8 screen flags ON per company |
| `unified_ledger_kill_switch` | 0 | **OFF** (no forced legacy) |

**Total `unified_ledger%` rows returned:** 54 (18 per company × 3 companies)

## Loader guard

- **PASS** — monitoring read-only guard confirms only DIN CHINA, DIN BRIDAL, DIN COUTURE have loaders ON
- Evidence: `reports/single-core-ledger/operational-monitoring/three-company-monitoring-2026-07-10T16-52-09-806Z.md`

## Safety

| Item | Status |
|------|--------|
| DB migrations | not run |
| Flag mutations | none |
| GL mutations | none |
