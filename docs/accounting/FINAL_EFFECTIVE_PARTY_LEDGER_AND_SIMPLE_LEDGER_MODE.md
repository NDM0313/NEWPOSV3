# Effective Party Ledger — Simple Ledger Mode

## Date: 2026-04-11

---

## Why the Old Ledger Was Confusing

The existing ledger system (GenericLedgerView for suppliers, CustomerLedgerPageOriginal for customers) shows **every intermediate PF-14 mutation row** as a separate line:

- A payment edited 3 times shows as **4+ rows**: original + delta JEs + transfer JEs + reversal helpers
- Account-change mutations add transfer rows between old and new liquidity accounts
- Amount-edit mutations add delta rows for the adjustment amount
- Reversed/voided chains still show all chain members

For business operators (non-accountants), this creates confusion:
- "Why does it show 12,000 then 3,000 then 1,000 instead of just 16,000?"
- "Which row is the real amount?"
- "Why are there rows I didn't create?"

The audit detail is necessary for accountants and debugging, but operators need a **clean, effective-state view**.

---

## Design Decision

**Approach: Frontend collapse layer on operational data** (Option C from the requirements)

Rationale:
- Safest — does not modify any existing accounting engine, GL tables, or audit paths
- Read-only — only adds a new presentation layer, never changes data
- Uses `payments` table current state (which already reflects the effective amount/account after edits) and `transaction_mutations` table for history
- Mathematically sound because `payments.amount` is the source of truth for the effective state
- The existing GenericLedgerView / CustomerLedgerPageOriginal remain untouched for audit use

---

## Architecture

### Service: `effectivePartyLedgerService.ts`

**File:** `src/app/services/effectivePartyLedgerService.ts`

Key function: `loadEffectivePartyLedger(params)`

Parameters:
- `companyId`, `contactId`, `partyType` ('customer' | 'supplier')
- `fromDate`, `toDate`, optional `branchId`

Returns: `EffectiveLedgerResult`
- `rows: EffectiveLedgerRow[]` — one row per effective business event
- `summary: EffectiveLedgerSummary` — opening, totals, closing balance
- `partyName`, `partyType`

Data flow:
1. Loads contact opening balance
2. Loads all accounts into a map for name resolution
3. For **customers**: loads sales (final/delivered) + payments (received type) + their mutations
4. For **suppliers**: loads purchases (final/received) + payments (paid type) + their mutations
5. Calls `buildEffectivePaymentRows()` which:
   - Groups mutations by `payment_id`
   - Shows only the **current effective amount** from `payments.amount`
   - Shows only the **current effective account** from `payments.payment_account_id`
   - Attaches full mutation history as `MutationStep[]` for expand/details
   - Marks voided payments appropriately
   - Counts mutation steps per payment
6. Computes running balance with correct perspective (receivable for customer, payable for supplier)

### Page: `EffectivePartyLedgerPage.tsx`

**File:** `src/app/components/accounting/EffectivePartyLedgerPage.tsx`

Full-page component with:
- **Dual-mode toggle**: Simple (indigo) / Audit (amber)
- **Party selector**: dropdown with contact search, type badges
- **Date range picker**: CalendarDateRangePicker integration
- **Type filter**: All / Sales / Purchases / Payments / Opening / Returns / Reversals
- **Search**: reference, description, account name
- **Toggles**: Show Voided, Show History
- **Summary cards**: Opening Balance, Total Sales/Purchases, Total Received/Paid, Current Receivable/Payable
- **Main table**: Date, Reference, Type, Description, Account, Debit, Credit, Balance, Status
- **Expand/details**: Click chevron on mutated rows to see full edit timeline

---

## Screens Changed

| File | Change |
|------|--------|
| `src/app/services/effectivePartyLedgerService.ts` | **NEW** — effective party ledger data service |
| `src/app/components/accounting/EffectivePartyLedgerPage.tsx` | **NEW** — dual-mode party ledger page |
| `src/app/context/NavigationContext.tsx` | Added `'party-ledger'` view, `partyLedgerParams` state, `openPartyLedger()` helper |
| `src/app/App.tsx` | Added lazy import + route rendering for `party-ledger` view |
| `src/app/components/layout/Sidebar.tsx` | Added "Party Ledger" nav item with BookOpen icon |
| `src/app/components/contacts/ContactsPage.tsx` | Added "View Ledger" dropdown menu item for customer and supplier contacts |

---

## How Collapse Works

The effective ledger uses a fundamentally different approach from the audit ledger:

