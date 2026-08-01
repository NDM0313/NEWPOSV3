# Phase 2B — Report consistency, JE-0168, cancel policy, refresh diagnosis

**Baseline:** docs `21fcafab` · Phase 1 `057fcbc6` · Phase 2A `a2246876`  
**Scope:** Report filters, cancel/delete labels, trace visibility, build indicator.  
**Not started:** Cash Flow tab, FX, AR/AP GL post/reverse/repost, SQL migrations, hard delete of posted GL.

---

## Part A — JE-0168 / RCV-0001 diagnosis (production)

| Field | Value |
|--------|--------|
| **JE** | `JE-0168` (`9653d2d4-7253-4e59-8600-7e963dff9b5d`) |
| `reference_type` | `correction_reversal` |
| `reference_id` | voided payment JE `e2b443a9-d6bd-4307-9f99-67228adcd5fb` |
| `payment_id` | `070820eb-97af-44d0-bc25-98ad771c728b` (RCV-0001, Rs 1, **voided**) |
| `is_void` | false (reversal row is active audit trail) |
| **Lines** | Cash 1000 **Cr 1.00** · AR-CUS0000 **Dr 1.00** |
| **RCV-0001** | Rs 1 voided (`voided_at` set); separate Rs 50,000 active on-account row exists |
| **Mapping** | `journal_party_contact_mapping` present (Phase 2A Fix Link) |
| **Audit** | `party_repair_audit` / `ar_ap_relink_contact_audit_trace` present |

### Report visibility (before / after Phase 2B)

| Report | Normal | Audit |
|--------|--------|-------|
| Roznamcha | Excluded (voided payment stream + explicit `correction_reversal` filter) | Included with reversal label |
| Cash 1000 statement | **Was included** when Include reversals defaulted ON → **fixed** (default OFF for cash/bank) | Included when user enables Include reversals |
| Day Book | **Was included** (only `is_void` filtered) → **fixed** | Included in audit mode |
| Customer statement | Excluded (voided) | Included with reversals checkbox |
| Transaction / Payment Trace | Full chain visible | — |
| AR/AP Reconciliation | Trace-only relink (Phase 2A) | — |

**Verdict:** **Report-filter issue**, not a wrong GL posting. Rs 1.00 reversal correctly offsets voided RCV-0001. No delete, no second reversal, no GL amount change.

---

## Part B — Normal vs audit contract

Shared helper: `src/app/lib/reportVisibilityContract.ts`

Applied in:

- `roznamchaService.ts` — skip `correction_reversal` in normal mode; audit suffix on journal liquidity rows
- `DayBookReport.tsx` — skip `correction_reversal` when audit mode OFF; label in audit
- `AccountLedgerReportPage.tsx` — `isReversalRow` checks `je_reference_type`; cash/bank defaults `includeReversals: false`
- `transactionTraceReportVisibility.ts` — normal/audit pair per report surface

---

## Part C — Cancel / delete status matrix

| Surface | Draft / unposted | Posted / final |
|---------|------------------|----------------|
| Sale/Purchase/Rental payment UI | — | **Cancel Payment** label (modal + drawers) |
| Accounting `TransactionActionPanel` | — | Cancel Payment / Cancel Entry (Phase 1) |
| Expenses dashboard | **Delete** (hard remove row) | **Cancel Expense** (`cancelPostedExpense` — void JE/payment, `status=rejected`, keep row) |
| Source-document JE (sale/purchase/…) | — | Open Source Document · View Trace · View Audit only |
| Manual posted JE | — | Cancel Entry via action rules (detail modal) |

**Still operational (not hard-delete policy):** Payment cancel on sale/purchase pages still uses existing reversal services — labels aligned; behavior unchanged from Phase 2A.

---

## Part D — Trace mechanism

- `transactionTraceReportVisibility.ts` — normal + audit inclusion per report
- `transactionTraceSuggestedActions.ts` — advisory actions (Fix Link, Sync Payment, View Audit, No action)
- `TransactionTraceTab.tsx` — renders mode matrix + suggested actions

