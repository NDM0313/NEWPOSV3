# Single Core Engine A-to-Z Audit — 2026-07-15

**Scope:** OLD ERP / DIN Collection ERP only (not FX / multi-currency exchange app)
**Repo HEAD at audit:** `5cf65f4c`
**Evidence pack:** [`reports/single-core-engine-a-to-z-audit-20260715/`](../../reports/single-core-engine-a-to-z-audit-20260715/)
**Prior closeout (superseded where conflicting):** [`SINGLE_CORE_ENGINE_CLOSEOUT_FINAL_2026-07-12.md`](SINGLE_CORE_ENGINE_CLOSEOUT_FINAL_2026-07-12.md)

---

## 1. Executive summary

The Single Core Engine **eight money-report loaders are operationally live** on DIN CHINA / DIN BRIDAL / DIN COUTURE: production flags show **54 ON**, kill switch **OFF**, unified RPCs **active**, VPS git/runtime HEAD **equals** GitHub `5cf65f4c`, `erp-frontend` healthy, HTTPS **200**.

The program is **not technically closed** and **not fully retired**: R8-R2 deletion is deferred (soak **5/30**, earliest **2026-08-09**); AR/AP Phase 2b remains **not production complete** (live DIN BRIDAL `effective_party` Δ **79850**); three closeout evidence folders cited on 2026-07-12 are **missing from git**. Play Store is **skipped** and is **not** a core blocker.

Local validation 2026-07-15: unified **339/339**, unit **183/183**, build **PASS**. Three-company browser monitor **not re-run** (missing QA passwords).

---

## 2. Exact scope

See [`scope-matrix.md`](../../reports/single-core-engine-a-to-z-audit-20260715/scope-matrix.md).

**CORE:** Ledger V2, Account Statement, Trial Balance, Party Ledger, Roznamcha, Cash Flow, Balance Sheet, P&L + flags/kill/resolvers/monitoring.

**EXTENSION:** AR/AP Reconciliation Center Phase 2b.

**OUTSIDE:** Contacts page RPC, mobile/Play Store, FX app, Phase 8 broad retirement, import-gap WIP.

**AR/AP Phase 2b vs original SCE:** optional/scheduled **Phase 2b extension** — not required for core operational completion; incomplete for program technical closeout if extensions are included.

---

## 3. Full timeline

See [`commit-timeline.md`](../../reports/single-core-engine-a-to-z-audit-20260715/commit-timeline.md).

Spine: Phase 0–1.8 RPCs → Phase 2.x previews → 2.10–2.14 loader swaps → Phase 3B/3D CF/BS/P&L → calendar Days 7–15 → R8-R1 (2026-07-10) → Sales Revenue 4000 → Salesman QA → Phase 2.16 golden → AR/AP 2b (bridal FAIL) → deferred R8-R2.

---

## 4. Architecture

Triple-gate dual loader: **kill → loader → engine → screen → unified**, else legacy. Code defaults legacy; production three companies override ON.

```mermaid
flowchart TD
  kill[env_or_DB_kill]
  loader[loader_flag]
  engine[engine_flag]
  screen[screen_flag]
  kill -->|ON| legacy[Legacy_main]
  kill -->|OFF| loader
  loader -->|OFF| legacy
  loader -->|ON| engine
  engine -->|OFF| legacy
  engine -->|ON| screen
  screen -->|OFF| legacy
  screen -->|ON| unified[Unified_main]
```

RPC backbone: `get_unified_party_ledger`, `get_unified_account_ledger`, `get_unified_cash_bank_ledger`, `get_unified_trial_balance`, `get_unified_contact_party_gl_balances` (AR/AP only).

---

## 5. Loader matrix

See [`loader-matrix.md`](../../reports/single-core-engine-a-to-z-audit-20260715/loader-matrix.md).

| Screen | Classification |
|--------|----------------|
| Ledger V2 | UNIFIED CANONICAL |
| Account Statement | UNIFIED CANONICAL |
| Trial Balance | UNIFIED CANONICAL |
| Party Ledger | UNIFIED CANONICAL |
| Roznamcha | UNIFIED CANONICAL |
| Cash Flow | UNIFIED CANONICAL |
| Balance Sheet | UNIFIED CANONICAL |
| Profit & Loss | UNIFIED CANONICAL |
| AR/AP Center | HYBRID / PRODUCTION BLOCKED (parity) |
| Contacts | LEGACY ACTIVE / OUT OF SCOPE |

No ops company silently defaults to legacy while flags remain as snapshotted. Contacts always legacy.

---

## 6. RPC / migration inventory

See [`rpc-migration-inventory.md`](../../reports/single-core-engine-a-to-z-audit-20260715/rpc-migration-inventory.md).

Live `pg_proc` confirms core unified RPCs + `get_unified_contact_party_gl_balances` + legacy `get_contact_party_gl_balances`. Committed ≠ applied assumption rejected — each core RPC verified live.

---

## 7. Production deployment state

See [`production-deployment-matrix.md`](../../reports/single-core-engine-a-to-z-audit-20260715/production-deployment-matrix.md).

| Item | Value |
|------|--------|
| GitHub HEAD | `5cf65f4c` |
| VPS HEAD | `5cf65f4c` |
| Runtime delta | **0** |
| HTTP | 200 |
| erp-frontend | healthy; `VITE_BUILD_COMMIT=5cf65f4c` |
| Pending SCE deploy | none |
| Pending SCE core migration | none known |

---

## 8. Test history