| Aspect | Audit Ledger (existing) | Effective Ledger (new) |
|--------|------------------------|----------------------|
| **Data source** | `journal_entries` + `journal_entry_lines` | `payments` table + `sales`/`purchases` tables |
| **Payment display** | One row per JE (primary, delta, transfer, reversal) | One row per payment (latest effective state) |
| **Amount shown** | Each JE's own debit/credit | `payments.amount` (current effective) |
| **Account shown** | Each line's account | `payments.payment_account_id` (current effective) |
| **Mutation visibility** | All rows visible equally | Hidden by default, expandable on click |
| **Voided chains** | Shown with void badge | Hidden by default (toggle to show) |

### Collapse Example (PAY-0018 / SATTAR)

**Audit view** would show 5+ rows:
- Original 12,000 on Petty Cash 1001
- Transfer: neutralize Petty Cash, credit Bank 1010
- Delta: +3,000 (12k → 15k)
- Delta: +1,000 (15k → 16k)
- Transfer: Bank 1010 → Bank Accounts 1060

**Effective view** shows 1 row:
- PAY-0018 | Payment | 16,000 | Bank Accounts 1060 | **4 edits** badge
- Click to expand: full timeline with old→new amounts and accounts

---

## What Remains Visible Only in Audit

- PF-14 amount delta journal entries
- PF-14 account transfer journal entries
- Reversal / correction_reversal journal entries
- Historical superseded chain nodes
- Individual JE-level debit/credit detail
- Per-line account postings (AP/AR party child accounts)

The existing `GenericLedgerView` (GL tab) and `CustomerLedgerPageOriginal` (GL tab) are completely untouched.

---

## Entry Points

### 1. Sidebar Navigation
- **"Party Ledger"** item with BookOpen icon
- Appears below Accounting, above AR/AP Reconciliation
- Same visibility rules as Accounting (accounting module enabled + permission)

### 2. Contacts Page
- **"View Ledger"** in each contact's three-dot dropdown menu
- Customer contacts: opens with `contactType: 'customer'`
- Supplier contacts: opens with `contactType: 'supplier'`
- Both-type contacts: available in both customer and supplier sections

### 3. Party Ledger Page (standalone)
- Party selector dropdown allows switching between contacts
- Contact list pre-filtered to customer/supplier/both types
- Can be opened empty and party selected from dropdown

---

## Expand/History Behavior

When a payment row has mutations (edit count > 0):
1. A chevron icon appears on the left
2. An amber badge shows "N edits"
3. Clicking the chevron expands the row to show:
   - **Final effective result**: amount, account, payment ID
   - **Mutation timeline**: chronological list of changes
     - Amount edits: `12,000 → 15,000` with arrow icon
     - Account changes: `Petty Cash → Bank` with arrow icon
     - Timestamps for each edit

---

## Acceptance Test Results

### Live Data Verification

| Contact | Type | Active Payments | Mutations | Effective Amount Shows Correctly |
|---------|------|----------------|-----------|--------------------------------|
| SATTAR | supplier | PAY-0018 | 4 edits | 16,000 on Bank Accounts 1060 |
| Ali | customer | RCV-0004 | 11 edits | 45,000 on NDM |
| Ali | customer | RCV-0002 | 2 edits | 27,000 |
| DIN COUTURE | supplier | PAY-0008 | 0 | 10,000 (no collapse needed) |
| ABC | both | PAY-0015 | 0 | 50,000 (no collapse needed) |

### Collapse Verification

PAY-0018 (SATTAR, supplier):
- Original: 12,000 on Petty Cash 1001
- Edit 1: account change to Bank 1010
- Edit 2: amount 12,000 → 15,000
- Edit 3: amount 15,000 → 16,000
- Edit 4: account change to Bank Accounts 1060
- **Effective row shows: 16,000 on Bank Accounts 1060** ✅

RCV-0004 (Ali, customer):
- 11 mutations through various accounts and amounts
- **Effective row shows: 45,000 on NDM** ✅

### Voided Chain Handling

PAY-0017 (voided) and PAY-0004 (voided) — excluded from effective view by default, visible when "Show Voided" is toggled on. ✅

### Build Status

- `npm run build` passes cleanly ✅
- No TypeScript errors ✅
- No linter errors ✅
- Deployed to VPS and erp-frontend container healthy ✅

---

## Remaining Risks

1. **Audit mode in the new page**: Currently the new page only shows the effective/simple view. The "Audit" toggle exists but displays the same data. For full audit behavior, users should use the existing Party Statement (Operational / GL / Reconciliation) which remains available in the Contacts dropdown.

2. **Worker contacts**: Workers are not included in the party ledger (they use a different operational model). They continue to use GenericLedgerView.

3. **Manual journal entries**: The effective ledger focuses on sales/purchases/payments. Manual journals that affect party balances would need separate handling if required.

---

## Summary

The effective party ledger provides business operators with a clean, readable view of customer and supplier transactions showing only the **final effective state** of each payment — not every intermediate mutation step. Full audit detail remains available through the existing statement views and through the expandable mutation history on each row.
