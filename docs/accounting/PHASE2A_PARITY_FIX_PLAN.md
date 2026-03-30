# PHASE 2A — Web + Mobile Accounting Parity Fix Plan

Status: Implemented in this pass (non-destructive, no table deletes).

## Scope

Phase 2A objective was to fix parity before legacy cleanup:
- Worker payment canonical parity.
- AR/AP source semantics made explicit.
- Dashboard semantics parity direction.
- Branch scope parity for customer balances.
- Mock accounting UI review-only (no delete).

## Fix Plan and Implementation Mapping

### 1) Worker Payment Parity (Highest Priority)

- **Before (mobile):** `worker_ledger_entries` only write.
- **After (mobile):** canonical chain:
  1. `payments`
  2. `journal_entries`
  3. `journal_entry_lines`
  4. `worker_ledger_entries`

**Files changed**
- `erp-mobile-app/src/api/accounts.ts`
- `erp-mobile-app/src/components/accounts/WorkerPaymentFlow.tsx`
- `erp-mobile-app/src/components/accounts/AccountsModule.tsx`

**Tables/RPC affected**
- `payments`, `journal_entries`, `journal_entry_lines`, `worker_ledger_entries`, `accounts`
- No new RPC added for this flow.

**Idempotency / duplicate prevention**
- `payments`: lookup by `(company_id, reference_type='worker_payment', reference_id=worker_id, reference_number)`
- `journal_entries`: lookup existing by `payment_id`
- `worker_ledger_entries`: lookup by `reference_id (journal)` or `payment_reference`

### 2) AR/AP Source Unification (No silent mixing)

**Approach**
- Keep both semantics where business needs differ, but make source explicit in UI.
- Remove silent total/list mismatch on mobile receivables page.

**Files changed**
- `src/app/components/accounting/AccountingDashboard.tsx` (explicit source labels for GL cards + operational tab labels)
- `erp-mobile-app/src/components/accounts/ReceivablesReport.tsx` (total now derived from same document list source)
- `erp-mobile-app/src/components/accounts/PayablesReport.tsx` (source label)

**Tables/RPC affected**
- Operational lists: `sales`, `purchases`
- GL cards: journal-derived logic over `journal_entries` + `journal_entry_lines`

### 3) Dashboard Parity

**Decision implemented**
- Mobile dashboard financial cards aligned to **GL semantics** (journal-derived) to match web accounting summary meaning.
- Operational order count remains document-based.

**Files changed**
- `erp-mobile-app/src/components/dashboard/DashboardModule.tsx`

**Backend affected**
- Reads `journal_entries` (+ nested `journal_entry_lines` + account names) via `getJournalEntries` in `erp-mobile-app/src/api/accounts.ts`
- Inventory and order count remain existing sources.

### 4) Branch Scope Parity

**Decision implemented**
- Mobile customer ledger balances now follow selected branch policy instead of always company-wide null branch.

**Files changed**
- `erp-mobile-app/src/api/customerLedger.ts`
- `erp-mobile-app/src/components/ledger/LedgerModule.tsx`
- `erp-mobile-app/src/App.tsx`

**Backend affected**
- RPC `get_contact_balances_summary` now receives selected branch policy through existing `safeRpcBranchId` path.
- Payment transaction queries in customer ledger now respect selected branch where applicable.

### 5) Dead/Mock Accounting UI (Review only)

**Status**
- Confirmed unused (no imports/usages under `erp-mobile-app/src`):
  - `erp-mobile-app/src/components/accounting/AccountingModule.tsx`
- No deletion in this phase.

## Non-Goals (still excluded)

- No DB/table deletions.
- No destructive scripts.
- No legacy cluster drop/cleanup in phase 2A.

