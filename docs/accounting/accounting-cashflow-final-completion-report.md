# Accounting / Cash Flow — Final Completion Report

**Date:** 2026-06-12  
**Starting commit:** `ad6184e6` — feat(accounting): polish cash flow exports and read-only ui  
**Scope:** CF-2 GL strip, repair queue expense/payment detection, Fix Link polish, cancel/delete verification, build hash documentation.

---

## Commits

| Role | Hash | Message |
|------|------|---------|
| Start | `ad6184e6` | CF-1.1 cash flow exports and read-only UI |
| Final | `2b530e1d` | feat(accounting): complete cash flow and transaction repair cleanup |

---

## Files changed

| File | Change |
|------|--------|
| `src/app/components/reports/CashFlowReportPage.tsx` | CF-2 GL summary strip; parallel load with operational grid |
| `src/app/lib/cashFlowReportLogic.ts` | GL entry visibility helpers + mode note |
| `src/app/lib/cashFlowReportLogic.test.ts` | GL normal/audit tests |
| `src/app/services/accountingReportsService.ts` | `getCashFlowStatement` accepts `auditMode`; excludes `correction_reversal` in Normal |
| `src/app/services/expensePaymentSyncService.ts` | `listExpensePaymentRepairCandidates` auto-scan |
| `src/app/lib/repairQueueDryRun.ts` | `expensePaymentCandidateToDryRunPreview` |
| `src/app/lib/repairQueueDryRun.test.ts` | Expense repair preview tests |
| `src/app/services/accountingDeveloperCenterService.ts` | Repair queue snapshot includes expense mismatches |
| `src/app/components/admin/developer-center/RepairQueueTab.tsx` | Expense/payment mismatch table + queue action |
| `src/app/components/accounting/ArApRepairDialogs.tsx` | “Fix Link wizard” wording |
| `src/app/components/accounting/ArApReconciliationCenterPage.tsx` | “Fix Link…” label consistency |
| `docs/accounting/cash-flow-plan.md` | CF-2 status |
| `docs/accounting/accounting-cashflow-final-completion-report.md` | This report |

**Excluded (unrelated):** FinancialTrace, graphify, flutter APK, trace txt, local z-index fixes.

---

## Features completed

### CF-2 — GL Cash Flow Summary strip

- **Operating Cash Flow**, **Investing Cash Flow**, **Financing Cash Flow**, **Net GL Cash Flow**
- Uses existing `accountingReportsService.getCashFlowStatement`
- Operational roznamcha grid unchanged below the strip
- **Normal mode:** excludes `correction_reversal` (JE-0168 class)
- **Audit mode:** includes correction/reversal entries
- Tab remains **read-only** (no mutations)

### CF-1.1 polish (already deployed at start)

- Print + CSV export, loading/empty/error+retry, badge labels, running-balance note, responsive layout

### Expense/payment repair queue

- Auto-detects paid expenses where `expense.amount ≠ payments.amount`
- Repair allowed only when JE liquidity amount matches expense (metadata fix on `payments.amount`)
- Dry-run via existing `expense.sync_linked_payment_amount` repair action
- Audit log via `logDocumentEditActivity` on apply
- **No GL line amount changes**

### Fix Link

- Remaining “Relink dry-run” tooltip → “Fix Link wizard”
- “Fix Link (preview)” → “Fix Link…”
- Save Link / Save Link for Trace unchanged (metadata-only, GL unchanged)
- JE-0168-class rows traceable via trace-only relink path

### Cancel / Delete policy (verified via tests)

| Surface | Behavior |
|---------|----------|
| Posted payments | **Cancel Payment** (not Delete) |
| Draft/unposted expenses | **Delete Expense** |
| Posted expenses | **Cancel Expense** |
| Source-document JEs (sale/purchase/rental/studio) | Open Source Document, View Trace, View Audit only |
| Manual JE | **Cancel Entry** when not source-controlled (existing policy) |

No changes to Sale/Purchase/Rental/Studio cancel from Accounting.

### Build hash / cache

- Settings → **App version · build** shows `VITE_BUILD_COMMIT` baked at Docker build
- Compare hash on office vs home PC; if stale → **Settings → Clear cache & refresh** (Ctrl+Shift+R)
- Implemented in `AppVersionTapTarget.tsx` + `developerMode.ts`

---

## JE-0168 status

| Mode | Operational grid | GL summary strip |
|------|------------------|------------------|
| Normal | Excluded | Excluded (`correction_reversal` filter) |
| Audit | Shown with Reversed + Audit badges | Included for traceability |

**No GL mutations** to JE-0168 or linked rows.

---

## Tests run

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
  src/app/lib/repairQueueDryRun.test.ts
```

**Result:** 40/40 pass

```bash
npm run build
```

**Result:** Success

---

## Deploy

- **Frontend only:** rebuild + recreate `erp-frontend`
- **No DB restart, no migrations**

---

## Remaining known issues

1. **Expense scan limit:** Repair queue scans last 80 paid expenses on refresh — older mismatches may need manual expense lookup in Developer Center trace.
2. **GL vs operational totals:** GL summary (journal-classified) and operational grid (roznamcha/payment-sourced) may differ by design; filters on operational grid do not re-classify GL buckets.
3. **Manual JE cancel:** Still uses existing void path; no new safe-cancel RPC in this release.
4. **AR/AP GL post/reverse/repost:** Intentionally not enabled.

---

## Next recommended step

1. Smoke-test Cash Flow tab on production: Normal excludes JE-0168 in both strips; Audit shows it with badges.
2. If expense/payment drift exists, use Developer Center → Repair Queue → expense mismatch row → dry-run → apply.
3. Optional follow-up: widen expense scan or add Integrity Lab rule for persistent mismatch detection.
