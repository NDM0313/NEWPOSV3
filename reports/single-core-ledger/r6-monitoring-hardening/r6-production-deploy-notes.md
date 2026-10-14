# R6 — Production frontend deploy notes

**Date:** 2026-06-27T09:40:57Z (approx)  
**VPS:** dincouture-vps  
**URL:** https://erp.dincouture.pk  
**Git HEAD on VPS:** `542301fc`  
**Build label:** `542301fc`  
**Rollback tag:** `erp-frontend:rollback-before-r6-20260627094057`

---

## Deploy scope

Frontend Docker rebuild + recreate `erp-frontend` only.

**Includes:** R2 Admin Compare Cash/Bank diagnostic UI (`Raw GL diagnostic` label found in `UnifiedLedgerTieOutPage-*.js`).

**Excluded:** flag SQL, migrations, GL mutations, other-company enablement.

---

## Pre-deploy flag read (DIN CHINA — all ON)

| Flag | Enabled |
|------|---------|
| unified_ledger_pilot | t |
| unified_ledger_engine | t |
| unified_ledger_loader_ledger_v2 | t |
| unified_ledger_screen_ledger_v2 | t |
| unified_ledger_loader_account_statement | t |
| unified_ledger_screen_account_statement | t |
| unified_ledger_loader_trial_balance | t |
| unified_ledger_screen_trial_balance | t |
| unified_ledger_loader_party_ledger | t |
| unified_ledger_screen_party_ledger | t |
| unified_ledger_loader_roznamcha | t |
| unified_ledger_screen_roznamcha | t |

**Other-company unified loaders:** 0 rows enabled.

---

## Result

**SUCCESS** — container started. No flags changed.

---

## Post-deploy monitoring

Browser monitoring re-run not executed (no `QA_BROWSER_PASSWORD` in CI/local deploy session). Phase 2.16 golden values remain authoritative until optional re-run:

```bash
MONITORING_PROFILE=din-china QA_BROWSER_PASSWORD=... node scripts/single-core-ledger/run-unified-ledger-monitoring-verify.mjs
```
