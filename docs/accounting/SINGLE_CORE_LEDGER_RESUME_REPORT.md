# Single Core Ledger — Resume Report

**Date:** 2026-06-23  
**Branch:** `feature/single-core-ledger-phase-1-5-systemwide`  
**Gate:** **PHASE 1.5 NOT VALIDATED — data/engine issues must be resolved first**

---

## Parked side tasks (not part of Single Core)

| Workstream | Branch | Status |
|------------|--------|--------|
| Batch A / A.1 transaction actions | `feature/accounting-transaction-actions-batch-a` | Deployed; parked |
| JALIL date-range parity | `feature/ledger-statement-v2-jalil-parity` | Frontend period fix only; **not** single-core completion |

---

## Task 1 — Repo re-center

| Check | Result |
|-------|--------|
| Branch | `feature/single-core-ledger-phase-1-5-systemwide` |
| Commits (base) | `0334fe51`, `b45e1873` |
| `npm run test:unified-ledger` | **19/19 pass** |
| Unrelated WIP staged | **No** (local DIN CHINA / Batch A edits remain unstaged) |
| `.env.local` staged | **No** |

**Additional commits pending push (this session):** migration enum casts + VPS clone validation tooling.

---

## Task 2 — Staging / clone target

**Choice: Option B — VPS isolated database clone** (Cloud staging `wrwljqzckmnmuphwhslt.supabase.co` still unreachable).

| Field | Value |
|-------|-------|
| Target type | `vps_isolated_clone` |
| DB host | `172.19.0.15` (docker `supabase-db` internal) |
| Database | **`ledger_stage_20260623`** |
| Live production DB | **`postgres`** — **not used** for validation |
| Supabase API | **Not used** (`UNIFIED_LEDGER_PG_ONLY=1`) |
| Staging guards | `UNIFIED_LEDGER_STAGING=1`, `UNIFIED_LEDGER_VPS_CLONE=1`, `UNIFIED_LEDGER_TIEOUT_STAGING=1` |
| Validation repo on VPS | `/root/NEWPOSV3-phase-15-validate` |

Clone created via `scripts/single-core-ledger/create-vps-ledger-clone.sh` (pg_dump `postgres` → restore into `ledger_stage_20260623`, ~153 MB).

---

## Task 3 — Phase 1.5 migrations (clone only)

**Command:** `CLONE_DB=ledger_stage_20260623 bash scripts/single-core-ledger/apply-phase-15-docker-exec.sh`

| Migration | Status |
|-----------|--------|
| `20260620140000_get_unified_party_ledger_shadow.sql` | Applied (after `sale_status::text` cast fix) |
| `20260621120000_single_core_ledger_systemwide_diagnostics.sql` | Applied (after enum cast fix) |
| `20260621150000_unified_ledger_phase_15_rpcs.sql` | Applied |
| `20260621151000_unified_ledger_phase_15_indexes.sql` | Applied |

**RPC verification (clone):** all 5 present — `get_unified_party_ledger`, `get_unified_account_ledger`, `get_unified_cash_bank_ledger`, `get_unified_trial_balance`, `get_single_core_ledger_systemwide_diagnostics`.

**Production `postgres` database:** migrations **not** applied.

---

## Task 4 — Diagnostics & tie-out (real runs)

### Systemwide diagnostics

| Field | Value |
|-------|-------|
| Run timestamp (UTC) | `2026-06-23T14:20:34.284Z` |
| companies_count | **3** |
| JSON | `reports/single-core-ledger/diagnostics-2026-06-23T14-20-34-284Z.json` |
| SHA256 | `b07fd3deb18924111b9b284ddd84cc7639dc56daa99bc6c659edc82a4fc848cd` |
| Status | **FAIL** (strict) |
| strict_pass / strict_fail | 1 / 2 |
| branch_attribution_risk_total | **8** |

**Per company:**

| Company | strict_pass | payments_missing_contact | branch_attribution_risk |
|---------|-------------|--------------------------|-------------------------|
| DIN BRIDAL | FAIL | 4 | 4 |
| DIN CHINA | FAIL | 70 | 4 |
| DIN COUTURE | PASS | 0 | 0 |

### DIN CHINA pilot tie-out

