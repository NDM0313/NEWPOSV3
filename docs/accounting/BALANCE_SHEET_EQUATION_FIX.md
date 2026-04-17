# Balance Sheet Equation Fix — Root Cause Analysis & Resolution

**Date:** 2026-04-18  
**Files changed:**
- `src/app/services/accountingReportsService.ts`
- `src/app/components/reports/BalanceSheetPage.tsx`

---

## The Problem

Balance Sheet was showing `Assets ≠ Liabilities + Equity`. Two separate bugs were causing this.

---

## Bug 1 — Math.abs on all amounts (sign mismatch)

### Root cause

`getBalanceSheet()` was using `Math.abs()` for every account:

```
Assets:      displayAmount = amount > 0 ? amount : -amount  ← always positive
Liabilities: displayAmount = amount < 0 ? -amount : amount  ← always positive
Equity:      displayAmount = amount < 0 ? -amount : amount  ← always positive
```

In the Trial Balance, `balance = Debit − Credit` per account:

| Account type | Normal sign in TB | Correct BS display |
|---|---|---|
| Asset (cash, bank, AR) | **Positive** (Dr > Cr) | Positive |
| Asset — overdraft | **Negative** (Cr > Dr) | **Negative** (anomaly) |
| Liability (AP, payable) | **Negative** (Cr > Dr) | Positive (negate) |
| Liability — debit-heavy | **Positive** (Dr > Cr) | **Negative** (anomaly) |
| Equity | **Negative** (Cr > Dr) | Positive (negate) |

`Math.abs` was hiding overdraft bank accounts and debit-heavy payables, making them all positive.  
This directly inflated `totalAssets` by `2 × |overdraft amount|`.

### Fix (applied)

```typescript
// Assets: keep actual sign
const displayAmount = amount + 0;   // +0 collapses IEEE-754 negative-zero

// Liabilities: negate
const displayAmount = (-amount) + 0;

// Equity: negate
const displayAmount = (-amount) + 0;
```

Accounts with unusual (wrong-sign) balances are highlighted amber in the UI with a ⚠ icon.

---

## Bug 2 — Excluded group/header accounts with direct journal balances

### Root cause (mathematical proof)

The accounting identity requires:

```
Σ(all account Dr-Cr balances in TB) = TB imbalance (= 0 if perfectly balanced)
```

The `getBalanceSheet` main loop **skips** two categories of accounts:

1. **COA header codes** (`1050`, `1060`, `1070`, `1080`, `1090`, `2090`, `3090`, `4050`, `6090`)
2. **Group accounts** (`is_group = true`)

If any journal entry lines were ever posted directly to these accounts (mis-posting or legacy data), their balance exists in the Trial Balance but is **invisible** to the Balance Sheet loop.

This creates the gap:

```
BS Difference = TB_imbalance − Σ(excluded group/header account balances)
```

With Rs. 20,000 excluded account balance and a balanced TB:

```
Difference = 0 − 20,000 = −20,000
```

This is exactly what was observed after Bug 1 was fixed.

### Fix (applied) — `BS-FIX-01` absorption step

After the main account loop (but **before** computing `netIncome`), iterate all TB rows and absorb any unprocessed account balance into its appropriate section:

```typescript
tb.rows.forEach((r) => {
  if (processedInMainLoop.has(r.account_id)) return;    // already counted
  if (arChildIds.has(r.account_id) || apChildIds.has(r.account_id)) return;  // rolled up
  if (!r.balance) return;
  const cat = accountTypeCategory(accountType);
  if (cat === 'asset')          totalAssets += r.balance;
  else if (cat === 'liability') totalLiabilities += -(r.balance);
  else if (cat === 'equity')    totalEquity += -(r.balance);
  else                          revenueExpenseBalanceSum += r.balance;  // P&L
});
```

These balances are **not shown as visible line items** (they belong to structural/header accounts) but they are **counted in section totals**, closing the gap.

**Why netIncome must be computed after absorption:**  
`revenueExpenseBalanceSum` feeds into `netIncome = -revenueExpenseBalanceSum`. If a revenue/expense-type group account has activity, it must be absorbed into the sum before `netIncome` is computed.

---

## Remaining Difference after both fixes = `tbImbalance`

After BS-FIX-01:

```
Difference = TB_imbalance = Σ(Debit) − Σ(Credit) across all non-voided journal_entry_lines
```

A non-zero `tbImbalance` means one or more journal entries have unequal debit/credit sides — a **data integrity issue**, not a reporting formula issue.

`tbImbalance` is now a separate field on `BalanceSheetResult` and shown as an amber diagnostic banner in the UI when non-zero.

---

## How to identify and fix a tbImbalance

1. Open **Accounting → Integrity Test Lab**
2. Click **"Load detection"** in the **Phase 8 – Live data repair** section
3. Check the **"Unbalanced journal entries"** table
4. Each row shows: Entry no, JE id, Debit total, Credit total, Difference
5. Use the **trace icon** (🔍) to jump to Journal Entries (audit view) filtered to that JE id
6. Review the specific entry — it may need a **Reversal** and re-posting with correct amounts
7. For larger differences, use **Developer Integrity Lab** → RULE scan

---

## Summary of data flow

```
journal_entry_lines
       │
       ▼  (sum Dr, Cr per account, filter by date/company/branch)
Trial Balance (getTrialBalance)
       │
       ├─ balance = Debit − Credit per account
       ├─ TB imbalance = totalDebit − totalCredit
       │
       ▼  (getBalanceSheet)
Main loop (leaf accounts only, sign-correct):
  Assets     →  totalAssets += balance
  Liabilities→  totalLiabilities += −balance
  Equity     →  totalEquity += −balance
  Rev/Exp    →  revenueExpenseBalanceSum += balance

Absorption (BS-FIX-01, group/header accounts):
  same classification, same sign rules
  → no visible line items added

netIncome = −revenueExpenseBalanceSum   ← computed after absorption

Difference = totalAssets − (totalLiabilities + totalEquity)
           = tbImbalance   ← only unbalanced JEs remain
```

---

## Before / After

| State | Total Assets | Total L+E | Difference |
|---|---|---|---|
| Before (Math.abs, no absorption) | 1,723,041.98 | 1,531,941.98 | **+191,100** |
| After Bug 1 fix only | 1,511,341.98 | 1,531,341.98 | **−20,000** |
| After Bug 1 + Bug 2 fix | depends on data | depends on data | **= tbImbalance only** |

The Rs. 20,000 remaining after Bug 1 fix is caused by group/header accounts with direct journal balances totalling +Rs. 20,000 (net debit). After BS-FIX-01, these are absorbed and the difference should reduce to zero (or to the actual TB imbalance if any unbalanced JEs exist).
