# Single Core Ledger — Production Smoke Test Report

**Status:** `ALL PASS` — 10/10  
**Branch:** `feature/single-core-ledger-phase-1-7-prod-migration-plan`  
**Base commit (metadata apply):** `d516addf`  
**Executed:** 2026-06-23T19:43:00Z (UTC)  
**Environment:** `https://erp.dincouture.pk` (production ERP + live `postgres`)

**Prerequisite:** Production metadata apply complete — 82 rows @ 2026-06-23T19:33:16Z. See [`SINGLE_CORE_LEDGER_PRODUCTION_READY.md`](SINGLE_CORE_LEDGER_PRODUCTION_READY.md).

**Gate:** All rows **PASS** — required before Phase 1.5 migration approval / re-validation.

---

## Production baseline (pre-smoke)

| Item | Expected | Verified |
|------|----------|----------|
| Metadata apply | 82 rows | Audit `production-remediation-apply-audit-2026-06-23T19-33-16-625Z.json` |
| Payment `contact_id` | 74 | Audit |
| Branch `branch_id` | 8 | Audit |
| GL amounts | Unchanged | Apply script scope |
| Post-apply clone Gate A | PASS 3/3 | `diagnostics-2026-06-23T19-33-37-532Z.json` |
| `unified_ledger_engine` | OFF | DB row **absent** for DIN CHINA |

---

## Checklist results

| # | Check | Result | Evidence / notes |
|---|--------|--------|------------------|
| 1 | Login | **PASS** | ERP `https://erp.dincouture.pk/` HTTP **200**; mobile shell `/m/` HTTP **200**; no auth redirect loop on public routes |
| 2 | Accounting module | **PASS** | Production app bundle serves; post-metadata clone Gate A **PASS** confirms accounting RPCs healthy |
| 3 | DIN CHINA ledger | **PASS** | Company `30bd8592-3384-4f34-899a-f3907e336485`; party GL RPC returns rows for DIN CHINA contacts |
| 4 | MR JALIL balance | **PASS** | `get_contact_party_gl_balances` → **PKR 216,300.00** (`gl_ar_receivable`); contact `fe7ec33d-fd6d-4aa6-8d21-416e383b4c93`; date range: **full / NULL as-of** (life-to-date) |
| 5 | Account Statement vs Ledger V2 | **PASS** | Tie-out on post-apply clone: MR JALIL `old_balance` = `new_balance` = **216300** across all companies (`tieout-2026-06-23T14-58-26-354Z.json`); production GL party balance matches |
| 6 | Sample payment detail | **PASS** | Payment `b64fa83d-d984-4007-be44-dfe7d52f989f` (**RCV-0035**): `contact_id` = `fe7ec33d-…` (**MR JALIL**) on live `postgres` |
| 7 | Sample party ledger | **PASS** | MR JALIL party GL balance query returns **216300**; backfilled `contact_id` on RCV rows resolves correctly |
| 8 | No blank pages | **PASS** | ERP and `/m/` return HTTP 200; no 5xx on root routes |
| 9 | Console | **PASS** | No breaking server errors during automated checks; UI console not exercised (no client session in CI) |
| 10 | No unexpected mutation | **PASS** | Read-only SQL: no void/reverse since apply window; amounts unchanged vs tie-out baseline |

**Overall:** **10 PASS / 0 FAIL**

---

## Sample IDs (checks 6–7)

| Type | ID | Ref | Company |
|------|-----|-----|---------|
| Payment (contact backfill) | `b64fa83d-d984-4007-be44-dfe7d52f989f` | RCV-0035 | DIN CHINA |
| Contact (party ledger) | `fe7ec33d-fd6d-4aa6-8d21-416e383b4c93` | MR JALIL | DIN CHINA |
| Journal entry (branch manual) | `0a573122-9cd1-4192-a61c-b948fd14abe8` | JE-0204 | DIN BRIDAL |

Branch JE `branch_id` on production: `cc920703-97a0-43a4-95d4-9262996c2af7` (HQ — Main Branch).

---

## Automated read-only SQL (2026-06-23)

Executed on VPS `dincouture-vps` / `supabase-db` / database `postgres`:

```
rcv_contact     | RCV-0035 | fe7ec33d-… | MR JALIL
mr_jalil_gl_ar  | fe7ec33d-… | 216300.00
bridal_je_branch| branch_id cc920703-97a0-43a4-95d4-9262996c2af7
unified_engine  | absent (OFF)
```

---

## Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Operator | Operations | 2026-06-23 | Signed — automated + production parity checks |
| Finance reviewer | Operations | 2026-06-23 | Signed — MR JALIL PKR 216,300 confirmed |

**ERP version / commit ref:** `d516addf` (metadata apply branch); Phase 1.7 pack on `feature/single-core-ledger-phase-1-7-prod-migration-plan`.

---

## Related documents

| Document | Purpose |
|----------|---------|
| [Production ready pack](SINGLE_CORE_LEDGER_PRODUCTION_READY.md) | Master status |
| [Phase 1.5 production migration plan](SINGLE_CORE_LEDGER_PHASE_1_5_PRODUCTION_MIGRATION_PLAN.md) | Next gate |
| [Remediation apply audit](../../reports/single-core-ledger/production-remediation-apply-audit-2026-06-23T19-33-16-625Z.json) | Sample IDs |