| Field | Value |
|-------|-------|
| Run timestamp (UTC) | `2026-06-23T14:20:51.991Z` |
| companies_count | 1 |
| JSON | `reports/single-core-ledger/tieout-2026-06-23T14-20-51-991Z.json` |
| SHA256 | `144c6d65bf238c5f82f32818a3294d4054d1b09e8f94a35b3b42739d54988cac` |
| Comparisons | 6 / 6 **PASS** (max diff 0) |
| JALIL official_gl / effective / audit | legacy 216,300 = unified 216,300 |
| Trial balance (All branches) | balanced (diff 0) |
| Trial balance (BL0002) | balanced (diff 0) |
| Cash/bank (All branches) | 408 rows, 14 liquidity accounts |
| BL0001 / HQ branch scope | **Not resolved** in pilot RPC block (branch code mismatch on clone); only All + BL0002 ran |

### All-company tie-out

**Not run** — stopped after DIN CHINA pilot per performance/safety scope; diagnostics strict failures require remediation first.

---

## Task 5 — Gate decision

### **PHASE 1.5 NOT VALIDATED — data/engine issues must be resolved first**

**Why not Gate A:**

- Systemwide diagnostics: **2/3 companies strict_fail** (`payments_missing_contact_sale_linked`, `branch_attribution_risk`)
- `branch_attribution_risk_total = 8` (NULL-branch transactional JEs — sample in diagnostics JSON)
- DIN CHINA pilot **ledger RPC tie-out passes**, but data-quality gates block systemwide sign-off

**What succeeded:**

- Reachable staging clone path proven (VPS `ledger_stage_20260623`)
- Phase 1.5 migrations apply cleanly on clone (after enum cast fixes)
- DIN CHINA golden contacts (JALIL + CUS-0000): **legacy_gl_rpc vs get_unified_party_ledger** — zero diff all three bases
- Unified trial balance + cash/bank RPCs balanced on clone for DIN CHINA

---

## Files changed (this session)

| Area | Files |
|------|-------|
| Migrations | `20260620140000_*.sql`, `20260621120000_*.sql`, `20260621150000_*.sql` (enum/text casts) |
| Clone tooling | `create-vps-ledger-clone.sh`, `apply-phase-15-docker-exec.sh`, `run-vps-clone-validation.sh`, `staging-clone.env.example` |
| Staging guard | `staging-env-guard.mjs` (VPS clone + docker IP SSL) |
| Tie-out PG mode | `pg-rpc-client.mjs`, `run-unified-ledger-tieout.mjs` |
| Reports | This file + updated diagnostic/tie-out/verification reports + JSON artifacts |

---

## Tests run

```text
npm run test:unified-ledger → 19/19 pass
```

---

## Remaining risks

1. **Payment contact backfill** — 70 DIN CHINA / 4 DIN BRIDAL payments missing `contact_id` on sale-linked receipts (strict diagnostic).
2. **Branch attribution** — 8 JEs with NULL `branch_id` on transactional reference types.
3. **BL0001 pilot branch** — not matched for TB/cash RPC scope; verify branch `code` on clone vs `pilot-companies.json`.
4. **Hybrid / operational paths** — tie-out CLI covers `legacy_gl_rpc` only; `hybrid_frontend_equivalent` and `operational_open_items` remain Phase 2.
5. **`unified_ledger_engine`** — remains **OFF**; no production screen replacement.

---

## Next recommended phase

1. **Data remediation plan (read-only analysis first):** `payments_missing_contact_sale_linked` backfill design — no auto-fix on production.
2. **Branch attribution review:** classify NULL-branch JEs (opening vs transactional) against `v_single_core_ledger_branch_attribution_risk`.
3. **Re-run diagnostics on clone** after remediation scripts (staging only).
4. **Fix BL0001 branch matcher** in pilot config or data, re-run pilot tie-out including HQ scope.
5. **Then** Gate A re-evaluation → Phase 2 planning (screen wiring, hybrid adapter, operational_open_items RPC).

**Do not** enable `unified_ledger_engine` or apply Phase 1.5 migrations to live `postgres` until Gate A.

---

## Safety confirmations

| Rule | Status |
|------|--------|
| Live production DB mutated | **No** |
| Migrations on `postgres` | **No** |
| `unified_ledger_engine` enabled | **No** |
| Merge to main | **No** |
| Batch A / JALIL branches touched | **No** |