No auto-apply repairs without dry-run (unchanged).

---

## Part E — Office PC vs home PC “Refresh” / Retry

**Finding:** There is no global “Refresh Data” toolbar button in current `src/`. The visible amber banner with **Retry** comes from `Layout.tsx` when `SupabaseContext.connectionError` or `storageBlocked` is true (profile/session load failure, strict privacy blocking storage, or transient gateway errors).

| Check | Likely cause |
|-------|----------------|
| Same URL | Both should use `https://erp.dincouture.pk` |
| Same commit | Compare **Settings → App version · build** (`VITE_BUILD_COMMIT` from git at build) |
| PWA / cache | Office may have newer SW; home may serve stale bundle — use Settings **Clear cache & refresh** |
| Storage blocked | Private window / blocked cookies → Retry banner on office only |
| Role | Retry is not role-gated; connection error is per-browser session |
| Responsive | Retry banner is full-width; not hidden by breakpoint |

**Fixes in Phase 2B:** Build commit shown in Settings (`AppVersionTapTarget`). Cache instructions already in Settings.

---

## Files changed

- `src/app/lib/reportVisibilityContract.ts` (+ test)
- `src/app/lib/transactionTraceReportVisibility.ts` (+ test)
- `src/app/lib/transactionTraceSuggestedActions.ts`
- `src/app/lib/expenseCancelPolicy.ts`
- `src/app/lib/phase2bReportConsistency.test.ts`
- `src/app/services/roznamchaService.ts`
- `src/app/components/reports/DayBookReport.tsx`
- `src/app/components/reports/AccountLedgerReportPage.tsx`
- `src/app/services/expenseService.ts` — `cancelPostedExpense`
- `src/app/context/ExpenseContext.tsx`
- `src/app/components/dashboard/ExpensesDashboard.tsx`
- `src/app/components/shared/PaymentDeleteConfirmationModal.tsx`
- `src/app/components/sales/ViewPaymentsModal.tsx`, `ViewSaleDetailsDrawer.tsx`
- `src/app/components/purchases/ViewPurchaseDetailsDrawer.tsx`
- `src/app/components/admin/developer-center/TransactionTraceTab.tsx`
- `src/app/lib/paymentTraceDiagnostics.ts`
- `src/app/lib/developerMode.ts`, `AppVersionTapTarget.tsx`, `vite.config.ts`

---

## Tests run

```bash
npx tsx --test \
  src/app/lib/reportVisibilityContract.test.ts \
  src/app/lib/transactionTraceReportVisibility.test.ts \
  src/app/lib/phase2bReportConsistency.test.ts \
  src/app/lib/transactionActionRules.test.ts \
  src/app/lib/expensePaymentSync.test.ts \
  src/app/lib/accountingEditClassification.test.ts \
  src/app/lib/arApReconciliationAccess.test.ts \
  src/app/lib/arApRelinkApply.test.ts
npm run build
```

---

## Phase 2B.1 cleanup (post `a499e287`)

- **ExpensesList** aligned with `expenseCancelPolicy` (Delete vs Cancel Expense menu + confirm).
- **Docker build hash:** `VITE_BUILD_COMMIT` passed as build-arg from `deploy.sh` (`git rev-parse --short HEAD`) — no `.git` in image required.
- **Office vs home:** Settings → tap App version row → compare **build** hash; if stale vs VPS deploy, use **Clear cache & refresh**.
- AR/AP Reconciliation row menus: **Fix Link** (was “Relink dry-run”), **Preview posting** (was “Posting dry-run”).

## Remaining risks

- GL statement type still defaults `includeReversals: false` after change — users who relied on old default for non-cash GL must enable checkbox.
- Manual JE cancel in `TransactionDetailModal` may still set `is_void` on header — align with `createReversalEntry` in a future pass if required.

---

## Confirmations

- Cash Flow tab: **not started**
- SQL migrations: **none**
- AR/AP GL post/reverse/repost: **still disabled**
- JE-0168: **not deleted, not re-reversed**
