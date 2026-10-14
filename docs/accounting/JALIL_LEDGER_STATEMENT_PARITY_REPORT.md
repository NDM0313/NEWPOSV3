# JALIL Ledger Statement Parity Report

**Branch:** `feature/ledger-statement-v2-jalil-parity`  
**Date:** 2026-06-14  
**Customer:** MR JALIL  
**Status:** Safe frontend date-range parity fix applied — **ready for frontend-only deploy approval** after user review.

---

## Absolute constraints (confirmed)

| Constraint | Status |
|---|---|
| DB migrations run | **No** |
| Live DB data mutated | **No** (read-only SQL on VPS only) |
| `unified_ledger_engine` enabled | **No** |
| Single Core Ledger Phase 1.5 touched | **No** |
| Batch A.1 modal fix touched | **No** |
| Auto-fix balances / journal changes | **No** |

---

## Task 1 — Reproduce and capture exact inputs

### Contact identity (production read-only)

| Field | Value |
|---|---|
| `contact_id` | `fe7ec33d-fd6d-4aa6-8d21-416e383b4c93` |
| `contact_code` | *(empty)* |
| `name` | MR JALIL |
| `company_id` | `30bd8592-3384-4f34-899a-f3907e336485` |
| `type` | customer |
| Linked AR subledger | `AR-FE7EC3` — Receivable — MR JALIL (`4818c6a9-9a03-43bc-a0b4-6b82b08e40c3`) |

### Screens involved

| UI label | Component | Route / tab |
|---|---|---|
| Account Statements — **Standard (PDF / share)** | `LedgerStatementCenterV2Page` (embedded) | Accounting → Account Statements |
| Account Statements — **Advanced (effective / audit)** | `AccountLedgerReportPage` | Accounting → Account Statements |
| Party Ledger drawer | `EffectivePartyLedgerPage` | Contacts → Party Ledger (separate; not primary mismatch) |
| Customer ledger drawer (legacy) | `UnifiedLedgerView` | Uses `getCustomerLedger` + **branch header filter** |

### Observed balances (production GL truth)

| Source | Balance (PKR) | Notes |
|---|---|---|
| `get_contact_party_gl_balances` (life-to-date AR) | **216,300.00** | Canonical GL party balance |
| RPC `get_customer_ar_gl_ledger_for_contact` last `running_balance` (full range) | **216,300.00** | 15 JE rows; sale + 14 receipts |
| Subledger account `AR-FE7EC3` journal net | **216,300.00** | 15 lines; debits 2,616,300; credits 2,400,000 |
| Period closing if `date_to = 2025-12-19` | **1,216,300.00** | ≈ **12.16 lakh** — matches user “12–14 lakh” band |
| Period closing if `date_to = 2026-04-27` (last payment) | **216,300.00** | ≈ **2.16 lakh** — matches user “~216,000” |

### Row counts

| Path | Row count | Opening row | Synthetic rows |
|---|---|---|---|
| GL RPC (full range) | 15 | Injected when `startDate` set in TS loader | `getCustomerLedger` may merge missing docs; JALIL has full JE coverage — **0 synthetic** in practice |
| Payments table (received, not voided) | 10 | — | — |

### Filters at time of investigation

| Filter | Account Statements Advanced | Ledger V2 Standard (before fix) | Ledger V2 Standard (after fix) |
|---|---|---|---|
| Branch | All branches (`STATEMENT_ALL_BRANCHES_SCOPE`) | All branches (loader) but UI said “header filter” | All branches — **tab From/To** |
| `date_from` / `date_to` | Tab DatePickers (`accountStatementStart/End`) | **Global header filter only** | **Same tab DatePickers as Advanced** |
| Basis | `audit_full` default (`includeAdjustments=true`) | `official_gl` (raw JE rows) | Same |
| Effective vs audit | Advanced toggles via adjustment/reversal checkboxes | N/A (no collapse) | N/A |

---

## Task 2 — Data path trace

### Account Statement path (Advanced — customer)

| Step | Detail |
|---|---|
| Screen | `AccountLedgerReportPage.tsx` |
| Trigger | `applied.statementType === 'customer'` + `applied.selectedContactId` |
| Service | `accountingService.getCustomerLedger(contactId, companyId, undefined, startDate, endDate)` |
| Branch | `STATEMENT_ALL_BRANCHES_SCOPE` = `undefined` (all branches) |
| GL RPC | Indirect — hybrid loader queries AR subtree journal lines + optional synthetic merge |
| Synthetic rows | Yes — merges sales/payments/rentals missing from JE set (`gl_journal_only` off) |
| Void/correction | Included in raw load; **effective** mode hides via `shouldIncludePartyEffectiveRow` |
| Basis | `viewMode`: `effective_party` if both adjustments & reversals off; else `audit_full` |
| Closing balance | From `presentedEntries` after `alignRunningBalances` (presentation layer) |

### Ledger Statement Center V2 path (Standard)

