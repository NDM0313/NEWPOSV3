# ERP Reports + COA — Final Remediation Plan

**Project:** NEWPOSV3  
**Last updated:** 2026-03-27  
**Purpose:** Single implementation plan tying **Chart of Accounts**, **posting engines**, and **reports** together — execution-grade.  
**Companion docs:**  
- `ERP_REPORTS_EXECUTION_BLUEPRINT.md`  
- `ERP_COA_EXECUTION_BLUEPRINT.md`  
- `REPORTS_AND_COA_MASTER_REDESIGN.md`

---

## 1. Architecture summary (one paragraph)

Double-entry truth is **`journal_entries` + `journal_entry_lines`** scoped to **`accounts`**, with voided headers excluded from standard GL reports. The COA combines **non-posting section groups**, **control accounts** (`1100`, `2000`, `2010`, …), and **party subledgers** (`AR-*`, `AP-*` with `linked_contact_id`). Reports derive **Trial Balance** from summed lines; **P&L** and **Balance Sheet** derive from TB with special **AR/AP roll-up** on BS and a known **revenue/COGS code tension** to fix. Operational subsystems (**sales totals**, **worker_ledger_entries**, **rental_payments**) must **reconcile** to GL, not replace it.

---

## 2. Biggest current problems (prioritized)

| # | Problem | Severity | Evidence |
|---|---------|----------|----------|
| 1 | **P&L COGS set includes `5200`/`5300`** while those are discount/extra expense in sales | **High** | `accountingReportsService` `COST_OF_PRODUCTION_CODES` vs `saleAccountingService` |
| 2 | **Revenue code split** `4000` (sale JEs) vs `4100` (seed “Sales Revenue”) | **High** | `ensureRevenueAccount` vs `defaultAccountsService` |
| 3 | ~~**Shipping income** used code **`4100`**~~ — **fixed:** dedicated **`4110`** Shipping Income | **Resolved** | `saleAccountingService`, `shipmentAccountingService`, COA seed |
| 4 | **TB expanded/summary** only for AR/AP — worker/liquidity parity missing | **Medium** | `applyTrialBalanceArApPresentation` |
| 5 | **Dual “ledger” engines** for customers/suppliers without clear UI labels | **Medium** | `PARTY_LEDGER_UNIFICATION_PLAN.md` |
| 6 | **Worker GL** global accounts vs operational ledger — compare only in reconciliation | **Medium** | `controlAccountBreakdownService` notes |

---

## 3. Posting matrix (detailed)

**Legend:** **C** = control account; **S** = subledger child; **JE** = journal entry; **void** = excluded from effective GL.

### 1. Sale invoice creation (final)

| Field | Value |
|-------|--------|
| **Module** | Sales / `saleAccountingService` |
| **When** | Sale **final** + `invoice_no` set; idempotent canonical document JE |
| **JE** | `reference_type: 'sale'`, `reference_id: saleId`, `payment_id: null` |
| **Debit** | AR **S** (`resolveArLineAccountForSale`) or **C** `1100` — **total** invoice |
| **Credit** | Product revenue (`4000` from `ensureRevenueAccount`); shipping → **`4110`**; discount → `5200`; COGS → **Dr `5000` Cr `1200`** |
| **Edit** | Delta JEs / adjustments — not blanket replace (`saleAccountingService` contract) |
| **Reports** | TB/BS/PL lines; AR in **receivables** |

### 2. Sale payment receipt

| Field | Value |
|-------|--------|
| **Module** | Payments + `AccountingContext` / triggers |
| **JE** | Often `reference_type: 'payment'` or `'sale'` with `payment_id`; payment isolation rules |
| **Debit** | Cash/Bank/Wallet |
| **Credit** | AR **S** or **C** |
| **Void** | Payment void → reversal / void chain (`accountingService`) |

### 3. Customer on-account / manual receipt

| Field | Value |
|-------|--------|
| **Patterns** | `on_account`, `manual_receipt` (`accountingService` customer ledger paths) |
| **Debit** | Cash/Bank |
| **Credit** | AR |

### 4. Purchase bill creation

| Field | Value |
|-------|--------|
| **Module** | `purchaseAccountingService` |
| **JE** | `reference_type: 'purchase'`, `payment_id: null` |
| **Debit** | Inventory `1200` (+ landed cost policy) |
| **Credit** | AP **S** or **C** `2000` |

