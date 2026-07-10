# Production unified ledger flag snapshot (read-only)

**Date:** 2026-07-10  
**Source:** `scripts/single-core-ledger/query-unified-ledger-flags-readonly.sql` via SSH `dincouture-vps`  
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
| `unified_ledger_kill_switch` | 0 | **Not enabled** (good — no forced legacy) |

**Total unified_ledger rows:** 54 (18 per company × 3 companies)

## Loader guard

- **PASS** — only DIN CHINA, DIN BRIDAL, DIN COUTURE have loaders ON (8 each)
- Evidence: [`loader-guard-20260710.json`](./loader-guard-20260710.json)

## Rollback reference (pre-R8)

Per-company L1 rollback SQL templates under `scripts/single-core-ledger/` (din-china phase-21x, din-bridal, din-couture). Do not run without R8 approval.