| Step | Detail |
|---|---|
| Screen | `LedgerStatementCenterV2Page.tsx` → `getLedgerStatementV2` |
| Service | `ledgerStatementCenterV2Service.loadGlEntries` → **`accountingService.getCustomerLedger`** (same loader) |
| Branch | `STATEMENT_ALL_BRANCHES_SCOPE` = `undefined` |
| GL RPC | Same hybrid path (not `getCustomerArGlJournalLedger` RPC-only) |
| Synthetic rows | Same merge rules as Advanced |
| Presentation | `glToRows` — **no** effective collapse; optional txn-type/search filters only |
| Closing balance | Last row `running_balance` from loader (period-scoped) |

### Account Statement path vs Ledger V2 path

| Aspect | Account Statements (Advanced) | Ledger V2 (Standard) |
|---|---|---|
| Loader function | `getCustomerLedger` | `getCustomerLedger` |
| `getCustomerArGlJournalLedger` / RPC-only | No | No |
| Branch param | `undefined` (all) | `undefined` (all) |
| Date range source (**root issue**) | Tab DatePickers | **Was:** global header only → **Fixed:** tab DatePickers |
| Effective collapse | Yes (when audit toggles off) | No |
| `customerLedgerAPI` operational path | No | No (diagnostic panel only) |
| `unified_ledger_engine` | Off | Off |

**Conclusion:** Same canonical loader; mismatch was **period (`date_to`) source**, not separate engines.

---

## Task 3 — Read-only row-level diff

### Helper

- `src/app/services/ledgerStatementParityDiagnostics.ts` — request builders, row snapshots, `diffLedgerStatementRows`
- `scripts/diagnostics/run-ledger-statement-parity.mjs` — VPS read-only SQL runner
- `scripts/diagnostics/jalil_*.sql` — production evidence queries

### JALIL diff summary (same loader, different `date_to`)

| Metric | `date_to = 2025-12-19` | `date_to = 2026-04-27` |
|---|---|---|
| Closing | 1,216,300 | 216,300 |
| Difference | **1,000,000** | — |
| Extra rows in longer period | 8 payment receipts (RCV-0092 … RCV-0213) | — |

Rows only in longer period: payment credits after 2025-12-19 totaling PKR 1,000,000 — explains the entire gap.

---

## Task 4 — Root cause and fix

### Root cause

**Safe frontend parameter mismatch:** Accounting → Account Statements **Standard (V2)** used the **global header date filter** while **Advanced** used **tab-local From/To pickers**. For JALIL, an end date around **2025-12-19** yields closing **PKR 1,216,300** (~12 lakh); full range through **2026-04-27** yields **PKR 216,300** (~2.16 lakh). Both are correct *for their respective periods* — the UI did not make that explicit and the two modes did not share the same period controls.

Not caused by: synthetic row double-count, branch filter, opening duplication, void/correction visibility, or `unified_ledger_engine`.

### Fix applied

1. **`AccountingDashboard.tsx`** — Moved From/To DatePickers **above** Standard/Advanced toggle; both modes share `accountStatementStart` / `accountStatementEnd`.
2. **`LedgerStatementCenterV2Page.tsx`** — Added `periodStart`, `periodEnd`, `periodLabel` props; embedded accounting view uses tab dates instead of header-only.
3. **`LedgerFilterBar.tsx`** — Period hint distinguishes tab vs header source.

### Files changed

- `src/app/components/accounting/AccountingDashboard.tsx`
- `src/app/features/ledger-statement-center-v2/LedgerStatementCenterV2Page.tsx`
- `src/app/features/ledger-statement-center-v2/LedgerFilterBar.tsx`
- `src/app/services/ledgerStatementParityDiagnostics.ts` *(new)*
- `src/app/services/ledgerStatementParityDiagnostics.test.ts` *(new)*
- `scripts/diagnostics/run-ledger-statement-parity.mjs` *(new)*
- `scripts/diagnostics/jalil_*.sql` *(new, read-only)*

---

## Task 5 — Tests and build

### Tests added

`src/app/services/ledgerStatementParityDiagnostics.test.ts`:

- Same params → matching service request
- Date mismatch detection
- Row diff / balance difference
- Opening row handling
- Synthetic row flagging

### Commands run

```bash
npx vitest run src/app/services/ledgerStatementParityDiagnostics.test.ts
# 6 passed (6)

npm run build
# ✓ built in ~41s
```

---

## Before / after (JALIL)

| Scenario | Before fix | After fix |
|---|---|---|
| Advanced To = 2026-04-27 | 216,300 | 216,300 |
| Standard with header end ≈ 2025-12-19 | **1,216,300** | N/A — uses tab dates |
| Standard + Advanced same tab To = 2026-04-27 | **Mismatch** | **216,300 both** |

---

## Deploy

- **Not deployed** — awaiting user approval.
- Frontend-only; no migrations.

---

## Next recommended step

1. User QA on production clone: open Accounting → Account Statements, set **same From/To** on tab, toggle Standard ↔ Advanced for MR JALIL — closing should match (216,300 for full range through latest receipt).
2. If user still sees drift with **identical tab dates**, capture screenshot of period banner + row count and re-run `node scripts/diagnostics/run-ledger-statement-parity.mjs`.
3. Longer term (out of scope): optional effective-mode toggle on V2 for parity with Advanced presentation — **not required** for this balance gap.
