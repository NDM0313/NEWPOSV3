# ERP Chart of Accounts — Execution Blueprint

**Project:** NEWPOSV3  
**Last updated:** 2026-03-27  
**Scope:** Hierarchy, control vs subledger, posting rules, account cleanup, parent/child design.  
**Primary code:** `src/app/data/defaultCoASeed.ts`, `src/app/services/defaultAccountsService.ts`, `src/app/lib/accountHierarchy.ts`, `src/app/services/partySubledgerAccountService.ts`, `src/app/lib/accountControlKind.ts`.

---

## 1. Canonical data model

| Field | Purpose |
|-------|---------|
| `accounts.id` | FK for `journal_entry_lines.account_id` |
| `code` | Stable business identifier; used for default resolution (`1100`, `2000`, …) |
| `type` | Drives P&L vs BS classification in reports |
| `parent_id` | Tree + BS grouping via ancestor walk |
| `is_group` | **Summary-only** COA headers (`COA_HEADER_CODE_LIST`); **no posting** |
| `linked_contact_id` | Party subledger ↔ `contacts.id` (migration `20260364_*`) |

**Golden rule:** GL balances for reporting = **sum of journal lines**, not `accounts.balance` as primary truth (`REPORTING_RECONCILIATION.md`).

---

## 2. Final hierarchy (target + current seed alignment)

### 2.1 Section groups (summary-only, non-posting)

| Code | Name | Section |
|------|------|---------|
| `1050` | Cash & Cash Equivalents | Assets |
| `1060` | Bank Accounts | Assets |
| `1070` | Mobile Wallets | Assets |
| `1080` | Worker Advances | Assets |
| `1090` | Inventory | Assets |
| `2090` | Trade & Other Payables | Liabilities |
| `3090` | Equity | Equity |
| `4050` | Revenue | Income |
| `6090` | Operating Expenses | Expense |

**Rule:** These codes are in `COA_HEADER_CODES` — excluded from Balance Sheet line items and standard payment pickers (`defaultCoASeed.ts`).

### 2.2 Posting leaves (seeded in `defaultAccountsService`)

| Code | Name | Type | Parent |
|------|------|------|--------|
| `1000` | Cash | cash | `1050` |
| `1001` | Petty Cash | cash | `1050` |
| `1010` | Bank | bank | `1060` |
| `1020` | Mobile Wallet | mobile_wallet | `1070` |
| `1100` | Accounts Receivable | asset | **null** (current seed) |
| `1180` | Worker Advance | asset | `1080` |
| `1200` | Inventory | inventory | `1090` |
| `2000` | Accounts Payable | liability | `2090` |
| `2010` | Worker Payable | liability | `2090` |
| `2011` | Security Deposit | liability | `2090` |
| `2020` | Rental Advance | liability | `2090` |
| `2030` | Courier Payable (Control) | liability | `2090` |
| `3000` | Owner Capital | equity | `3090` |
| `4100` | Sales Revenue | revenue | `4050` |
| `4200` | Rental Income | revenue | `4050` |
| `5000` | Cost of Production | expense | `6090` |
| `6100` | Operating Expense | expense | `6090` |
| `6110` | Salary Expense | expense | `6090` |
| `6120` | Marketing Expense | expense | `6090` |

### 2.3 Auto-created accounts (not always in seed)

| Code / pattern | Created by | Notes |
|----------------|------------|-------|
| `4000` | `saleAccountingService.ensureRevenueAccount` | **Product revenue** in sale JEs — conflicts with seed preferring `4100` |
| `5200` | `ensureDiscountAllowedAccount` | Discount allowed (expense) |
| `5300` | `ensureExtraExpenseAccount` | Extra expense (expense) |
| `AR-{slug}` | `partySubledgerAccountService` | Child of `1100`, `linked_contact_id` |
| `AP-{slug}` | same | Child of `2000` |

---

## 3. Control vs child model

### 3.1 Definitions

| Role | Posting allowed? | Appears on BS |
|------|------------------|---------------|
| **Group (`is_group`)** | **No** | No (excluded) |
| **Control (1100, 2000, 2010, 2030…)** | **Discouraged** direct posting when subledger exists; **required** for roll-ups | Yes (one rolled line for AR/AP) |
| **Subledger (AR-*, AP-*)** | **Yes** — preferred for party transactions | Rolled into control on BS |

### 3.2 Accounts that should **never** receive direct posting (policy)

- All `COA_HEADER_CODES` (`is_group: true`).
- Ideally **`1100` / `2000`** when a **child** exists for the same party — enforcement = **posting resolver** + optional DB constraint (future).

### 3.3 AR/AP resolution (implemented)

- `resolveReceivablePostingAccountId(companyId, customerContactId)` → `ensureReceivableSubaccountForContact` → **`AR-{slug}`** under `1100`, else `1100`.
- `resolvePayablePostingAccountId` → **`AP-{slug}`** under `2000`, else `2000`.

---

## 4. Critical code conflicts (execution bugs / tech debt)

### 4.1 `4000` vs `4100` (revenue)

