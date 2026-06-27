# Three-company unified ledger — operational monitoring runbook

**Program:** OLD ERP Single Core Ledger  
**Production:** https://erp.dincouture.pk  
**Last updated:** 2026-06-14

---

## Purpose

Periodic read-only verification that DIN CHINA, DIN BRIDAL, and DIN COUTURE unified loaders remain live and golden report totals match finance-approved fixtures.

---

## Prerequisites

- `QA_BROWSER_PASSWORD` set in environment (**never commit**, **never log**)
- Optional per-company login overrides:
  - `QA_BROWSER_EMAIL_CHINA` (default: `din@yahoo.com`)
  - `QA_BROWSER_EMAIL_BRIDAL` (default: `ndm313@yahoo.com`)
  - `QA_BROWSER_EMAIL_COUTURE` (default: `zhd@dincouture.pk`)
- Network access to production ERP and VPS SSH for read-only flag SQL

---

## Run one profile manually

```powershell
$env:QA_BROWSER_PASSWORD="<from-secret-store>"
$env:MONITORING_PROFILE="din-china"   # or din-bridal, din-couture
$env:QA_BROWSER_EMAIL="din@yahoo.com" # optional override
node scripts/single-core-ledger/run-unified-ledger-monitoring-verify.mjs
```

Exit code `0` = PASS; non-zero = investigate (do not auto-fix production).

---

## Run all three profiles (recommended)

```powershell
$env:QA_BROWSER_PASSWORD="<from-secret-store>"
npm run monitor:three-company-unified-ledger
```

Writes timestamped reports to:

- `reports/single-core-ledger/operational-monitoring/three-company-monitoring-<timestamp>.md`
- `reports/single-core-ledger/operational-monitoring/three-company-monitoring-<timestamp>.json`

---

## Expected golden values

### DIN CHINA (`din-china`)

| Check | PKR |
|-------|-----|
| MR JALIL closing (LV2 / AS / Party Ledger) | 216,300 |
| Trial Balance debit = credit | 407,957,271.02 |
| Roznamcha In / Out / Closing | 136,158,012 / 67,042,426 / 69,115,586 |

### DIN BRIDAL (`din-bridal`)

| Check | PKR |
|-------|-----|
| MR REHAN ALI closing | 530,000 |
| Trial Balance debit = credit | 21,919,575 |
| Roznamcha In / Out / Closing | 1,836,350 / 917,780 / 918,570 |

### DIN COUTURE (`din-couture`)

| Check | PKR |
|-------|-----|
| DHARIA closing | 4,488,088 |
| Trial Balance debit = credit | 49,747,104 |
| Roznamcha In / Out / Closing | 85,000 / 34,500 / 50,500 |

---

## Read-only flag verification

```powershell
Get-Content scripts/single-core-ledger/three-company-loader-guard-pipe.sql | ssh dincouture-vps "docker exec -i supabase-db psql -U postgres -d postgres -t -A"
```

Expect only DIN CHINA, DIN BRIDAL, DIN COUTURE with 5 loaders each. **Other-company loaders must be 0.**

---

## Failure actions

1. **Do not auto-fix** flags, GL, or balances  
2. **Do not run migrations** without separate approval  
3. Capture monitoring JSON/MD and open investigation report  
4. Use L1 rollback SQL only with finance + ops incident approval  
5. Re-run single profile after any approved fix

---

## Rollback references

| Company | Scripts |
|---------|---------|
| DIN CHINA | `scripts/single-core-ledger/phase-21x-rollback-*.sql` |
| DIN BRIDAL | `scripts/single-core-ledger/din-bridal/db-rollback-*.sql` |
| DIN COUTURE | `scripts/single-core-ledger/din-couture/dc-rollback-*.sql` |

---

## Policies

| Policy | Rule |
|--------|------|
| Credentials | Env only; never in git, reports, or screenshots |
| Auto-fix | **Forbidden** for production accounting data |
| Migrations | **Forbidden** in monitoring runs |
| R7 / R8 | **Forbidden** without separate approval |
| Next company | **Forbidden** without finance sign-off |

---

## Baseline references

- [`three-company-monitoring-baseline.json`](../final-program-archive/three-company-monitoring-baseline.json)
- [`final-program-archive-report.md`](../final-program-archive/final-program-archive-report.md)
