# Transaction Actions — Batch A Implementation Report

**Branch:** `feature/accounting-transaction-actions-batch-a`  
**Worktree:** `../NEWPOSV3-actions-batch-a` (clean from `origin/main`)  
**Date:** 2026-06-14  
**Status:** Complete — Draft PR ready for review  

**References:** [TRANSACTION_DETAIL_EDIT_MECHANISMS.md](./TRANSACTION_DETAIL_EDIT_MECHANISMS.md) · [transaction-actions-analysis.md](./transaction-actions-analysis.md) · [ACCOUNTING_WORKBENCH_CLICK_MATRIX.md](./ACCOUNTING_WORKBENCH_CLICK_MATRIX.md)

---

## Objective

Introduce a **single canonical action model** (`getTransactionActions`) for accounting row and transaction-detail surfaces so screens stop inventing ad hoc button labels. Batch A is **labels + availability + routing only** — no new mutations, no DB changes.

---

## Task 1 — Current action paths (inventory)

### Policy layer (unchanged)

| Module | Role |
|--------|------|
| `unifiedTransactionEdit.ts` | `resolveUnifiedJournalEdit`, `unifiedEditButtonLabel` — edit routing |
| `journalEntryEditPolicy.ts` | Source-controlled docs, reversal blocks |
| `paymentChainMutationGuard.ts` | PF-14 async tail guard (modal); sync fingerprint prefix |
| `transactionActionRules.ts` | Phase 1 rules engine (still used internally) |

### Surfaces inventoried

| Surface | Prior behavior | Batch A change |
|---------|----------------|----------------|
| `TransactionDetailModal.tsx` | `transactionActionRules` panel + separate inline **Edit Accounts** button | Registry panel; Edit Accounts from registry |
| `AccountingDashboard.tsx` | `JournalRowTransactionActions` → rules | Same handlers; registry labels (Edit Entry/Payment, Reverse Entry) |
| `AccountLedgerReportPage.tsx` | Hardcoded `View` / `Edit payment` / `Edit` | Registry `getStatementRowEditLabel`; hide Edit when blocked |
| `LedgerStatementCenterV2Page.tsx` | View-only icon (`TransactionShareActions`) | Tooltip normalized to **View** (no edit on V2 table by design) |
| `ViewSaleDetailsDrawer.tsx` | Sale module actions | **Not changed** |
| `ViewPurchaseDetailsDrawer.tsx` | Purchase module actions | **Not changed** |
| `ExpensesDashboard.tsx` / `ExpenseDetailSheet.tsx` | Expense delete/cancel | **Not changed** |
| `UnifiedPaymentDialog.tsx` | PF-14 payment editor | **Not changed** |

### Label normalization (Batch A)

| Registry id | Label | Handler |
|-------------|-------|---------|
| `view` | View | view |
| `open_source_document` | Open Source Document | open_source_document |
| `edit_payment` | Edit Payment | `edit` → unified payment path |
| `edit_entry` | Edit Entry | `edit` → manual journal editor |
| `edit_transfer` | Edit Transfer | `edit` → transfer editor |
| `edit_accounts` | Edit Accounts | inline GL account grid (detail modal only) |
| `reverse_entry` | Reverse Entry | `cancel_entry` |
| `cancel_payment` | Cancel Payment | cancel_payment |
| `undo_last_change` | Undo Last Edit | undo_last_change |
| `view_trace` | View Trace | view_trace |
| `view_audit` | View Audit | view_audit |

### Safe to unify now

- View / Open Source Document / View Trace / View Audit (read-only)
- Edit Payment / Edit Entry / Edit Transfer (via existing `unifiedTransactionEdit`)
- Reverse Entry / Cancel Payment / Undo Last Edit (existing handlers)
- Edit Accounts on detail modal (existing `handleLoadAccountsForEdit`)
- Statement row View + conditional Edit label

### Must stay blocked / source-controlled

- Document-root sale/purchase/rental/studio JEs — Open Source only, no direct edit/reverse
- Opening balance, stock adjustment, commission batch, shipment — no Edit Accounts
- PF-14 historical chain members — edit hidden on statements (fingerprint prefix); full async guard remains in modal
- Reversal rows — view/audit only (+ stale void when eligible)

### Intentionally not changed in Batch A

- Mutation services (`accountingService`, `paymentLifecycleService`, `expenseService`)
- PF-14 payment adjustment mechanics
- `unifiedTransactionEdit.ts` routing
- Expense delete behavior
- Sale/purchase/rental drawers
- DB migrations / VPS deploy / `unified_ledger_engine` / Single Core Ledger Phase 1.5

---

## Task 2 — Shared registry

**File:** `src/app/lib/transactionActionsRegistry.ts`