- **Seed:** `4100` = **Sales Revenue** (`LEAF_ROWS`).
- **Sale JE:** `ensureRevenueAccount` prefers **`4000`** for product revenue lines.
- **Result:** Many companies have **both**; P&L shows **two** revenue lines — valid if intentional, **invalid** if thought to be one account.

**Remediation:** Pick **one** canonical product revenue code; migrate the other to **no new posts** + opening transfer JE if needed.

### 4.2 `4100` vs Shipping Income — **fixed in app (2026-03)**

- **Shipping income** posts to **`4110`** (`ensureShippingIncomeAccount`, `shipmentAccountingService`, `defaultAccountsService` seed).
- **`4100`** remains **Sales Revenue** in the default COA seed.

### 4.3 `5200` / `5300` vs P&L COGS bucket

- `accountingReportsService` `COST_OF_PRODUCTION_CODES` includes **`5200`, `5300`**.
- Sale service defines **`5200` = Discount Allowed**, **`5300` = Extra Expense**.

**Remediation:** Remove discount/extra from COGS set; treat as **operating** or **other expense** per policy.

### 4.4 `1100` parent

- `1100` has **no** group parent unlike cash/AP — tree UX inconsistent. Optional non-posting wrapper `1105` (see master redesign).

---

## 5. Worker architecture

### 5.1 Accounts

| Code | Role |
|------|------|
| `1180` | Worker Advance (asset) — **global**; payments **pre-bill** debit this |
| `2010` | Worker Payable (liability) — **global**; stage bills **Cr** this; payments **Dr** this when bill exists |

### 5.2 Subledger children?

- **Current:** No `partySubledgerAccountService` auto-children for workers under `2010`.
- **Studio:** `studioProductionService` posts **Dr `5000` Cr `2010`** — amounts aggregate on **global** `2010`.
- **Target:** Optional **`WP-{worker}`** under `2010` + **`WA-{worker}`** under `1180` for TB expansion parity with AR/AP.

### 5.3 Operational vs GL reconciliation

- `worker_ledger_entries` syncs operational view; **GL** is journal truth.
- `controlAccountBreakdownService` documents **non-equivalence** of sums — **Reconciliation** tab is the honest compare surface.

---

## 6. Liquidity architecture

| Concept | Group | Default leaf | Posting |
|---------|-------|--------------|---------|
| Cash | `1050` | `1000` | Yes |
| Petty cash | `1050` | `1001` | Yes |
| Bank | `1060` | `1010` | Yes |
| Mobile wallet | `1070` | `1020` | Yes |

**Hierarchy audit:** `auditAccountHierarchy` warns if cash/bank/wallet types are not under expected parents (`accountHierarchy.ts`).

**Future:** Multiple bank accounts = **siblings** under `1060`, not duplicate codes.

---

## 7. Inventory

- **Control leaf:** `1200` under `1090`.
- **Opening:** `opening_balance_inventory` reference type in `openingBalanceJournalService` — **Dr Inventory / Cr Equity** pattern (see service).

---

## 8. Rental (COA touchpoints)

- **Liabilities:** `2020` Rental Advance; revenue **`4200`** Rental Income (seed).
- **Posting:** Rental payment JEs use `reference_type: 'rental'`, `reference_id: rentalId` (see `rentalService` / `AccountingContext`). **Not** the same as pure stock movement on finalize.

---

## 9. Studio / production

- **Stage bill:** **Dr `5000` Cr `2010`** (`studioProductionService`).
- **COGS vs production cost:** Both use `5000` name “Cost of Production” — aligns with inventory COGS in sale flow **if** policy says single account; otherwise split **COGS (sale)** vs **production labor** with distinct codes.

---

## 10. Commission / payroll (current)

- **Sales commission** fields on `sales` (`commission_amount`, `commission_status`) — **not** auto-posted in sale flow per `saleService` comments; **Generate to Ledger** / batch flows (verify batch service before relying on GL).

**Execution:** Until posted, **no GL line** — P&L excludes.

---

## 11. Keep / merge / rename / deprecate (COA-specific)

| Item | Action |
|------|--------|
| `1050`–`6090` groups | **Keep**; enforce `is_group` |
| `1100`/`2000` | **Keep**; enforce child posting |
| `4000` vs `4100` | **Merge policy** → one product revenue code |
| `4100` shipping collision | **Rename / new code** for shipping |
| `5200`/`5300` | **Keep** names; **fix P&L** mapping |
| Duplicate user expense accounts | **Merge** into `6100` + transfer JE |
| `chart_accounts` table | **Do not** use as GL master |

---

## 12. Posting rules summary (by account class)

| Class | Debit means | Credit means |
|-------|-------------|--------------|
| Asset (e.g. AR, cash) | Increase asset | Decrease asset |
| Liability (AP) | Decrease liability | Increase liability |
| Revenue | — | Increase revenue |
| Expense | Increase expense | — |

---

## 13. Acceptance questions (COA)

| Question | Answer |
|----------|--------|
| Is this account postable? | If `is_group` → no; if header code → no |
| Party sale — which account? | `AR-{contact}` if created; else `1100` |
| Why two revenue codes? | Legacy `4000` from sale service vs seed `4100` |
| Worker bill? | `5000` / `2010` JE |

---

*End of COA execution blueprint.*
