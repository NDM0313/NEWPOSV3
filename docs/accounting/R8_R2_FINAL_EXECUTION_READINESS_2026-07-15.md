# R8-R2 Final Execution Readiness — 2026-07-15

**Scope:** OLD ERP / DIN Collection ERP only (not FX / multi-currency)
**Repo HEAD at pack creation:** `b8fec34b`
**Evidence:** [`reports/r8-r2-final-readiness-20260715/`](../../reports/r8-r2-final-readiness-20260715/)
**Execution prompt (do not run before gate):** [`R8_R2_EXECUTION_PROMPT_FOR_2026-08-09.md`](R8_R2_EXECUTION_PROMPT_FOR_2026-08-09.md)

> **No physical legacy deletion on 2026-07-15. No production kill-switch drill. No deploy.**

---

## 1. Executive status

| Item | Status |
|------|--------|
| Single Core operationally complete | **YES** |
| Technically closed | **NO** |
| Fully retired | **NO** |
| AR/AP Phase 2b production complete | **YES** (`a5149971` + `b8fec34b` docs; official_gl parity PASS ×3; max Δ 0) |
| Eight main loaders | **UNIFIED CANONICAL** |
| Production HTTP / erp-frontend | **200** / **healthy** |
| Kill switch | **OFF** |
| Legacy fallback + kill support | **Retained** |
| R8-R2 deletion | **NOT STARTED** — date gate |

---

## 2. Date gate

| Field | Value |
|-------|-------|
| Current date | 2026-07-15 |
| Gate met | **NO** |
| Physical deletion | **PROHIBITED** |

---

## 3. Soak calculation

| Field | Value |
|-------|-------|
| R8-R1 start | 2026-07-10 |
| Required days | 30 |
| Elapsed | **5** |
| Remaining | **25** |
| Earliest deletion | **2026-08-09** |

See [`soak-calculation.md`](../../reports/r8-r2-final-readiness-20260715/soak-calculation.md).

---

## 4. Current production state

| Area | GitHub | Production | Verified | Remaining |
|------|--------|------------|----------|-----------|
| Core unified engine | R8-R1 complete | 54 flags ON; kill OFF | YES | Maintain |
| AR/AP Phase 2b | complete on main | deployed; parity PASS | YES | None core |
| Monitoring | last PASS 2026-07-12 | fresh: CREDENTIAL_GATE | PARTIAL | Re-run with shell QA env |
| R8-R1 | COMPLETE | loaders canonical | YES | None |
| R8-R2 | readiness only | legacy code present | YES | Wait ≥2026-08-09 |
| Mobile/Play Store | skipped upload | N/A | YES | Outside R8-R2 |

Details: [`production-state.md`](../../reports/r8-r2-final-readiness-20260715/production-state.md).

---

## 5. Current test state

| Check | Result |
|-------|--------|
| `test:unified-ledger` | **343/343 PASS** |
| `test:unit` | **183/183 PASS** |
| `build` | **PASS** |
| `git diff --check` | **PASS** (readiness scope) |
| Monitoring | **CREDENTIAL_GATE** — last verified PASS **2026-07-12** (not FAIL) |

---

## 6. Legacy inventory

Authoritative table: [`legacy-inventory.md`](../../reports/r8-r2-final-readiness-20260715/legacy-inventory.md).

Headline: 4 thin `*LegacyMainService.ts` wrappers + 6 page legacy branches are primary deletion targets after soak; BS/P&L error fallback last; shadow / hybrid / Contacts / mobile / resolvers / flags / kill / L1 SQL / loader guard **retained**.

---

## 7. Exact deletion manifest

[`deletion-manifest.md`](../../reports/r8-r2-final-readiness-20260715/deletion-manifest.md) — sections A–D.

**A:** wrappers + page branches (+ optional BS/P&L)
**B:** must-retain
**C:** outside scope
**D:** human decisions (shadow retarget; BS/P&L timing)

---

## 8. Must-retain list

[`must-retain-list.md`](../../reports/r8-r2-final-readiness-20260715/must-retain-list.md).

Intentionally retained diagnostic/rollback/hybrid components are **not** failed deletions.

---

## 9. Dependency analysis

[`dependency-analysis.md`](../../reports/r8-r2-final-readiness-20260715/dependency-analysis.md).

Critical: shadow services import thin LegacyMain wrappers — deletion PR **must** retarget those imports in the same change set. Do not delete merely because filename contains `Legacy`.

---

## 10. Operator drill runbook

[`kill-switch-drill-runbook.md`](../../reports/r8-r2-final-readiness-20260715/kill-switch-drill-runbook.md).

| Prior claim (2026-07-12) | **RETRACTED** — no evidence pack |
| Fresh drill | **Required after soak, before deletion** |
| Executed 2026-07-15 | **NO** |

---

## 11. Rollback plan

[`rollback-plan.md`](../../reports/r8-r2-final-readiness-20260715/rollback-plan.md).

- **L0** kill switch
- **L1** loader flag rollback SQL (~36 scripts) — no accounting data changes
- **L2** tag `r8-r2-pre-code-deletion-20260809` (created on exec day) + ERP-only redeploy

Tag **not** created on 2026-07-15.

---

## 12. Test plan

[`test-plan.md`](../../reports/r8-r2-final-readiness-20260715/test-plan.md).

---

## 13. Deployment plan

[`deployment-plan.md`](../../reports/r8-r2-final-readiness-20260715/deployment-plan.md) — frontend only; do not combine with Contacts/mobile/Play Store/repairs/import-gap/graphify.

---

## 14. Evidence checklist

Present under `reports/r8-r2-final-readiness-20260715/`:

- [x] baseline.txt
- [x] production-state.md
- [x] validation.txt
- [x] soak-calculation.md
- [x] legacy-inventory.md
- [x] deletion-manifest.md
- [x] must-retain-list.md
- [x] dependency-analysis.md
- [x] kill-switch-drill-runbook.md
- [x] rollback-plan.md
- [x] test-plan.md
- [x] deployment-plan.md
- [x] august-execution-checklist.md
- [x] final-report.md

Excluded: passwords, `.env`, dumps, APK/AAB/IPA, keystore, graphify-out, unrelated WIP, repair/mutation SQL.

---

## 15. Completion criteria

| State | Meaning | Current | After successful R8-R2 |
|-------|---------|---------|------------------------|
| **A. Operationally complete** | 8 loaders live unified; kill OFF; monitoring OK | **YES** | **YES** |
| **B. Technically closed** | Soak+drill+approved deletion of approved main-loader legacy; no mandatory core blocker | **NO** | **YES** if no other mandatory core blocker remains |
| **C. Fully retired** | Approved main-loader scope retired; retained items documented | **NO** | **YES** for approved main-loader scope |

---

## 16. Exact August execution instructions

1. Open [`R8_R2_EXECUTION_PROMPT_FOR_2026-08-09.md`](R8_R2_EXECUTION_PROMPT_FOR_2026-08-09.md).
2. Re-check real calendar date — stop if before 2026-08-09.
3. Require `R8_R2_CODE_DELETION_APPROVAL_REQUIRED`.
4. Fresh operator drill → monitoring → tag → delete only A candidates → validate → frontend deploy → closeout.
5. See [`august-execution-checklist.md`](../../reports/r8-r2-final-readiness-20260715/august-execution-checklist.md).

---

## 17. Approval gate

Physical deletion requires **all** of:

1. Date ≥ **2026-08-09**
2. Phrase: **`R8_R2_CODE_DELETION_APPROVAL_REQUIRED`**
3. Fresh attested kill-switch drill PASS
4. Fresh three-company monitoring PASS

Without these, stop.
