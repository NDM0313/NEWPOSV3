# R8 Legacy Retirement — Operational Execution Report

**Date:** 2026-07-10  
**Project:** OLD ERP / DIN Collection ERP only  
**Approval:** `NADEEM_APPROVES_R8_LEGACY_RETIREMENT` — operator go-ahead **YES**  
**R8 scope this session:** **Operational retirement (R8-R1)** — not physical code deletion

---

## Status

| Item | Value |
|------|-------|
| R8 operational retirement | **COMPLETE** |
| Legacy loader **code** removed | **no** (L1 kill-switch + SQL rollback retained) |
| DB migrations | **no** |
| Production GL mutation | **no** |
| VPS frontend deploy | **skipped** (no `src/` retirement diff; flags already ON in DB) |

---

## Gates (execution day)

| Gate | Result |
|------|--------|
| Approval phrase | **present** |
| Pre-R8 git tag | `r8-pre-operational-retirement-20260710` @ `ba7dadd7` |
| `npm run test:unified-ledger` | **PASS** (after profile test sync) |
| `npm run build` | **PASS** |
| Fresh three-company monitoring | **PASS** — `three-company-monitoring-2026-07-10T16-26-36-059Z.md` |
| Loader guard (SSH) | **PASS** — 8/8 loaders ON × 3 companies |
| Admin Compare (din-china) | **9/9 PASS** (in monitoring run) |

---

## Production baseline at execution

| Item | Value |
|------|-------|
| URL | https://erp.dincouture.pk |
| Repo HEAD (pre-closeout) | `ba7dadd7` |
| VPS `erp-frontend` image | `24278015ba6b…` created 2026-07-10T16:21:31Z |
| Unified flags | 54 rows ON (3 companies × 18 flags); kill switch OFF |

---

## What R8-R1 means

1. **Canonical production path** for DIN CHINA, DIN BRIDAL, DIN COUTURE is **unified main loaders** on all 8 money-report screens.
2. **Legacy loader implementations remain in codebase** for emergency rollback (`unified_ledger_kill_switch` or per-loader OFF SQL).
3. **Phase 8 table/UI retirement** (`getCustomerLedger` hybrid shrink, `ledger_entries` mirror stop, etc.) is **future R8-R2+** work — not in this session per [`PHASE8_LEGACY_RETIREMENT_MAP.md`](../../docs/accounting/PHASE8_LEGACY_RETIREMENT_MAP.md).

---

## Rollback (unchanged)

| Layer | Action |
|-------|--------|
| L0 | `unified_ledger_kill_switch` ON |
| L1 | Company rollback SQL under `scripts/single-core-ledger/` |
| L2 | `git checkout r8-pre-operational-retirement-20260710` + `deploy/vps-build-erp-only.sh` |

---

## Safety attestation

| Item | Value |
|------|-------|
| Passwords committed | no |
| Play Store | not released |
| Supplier Party Discount QA | not run |
| R7 RPC apply | no |

---

## Next (optional R8-R2)

- Engineering audit: remove dead legacy **main** branches only after 30-day soak with kill-switch drill
- Phase 8 order: supplier `ledger_entries` write stop → customer synthetic narrow → worker fallback shrink
