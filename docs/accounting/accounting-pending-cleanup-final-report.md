# Accounting Pending Cleanup — Final Report

**Date:** 2026-06-12  
**Starting commit:** `f64cae33` — feat(accounting): complete cash flow and transaction repair cleanup

---

**Final commit:** `96981d23` — fix(accounting): finish pending cash flow and repair cleanup

---

## Files changed

| File | Change |
|------|--------|
| `src/app/services/expensePaymentSyncService.ts` | Filterable `searchExpensePaymentRepairCandidates`; on-demand vs recent scan |
| `src/app/lib/expensePaymentSyncLogic.ts` | Search/mismatch pure helpers |
| `src/app/lib/expensePaymentSync.test.ts` | Search + min-mismatch tests |
| `src/app/components/admin/developer-center/RepairQueueTab.tsx` | Search UI (expense/payment no, dates, branch, min mismatch) |
| `src/app/services/accountingDeveloperCenterService.ts` | Removed auto 80-expense scan on page load |
| `src/app/lib/cashFlowReportLogic.ts` | Tie-out computation + diagnostic hints |
| `src/app/lib/cashFlowReportLogic.test.ts` | Tie-out tests |
| `src/app/components/reports/CashFlowReportPage.tsx` | Tie-out / Difference section |
| `src/app/lib/manualJournalCancelPolicy.ts` | Document safe void-header cancel for manual JEs |
| `src/app/lib/manualJournalCancelPolicy.test.ts` | Cancel Entry policy tests |
| `src/app/components/accounting/TransactionDetailModal.tsx` | Cancel Entry label + confirm copy |
| `src/app/components/accounting/ArApReconciliationCenterPage.tsx` | GL repair disabled wording |
| `docs/accounting/accounting-pending-cleanup-final-report.md` | This report |

---

## Repair queue full/search detection

| Item | Status |
|------|--------|
| Default page load | Lightweight — no full expense scan |
| Scan recent | Last 80 paid expenses (on button) |
| Search | Expense no, payment ref, date range, branch, min mismatch (up to 200 rows) |
| Older records | Found via explicit Search, not limited to recent 80 |
| Dry-run | Shows expense/payment/JE liquidity/proposed/canApply/blockReason |
| Apply | `expense.sync_linked_payment_amount` — payments.amount only when JE matches expense |
| Audit | `logDocumentEditActivity` on apply |

---

## Cash Flow tie-out

| Item | Status |
|------|--------|
| Operational Net Movement | From roznamcha-style summary |
| GL Summary Net Movement | From `getCashFlowStatement` |
| Difference | Operational − GL, displayed with explanation |
| Diagnostic hints | Manual JE, reversal/audit, unclassified, missing party/branch |
| Values | Not forced to match — explanation only |
| JE-0168 Normal | Excluded from both operational and GL strips |
| JE-0168 Audit | Visible with Reversed/Audit badges |
| Tab | Read-only — no cancel/edit/repair |

---

## Manual JE cancel decision

**Decision: keep existing safe `is_void` header path — no migration, no createReversalEntry change.**

| Behavior | Detail |
|----------|--------|
| Label | **Cancel Entry** (not Delete/Reverse) |
| Mechanism | `journal_entries.is_void = true` + void_reason + voided_at |
| Hard delete | Never |
| Normal reports | Hidden after void |
| Audit | Traceable via void flags |
| Source-document JEs | Not eligible — Open Source Document / View Trace / View Audit only |
| Payment-linked JEs | Cancel Payment path (payment lifecycle) |

Documented in `manualJournalCancelPolicy.ts`.

---

## AR/AP GL apply status

| Item | Status |
|------|--------|
| `canApplyGlRepair` | **false** for all roles |
| UI | “GL posting/reverse/repost is intentionally disabled for safety” |
| Fix Link | Metadata-only contact mapping — GL unchanged |
| Block reason | Shown when GL repair attempted |

---

## JE-0168 status

- **Normal Cash Flow:** excluded (operational + GL summary)
- **Audit Cash Flow:** included with Reversed + Audit badges
- **GL rows:** unchanged

---

## Tests

```bash
npx tsx --test \
  src/app/lib/cashFlowReportLogic.test.ts \
  src/app/lib/reportVisibilityContract.test.ts \
  src/app/lib/phase2bReportConsistency.test.ts \
  src/app/lib/transactionActionRules.test.ts \
  src/app/lib/expensePaymentSync.test.ts \
  src/app/lib/accountingEditClassification.test.ts \
  src/app/lib/arApReconciliationAccess.test.ts \
  src/app/lib/arApRelinkApply.test.ts \
  src/app/lib/repairQueueDryRun.test.ts \
  src/app/lib/manualJournalCancelPolicy.test.ts
```

**Result:** 47/47 pass

**Build:** `npm run build` — success

---

## Deploy

- Frontend only: rebuild + recreate `erp-frontend`
- No DB restart, no migrations

---

## Remaining intentionally disabled

1. **AR/AP GL post/reverse/repost** — requires explicit approval and migration review
2. **FX / multi-currency** — not started
3. **Cash Flow row mutations** — no cancel/edit/repair from Cash Flow tab
4. **Forced tie-out reconciliation** — differences explained, not auto-adjusted
5. **Manual JE createReversalEntry parity** — deferred; void header remains canonical safe path

---

## Next recommended step

1. Smoke-test Repair Queue → Search by expense no for any known older mismatch (e.g. EXP-0021 class).
2. Verify Cash Flow tie-out section on production with Normal/Audit toggle.
3. Confirm Settings → App version/build shows deployed commit after hard refresh.
