# Repo safety snapshot — Mac Home Sync Audit

**Run:** MAC HOME SYNC AUDIT — POST OFFICE MERGE TASK CLASSIFICATION  
**Generated:** 2026-06-29  
**Machine:** Home MacBook  
**Operator context:** Office work pulled; local merge commit `ae6c69d0` on `main`

---

## Git state

| Check | Result |
|-------|--------|
| Current branch | `main` |
| HEAD | `ae6c69d0` — `wip: party ledger discount + signup OTP + ledger v2 filters` |
| `origin/main` | `e49800a1` — 1 commit behind local HEAD |
| Ahead of origin | **Exactly 1 commit** (`ae6c69d0`) — matches expected merge commit |
| Staged files | **None** |
| WIP branch preserved | `wip/mac-ledger-discount-signup-20260629` @ `6ce1bd90` (pre-rebase); rebased content merged into `main` |

---

## Working tree (uncommitted)

| Path | State | Action |
|------|-------|--------|
| `graphify-out/.graphify_root` | Modified | **Do not commit** — AST graph auto-update |
| `graphify-out/GRAPH_REPORT.md` | Modified | **Do not commit** |
| `downloads/` | Untracked | **Excluded** — artifacts |
| `erp-flutter-app/releases/` | Untracked | **Excluded** — APK artifacts |

---

## Local commit vs origin (`origin/main...HEAD`)

**16 files changed**, +1422 / −498 lines:

| Status | Path |
|--------|------|
| M | `src/app/components/auth/CreateBusinessWizard.tsx` |
| M | `src/app/features/ledger-statement-center-v2/LedgerFilterBar.tsx` |
| M | `src/app/features/ledger-statement-center-v2/LedgerStatementCenterV2Page.tsx` |
| A | `src/app/features/ledger-statement-center-v2/PartyLedgerDiscountModal.tsx` |
| M | `src/app/features/ledger-statement-center-v2/types.ts` |
| M | `src/app/lib/paymentVoidVisibility.ts` |
| M | `src/app/services/accountingReportsService.ts` |
| M | `src/app/services/accountingService.ts` |
| A | `src/app/services/authSignupService.ts` |
| M | `src/app/services/businessService.ts` |
| M | `src/app/services/ledgerStatementCenterV2Service.ts` |
| M | `src/app/services/liveDataRepairService.ts` |
| A | `src/app/services/partyLedgerDiscountService.ts` |
| M | `src/app/services/paymentAdjustmentService.ts` |
| M | `src/app/services/roznamchaService.ts` |
| M | `src/app/services/studioCostsService.ts` |

---

## Safety confirmations

| Rule | Status |
|------|--------|
| No credentials staged | **PASS** — nothing staged |
| No `.env` in diff | **PASS** |
| No `service_role` in ae6c69d0 feature files | **PASS** (verified in code review) |
| graphify-out uncommitted | **PASS** — modified locally only |
| downloads/ excluded | **PASS** |
| erp-flutter-app/releases/ excluded | **PASS** |
| No VPS / deploy / migration actions in this run | **PASS** |

---

## Recent commit log (HEAD)

```
ae6c69d0 wip: party ledger discount + signup OTP + ledger v2 filters
e49800a1 docs(accounting): Phase 3B-M Cash Flow loader swap execution evidence
36543345 feat(accounting): Cash Flow unified main loader (Phase 3B-M)
```

## Recent commit log (origin/main)

```
e49800a1 docs(accounting): Phase 3B-M Cash Flow loader swap execution evidence
36543345 feat(accounting): Cash Flow unified main loader (Phase 3B-M)
1cdedc9d docs(accounting): prepare Cash Flow loader swap readiness pack
```