See [`test-history.md`](../../reports/single-core-engine-a-to-z-audit-20260715/test-history.md).

| Suite | 2026-07-15 |
|-------|------------|
| unified-ledger | **339/339 PASS** |
| unit | **183/183 PASS** |
| build | **PASS** |
| monitoring | credential gate FAIL (not run) |
| AR/AP parity | bridal FAIL via SSH SQL |

Counts: 336→339 unified (+Phase 2b / suite growth); 182→183 unit; closeout **189** not reproduced on current script list.

---

## 9. Monitoring status

See [`monitoring-audit.md`](../../reports/single-core-engine-a-to-z-audit-20260715/monitoring-audit.md).

Flags green live; last three-company PASS **2026-07-12** (`8bbb01f0`). Goldens are snapshot-based → future live GL can false-fail. JE-0028 / Phase2 reclass evidence packs missing.

---

## 10. Accounting decisions

See [`accounting-decisions.md`](../../reports/single-core-engine-a-to-z-audit-20260715/accounting-decisions.md).

Locked: future sales **4000**; China historical **4100** preserved; **no** blanket reclass; Supplier Discount **5210** / JE-0028 claimed; bases `effective_party` / `official_gl` / `audit_full_history`.

Open: Bridal Walk-in effective_party deltas; missing JE-0028 evidence pack.

---

## 11. AR/AP Phase 2b status

See [`ar-ap-phase2b-status.md`](../../reports/single-core-engine-a-to-z-audit-20260715/ar-ap-phase2b-status.md).

| Gate | YES/NO |
|------|--------|
| Development | YES |
| GitHub | YES |
| Migration | YES |
| Frontend deployed | YES |
| COUTURE parity | YES |
| CHINA parity | YES |
| BRIDAL effective_party | **NO** |
| official_gl / audit_full_history (bridal) | YES |
| Production UI verified | NO |
| Production complete | **NO** |

Blocker: Walk-in Customer old Δ **80000** (+ Walk-in Δ **150**).

---

## 12. Legacy inventory

See [`legacy-inventory.md`](../../reports/single-core-engine-a-to-z-audit-20260715/legacy-inventory.md).

Four `*LegacyMainService.ts` wrappers; page branches for L2/CF/BS/P&L; hybrid `getCustomerLedger`; Contacts legacy RPC; shadow compare retained.

---

## 13. R8 status

See [`r8-status.md`](../../reports/single-core-engine-a-to-z-audit-20260715/r8-status.md).

| Item | Status |
|------|--------|
| R8-R1 | OPERATIONAL COMPLETE 2026-07-10 |
| Kill-switch drill | Claimed PASS; evidence **MISSING** → UNVERIFIED |
| Soak | **5/30** (from 2026-07-10) |
| Earliest deletion | **2026-08-09** |
| R8-R2 approval | NOT GRANTED |
| R8-R2 deletion | NOT STARTED |

---

## 14. Mobile status

See [`mobile-status.md`](../../reports/single-core-engine-a-to-z-audit-20260715/mobile-status.md).

MOBILE QA COMPLETE; PLAY STORE NOT RELEASED; **NOT CORE BLOCKER**.

---

## 15. Safety audit

See [`safety-audit.md`](../../reports/single-core-engine-a-to-z-audit-20260715/safety-audit.md).

This session: no migrations, GL repairs, JE posts, kill toggles, deletes, or deploys. Unrelated WIP (import-gap, cashbook, graphify) **excluded** from commit.

---

## 16. Completion scorecard

See [`completion-scorecard.md`](../../reports/single-core-engine-a-to-z-audit-20260715/completion-scorecard.md).

| Metric | % |
|--------|---|
| Core architecture | 95 |
| Unified loaders | 95 |
| Production deployment | 98 |
| Monitoring | 80 |
| Accounting correctness | 90 |
| Rollback/fallback | 95 |
| Legacy retirement | 40 |
| AR/AP Phase 2b | 55 |
| Mobile QA | 85 |
| Documentation/evidence | 75 |
| Overall operational | **88** |
| Overall technical closeout | **62** |
| Overall program | **70** |

---

## 17. Remaining task register

See [`remaining-task-register.md`](../../reports/single-core-engine-a-to-z-audit-20260715/remaining-task-register.md).

Mandatory: Bridal parity investigation (extension); restore missing evidence; post-soak R8-R2 only after drill+approval. Optional: Play Store, Contacts wire-up. Do not start R8-R2 deletion before **2026-08-09**.

---

## 18. Evidence index

See [`evidence-index.md`](../../reports/single-core-engine-a-to-z-audit-20260715/evidence-index.md).

**Missing:** kill-switch drill, sales-revenue phase2 closeout, supplier PKR1 QA folders (cited 2026-07-12, not in git).

---

## 19. Final verdict

| Question | Answer |
|----------|--------|
| Single Core Engine operationally complete? | **YES** |
| Single Core Engine technically closed? | **NO** |
| Single Core Engine fully retired? | **NO** |
| AR/AP Phase 2b production complete? | **NO** |
| Play Store blocks core completion? | **NO** |

**How much work is done:** Core unified path is live, deployed, flag-gated, tested, and (by last monitor) stable.
**How much remains:** R8-R2 retirement, AR/AP bridal parity, evidence repair, optional mobile release.
**Exact next safe action:** Read-only Bridal Walk-in investigation **or** wait out soak / restore missing evidence — no mutations.
**Must not be done yet:** R8-R2 deletion, kill toggle, 4100 reclass, claiming 100% technical closeout, staging unrelated WIP.
