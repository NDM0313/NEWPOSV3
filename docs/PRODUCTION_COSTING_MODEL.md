# Production Costing Model

**Purpose:** Define how production cost is calculated and used for inventory and COGS.

---

## 1. Production Cost Calculation

**Function:** `calculate_production_cost(production_id)` (test migration).

**Formula:**

- **Stage costs:** Sum of `studio_production_stages.cost` for that production (worker costs already recorded via rpc_confirm_payment_stage).
- **Fabric cost:** Sum of (unit_price × quantity) from sales_items (or sale_items) for the same sale where product_id = studio_productions.product_id (raw material line).
- **Total:** actual_cost = stage_cost + fabric_cost (stored in studio_productions.actual_cost).

**When called:**

- By trigger when generated_product_id is set (before inserting PRODUCTION stock and Dr FG Cr Prod Exp).
- Can be called manually or from app to refresh actual_cost.

---

## 2. Cost Flow

```
Fabric (sale line)     → part of actual_cost
Worker stage costs     → Production Expense (5000) at payment confirm
                        → later transferred out when FG received: Cr Production Expense (5000)
Finished goods receive → Dr Finished Goods (1220), Cr Production Expense (5000)  [amount = actual_cost]
Sale final             → Dr COGS (5100), Cr Finished Goods (1220)  [amount = sum of actual_cost for sale]
```

---

## 3. Profit Calculation

- **Revenue:** From sale (Sales Revenue 4000) when sale is final.
- **COGS:** From sale_final_cogs_journal_test (Cost of Goods Sold 5100).
- **Gross profit:** Revenue − COGS (per sale or per period).

---

## 4. Worker Expense Consistency

- When stage cost is confirmed: Dr Production Expense, Cr Worker Payable (or Cash), and worker_ledger_entries row (unpaid/paid).
- When production is “received” (Generate Invoice): Cr Production Expense (transfer to FG); no change to Worker Payable (worker still owed or already paid).
- When worker is paid: Dr Worker Payable, Cr Cash (separate payment flow); worker_ledger_entries status = paid.

---

*See also: docs/STUDIO_ACCOUNTING_FLOW.md.*