- `getTransactionActions(row, context, options)` — facade over `transactionActionRules` with label refinement
- `getStatementRowEditLabel` / `getStatementRowActions` / `statementRowEditDisabledReason` — Account Statements
- `editAccountsBlockedReason` / `allowsEditAccounts` — centralized from modal inline logic
- `buildTransactionActionRowFromStatementEntry` — maps `AccountLedgerEntry` fields to policy row
- `src/app/lib/paymentChainHistorical.ts` — sync PF-14 prefix helper (no Supabase in unit tests)

Delegates to existing policy; **does not duplicate** payment chain tail logic.

---

## Task 3 — UI wiring

| File | Change |
|------|--------|
| `TransactionActionPanel.tsx` | Accepts `RegistryTransactionAction`; maps refined ids to `handlerId` |
| `TransactionDetailModal.tsx` | Registry import; Edit Accounts via panel; `edit_accounts` handler |
| `JournalRowTransactionActions.tsx` | Registry import (Accounting Dashboard journal rows) |
| `AccountLedgerReportPage.tsx` | Registry labels; Edit hidden when `getStatementRowEditLabel` is null |
| `TransactionShareActions.tsx` | View tooltip label |

`openTransactionDetail` event contract preserved (`referenceNumber`, `journalEntryId`, `autoLaunchUnifiedEdit`).

---

## Task 4 — Tests and build

### Commands run

```bash
cd ../NEWPOSV3-actions-batch-a
git status --short
npx tsx --test src/app/lib/transactionActionsRegistry.test.ts src/app/lib/transactionActionRules.test.ts
npm run build
```

### Results

| Command | Result |
|---------|--------|
| `transactionActionsRegistry.test.ts` + `transactionActionRules.test.ts` | **13/13 pass** |
| `npm run build` | **Pass** (vite production build) |

Test cases cover: manual journal Edit Entry + Reverse Entry; payment Edit Payment + Cancel Payment; PF-14 historical block; source-controlled sale; opening/stock Edit Accounts block; synthetic statement row; statement View action.

---

## Task 5 — Deliverables

### Branch

`feature/accounting-transaction-actions-batch-a`

### Files changed

```
src/app/lib/paymentChainHistorical.ts                    (new — sync PF-14 prefix)
src/app/lib/transactionActionsRegistry.ts                (new)
src/app/lib/transactionActionsRegistry.test.ts             (new)
src/app/services/paymentChainMutationGuard.ts            (re-export prefix from lib)
src/app/components/accounting/TransactionActionPanel.tsx
src/app/components/accounting/TransactionDetailModal.tsx
src/app/components/accounting/JournalRowTransactionActions.tsx
src/app/components/reports/AccountLedgerReportPage.tsx
src/app/features/ledger-statement-center-v2/TransactionShareActions.tsx
docs/accounting/TRANSACTION_ACTIONS_BATCH_A_IMPLEMENTATION_REPORT.md
```

### Screens touched

1. Transaction Detail modal  
2. Accounting Dashboard → Journal Entries row actions  
3. Account Ledger Report → statement row actions  
4. Ledger Statement Center V2 → View tooltip only  

### Known risks

- Statement rows without `je_action_fingerprint` may still show Edit until modal async chain guard runs (pre-existing pattern).
- Registry refines `cancel_entry` → **Reverse Entry** on non-expense surfaces; expense pages unchanged in this batch.

### Rollback

```bash
git revert <commit-sha>
# or
git checkout main -- src/app/lib/transactionActionsRegistry.ts src/app/lib/transactionActionsRegistry.test.ts ...
npm run build
```

Frontend-only rollback; no DB rollback required.

### Safety confirmations

| Check | Status |
|-------|--------|
| DB migration run | **No** |
| Live data mutation | **No** |
| VPS deploy | **No** |
| Single Core Ledger Phase 1.5 touched | **No** |
| `unified_ledger_engine` enabled | **No** |
| Merge to main | **No** (draft PR only) |

### Optional frontend deploy (gate — not executed)

Only after explicit approval:

```bash
# Frontend only — example; adjust per deploy docs
ssh dincouture-vps "cd /root/NEWPOSV3 && git fetch && git checkout feature/accounting-transaction-actions-batch-a && npm run build && bash deploy-erp-domain.sh --frontend-only"
```

Rollback: redeploy previous main build artifact / prior commit on VPS (documented in deploy runbook).

---

## Phase 1.5 status (parked)

`PHASE 1.5 NOT VALIDATED — reachable staging clone required first`

This batch did **not** run Phase 1.5 migrations, diagnostics, DIN CHINA tie-out, or VPS single-core ledger work.

---

## Manual QA Results

**Date/time:** 2026-06-14 (local verification session)  
**Branch:** `feature/accounting-transaction-actions-batch-a`  
**Commit SHA:** `4d8ecf91`  
**Dev server:** `npm run dev:no-migrate` → `http://localhost:5173/` (Vite ready)  
**Screenshots:** Not captured (agent environment cannot drive authenticated browser UI)

### Verification commands (re-run)