### 5. Supplier payment

| Field | Value |
|-------|--------|
| **Module** | `supplierPaymentService` |
| **Debit** | AP **S** or **C** |
| **Credit** | Payment account |
| **reference_type** | `purchase` or `payment` variants; on-account uses `contact` in `reference_id` |

### 6. Expense creation

| Field | Value |
|-------|--------|
| **Module** | Expense flow / `addEntryV2Service.createExpensePaymentEntry` |
| **Pattern** | `payments` row `reference_type: 'expense'` + JE **Dr expense Cr bank** |
| **Roznamcha** | Requires payment row for visibility per context comments |

### 7. Manual journal / add entry

| Field | Value |
|-------|--------|
| **reference_type** | Often `journal` / manual |
| **Policy** | Sensitive codes `1100`,`2000`,`2010`,`1180`,`1195` — diagnostics warn (`developerAccountingDiagnosticsService`) |

### 8. Rental booking

| Field | Value |
|-------|--------|
| **Module** | `rentalService.createBooking` |
| **GL** | **No JE at create** in flow reviewed — booking record + items only; **payment** drives cash/AR/revenue JEs when posted from UI |

### 9. Rental advance payment

| Field | Value |
|-------|--------|
| **Module** | `rentalService.addPayment` + AccountingContext journal |
| **JE** | `reference_type: 'rental'`, `reference_id: rentalId` |
| **Accounts** | Typically Dr cash; Cr rental liability / revenue per **AccountingContext** mapping (verify branch for `2020` / `4200`) |

### 10. Rental charge / finalization

| Field | Value |
|-------|--------|
| **finalizeRental** | Stock movements — **not** full revenue recognition in snippet; revenue recognition tied to payment/finalization policy |

### 11. Rental remaining payment

| Same family as advance | `payment_type: 'remaining'` on `rental_payments`; JE `reference_type: 'rental'` |

### 12. Worker advance

| Field | Value |
|-------|--------|
| **Debit** | `1180` |
| **Credit** | Cash/Bank |
| **reference** | Worker advance flows / add entry |

### 13. Worker bill / payable (studio stage)

| Field | Value |
|-------|--------|
| **Module** | `studioProductionService` |
| **JE** | **Dr `5000` Cr `2010`**; `reference_type` tied to stage/sale |

### 14. Worker payment / settlement

| Field | Value |
|-------|--------|
| **Module** | `workerPaymentService` |
| **Debit** | `2010` if bill exists else `1180` (`shouldDebitWorkerPayableForPayment`) |
| **Credit** | Payment account |
| **reference_type** | `worker_payment`, `reference_id: workerId` |
| **Ledger sync** | `worker_ledger_entries` |

### 15. Opening balance (contact AR/AP/worker)

| Field | Value |
|-------|--------|
| **Module** | `openingBalanceJournalService` |
| **Types** | `opening_balance_contact_ar`, `opening_balance_contact_ap`, `opening_balance_contact_worker`, `opening_balance_account` |
| **Idempotency** | Void prior active JE on amount change, recreate |

### 16. Opening inventory

| Field | Value |
|-------|--------|
| **Type** | `opening_balance_inventory` — **Dr Inventory / Cr Equity** (see service) |
| **Cleanup** | Voids misclassified `stock_adjustment` JEs for same movement when applicable |

### 17. Inventory-financial movements

| Field | Value |
|-------|--------|
| **Stock adjustment trigger** | Posts JE per migration/trigger; opening may bypass expense pattern |

### 18. Studio / production cost

| Field | Value |
|-------|--------|
| **Primary** | **Dr `5000` Cr `2010`** |

### 19. Commission / payroll / liability

| Field | Value |
|-------|--------|
| **Sales commission** | Stored on sale; **posted only** when batch/ledger generation runs — **verify** batch path before GL expectation |
| **Payroll** | Not a single dedicated account in seed — **define** if introduced |

### 20. Reversal / adjustment / void

| Field | Value |
|-------|--------|
| **Void** | `is_void: true` on JE — **excluded** from TB |
| **correction_reversal** | `accountingService`; `unifiedTransactionEdit` **blocks** direct edit |
| **sale_adjustment / purchase_adjustment / payment_adjustment** | Delta pattern; show in **audit** |

---

## 4. Edit / adjustment / reversal rulebook

### 4.1 Header-only

- **Examples:** memo, external reference, **date** (where policy allows — see `journalTransactionDateSyncService` if used).
- **Rule:** No new economic JE lines for “noise” edits; journal **header** update only.
- **User view:** Same document row; optional **history** tab.

### 4.2 Financial

- **Sales/purchases:** Delta or adjustment JE per service contracts; **never** silent overwrite of original JE without void/reversal policy.
- **Payments:** Void payment → reversal chain; **effective** GL excludes voided.

### 4.3 Void vs reversal

| Mechanism | Effective TB | Audit trail |
|-----------|--------------|-------------|
| `is_void` | Excluded | Row still in DB with flag |
| `correction_reversal` | Net effect via pairing | Both visible in audit |
| Rental payment void | `rentalService.voidRentalPaymentByReversedJournal` recomputes `paid`/`due` | `rental_payments.voided_at` |

---

## 5. Frontend presentation (remediation targets)

| Area | Behavior |
|------|----------|
| **COA tree** | Badges: Group / Postable / Control; dim `is_group` |
| **TB** | Mode toggle; future worker + cash expansion |
| **BS** | Single AR/AP line; drilldown |
| **Statements** | Tab: **Operational** vs **GL** |
| **Journal drill** | `resolveUnifiedJournalEdit` routes to correct editor; block void/correction rows with message |
| **Printable PDF** | Operational statement = **open items**; GL = **journal-based** — label clearly |

---

## 6. Phased rollout (with safety)

| Phase | Name | Actions | Rollback |
|-------|------|---------|----------|
| **1** | Analysis lock | Freeze COA code meanings; document `4000`/`4100`/`5200`/`5300` | N/A |
| **2** | Non-destructive | New codes for shipping if needed; **flags**; `linked_contact_id` backfill; optional `1105` group | Revert migrations via backup |
| **3** | Reporting | Fix `COST_OF_PRODUCTION_CODES`; extend TB modes | Deploy previous build |
| **4** | Posting | Single AR/AP target per flow; commission batch alignment | Stop deploy; restore DB |
| **5** | Backfill | Merge revenue accounts via **transfer JE** | Reverse JEs |
| **6** | Legacy UI | Retire ambiguous “Ledger” labels | Toggle nav |
| **7** | Sign-off | Checklist below | — |

---

## 7. Migration / backfill (principles)

- **Never** hard-delete accounts with journal history.
- **Merge** via opening-style **transfer** JE: Dr old / Cr new (or mirror) with memo referencing migration id.
- **Deprecate:** `is_active: false` + UI “no new posting” guard.

---

## 8. Risk register (open)

| Risk | Mitigation |
|------|------------|
| Shipping/revenue code collision | Separate code + one-time remap |
| Rental operational vs GL mismatch | Reconciliation dashboard |
| Commission not posted | Document “pending” state on sale |
| Branch vs NULL | Document TB/BS branch filter semantics |

---

## 9. Final acceptance checklist

- [ ] **P&L:** Discount (`5200`) and extra (`5300`) appear in **correct** bucket (not COGS unless policy says so).
- [ ] **Revenue:** Single canonical product revenue account per company; migration path for `4000`/`4100` duplicates.
- [ ] **Shipping:** Distinct account code from product revenue **or** documented single revenue pool with report split by dimension.
- [ ] **TB:** `difference === 0` on clean data; AR/AP modes do not change totals.
- [ ] **BS:** Assets = Liabilities + Equity (`difference` field ~ 0); AR/AP no duplicate lines.
- [ ] **Customer:** Operational total reconciles to AR control within tolerance (contacts recon).
- [ ] **Worker:** `2010`/`1180` nets match policy; worker statement labels **operational vs GL**.
- [ ] **Edits:** Header-only vs financial paths documented per module; `correction_reversal` not user-editable.
- [ ] **Void:** Excluded from effective TB; visible in audit JE list.
- [ ] **Docs:** Three blueprints + this plan reviewed by engineering + finance stakeholder.

---

## 10. Cross-reference: prior audits

Before execution, re-read: `REPORTING_RECONCILIATION.md`, `PAYMENT_ISOLATION_RULES.md`, `PARTY_LEDGER_UNIFICATION_PLAN.md`, `ERP_COA_REVIEW_AND_ISSUES_TRACKER_v3.md`, `ROZNAMCHA_POLICY_LOCK.md`.

---

*End of remediation plan.*