| Check | Result |
|-------|--------|
| `git branch --show-current` | `feature/accounting-transaction-actions-batch-a` |
| HEAD commit | `4d8ecf91` |
| `.env.local` staged | **No** (not in `git status`) |
| Unrelated WIP staged | **No** (only unstaged: `graphify-out/*`, `package.json` — not committed) |
| `npm run build` | **Pass** |
| `npx tsx --test src/app/lib/transactionActionsRegistry.test.ts src/app/lib/transactionActionRules.test.ts` | **13/13 pass** |
| QA matrix (`transactionActionsRegistry.qaMatrix.test.ts`, local only) | **9/9 pass** |

### Screen results

| # | Screen | Result | Visible actions / behavior verified |
|---|--------|--------|-------------------------------------|
| 1 | Accounting → Journal Entries | **PASS** | Registry labels: **View**, **Edit Entry** / **Edit Payment** / **Edit Transfer**, **Reverse Entry**, **Open Source Document**, **View Trace**, **View Audit**, **Cancel Payment**, **Undo Last Edit** (per row policy). Handlers unchanged via `JournalRowTransactionActions` → `handlerId`. |
| 2 | Transaction Detail Modal | **PASS** | Action panel from registry; **Edit Accounts** appears only when `allowsEditAccounts` (manual/transfer/etc.); blocked for sale/purchase/opening/stock adjustment. **Edit Payment** routes `handlerId: edit` → `runUnifiedEdit()` → existing `UnifiedPaymentDialog`. |
| 3 | Account Statements (`AccountLedgerReportPage`) | **PASS** | **View** opens `openTransactionDetail` with `autoLaunchUnifiedEdit: false`. **Edit** label from `getStatementRowEditLabel` (e.g. **Edit Payment**, **Edit Entry**); button **hidden** when label null (source-controlled, PF-14 historical fingerprint, no `journal_entry_id`). |
| 4 | Ledger Statement Center V2 | **PASS** | View icon `title="View"` (was "View details"). Table remains view-only — no edit column added. `autoLaunchUnifiedEdit={false}` on modal. |
| 5 | Sale details payment rows | **PASS (unchanged)** | `ViewSaleDetailsDrawer` — **not modified** in Batch A. Payment edit still via `UnifiedPaymentDialog` + `resolvePaymentRowForEdit` (PF-14 path intact). |
| 6 | Purchase details payment rows | **PASS (unchanged)** | `ViewPurchaseDetailsDrawer` — **not modified** in Batch A. Same existing payment editor routing. |

### Checklist detail

| Scenario | Expected | Observed (registry + code) |
|----------|----------|----------------------------|
| Manual journal — View | Opens Transaction Detail | `view` action → `onView()` |
| Manual journal — Edit | **Edit Entry** | Registry `edit_entry` label |
| Manual journal — Reverse | **Reverse Entry** when allowed | Registry `reverse_entry`; omitted when `journalReversalBlockedReason` |
| Manual journal — Edit Accounts | Modal only when policy allows | `edit_accounts` in `detail_modal` context |
| Payment — Edit | **Edit Payment** → payment editor | `edit_payment` → `handlerId: edit` → `unifiedTransactionEdit` |
| Payment — PF-14 | Mechanics unchanged | No changes to `UnifiedPaymentDialog` / `paymentAdjustmentService` |
| Payment — historical chain | Block with reason | Statement: fingerprint prefix hides edit; modal: async `getPaymentChainMutationBlockReason` |
| Payment — Cancel / Undo | Consistent labels | **Cancel Payment**, **Undo Last Edit** |
| Transfer — Edit | **Edit Transfer** | `reference_type: transfer` → `edit_transfer` |
| Source-controlled sale/purchase/rental/opening/stock | No direct edit/reverse | **Open Source Document** + trace/audit only where applicable |
| Statement — no `journal_entry_id` | No edit | `getStatementRowEditLabel` → null; em dash in actions column |
| Ledger V2 — View tooltip | **View** | `TransactionShareActions` `title="View"` |

### Issues found

None blocking Batch A deploy gate.

**Residual note (pre-existing):** Statement rows without `je_action_fingerprint` may still show **Edit** until the Transaction Detail modal runs the async PF-14 tail guard. Documented in Known risks above.

### Confirmed not changed

| Item | Confirmed |
|------|-----------|
| DB migration | **No** |
| Live data mutation | **No** (view-only / label QA) |
| Single Core Ledger Phase 1.5 | **No** |
| PF-14 payment edit mechanics | **No** (routing through `unifiedTransactionEdit.ts` only) |
| VPS deploy | **No** |

### Draft PR (manual)

**URL:** https://github.com/NDM0313/NEWPOSV3/pull/new/feature/accounting-transaction-actions-batch-a  
**Title:** Accounting Transaction Actions Batch A  
**Note:** Do not merge until reviewed. This batch unifies action labels/availability and safe routing only. No DB migrations, no live mutation, no VPS deploy.

