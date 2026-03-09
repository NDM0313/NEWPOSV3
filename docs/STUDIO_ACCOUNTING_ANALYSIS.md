# Studio Manufacturing Accounting & Inventory — Full System Analysis

**Purpose:** Foundation for production-grade accounting + inventory integration.  
**Scope:** stock_movements, sales, sales_items, studio_productions, studio_production_stages, ledger/journal, workers.

---

## 1. Current Inventory Flow

### 1.1 stock_movements

- **Schema:** id, company_id, branch_id, product_id, variation_id, quantity (positive = IN, negative = OUT), unit_cost, total_cost, movement_type, reference_type, reference_id, notes, created_by, created_at.
- **Movement types (verify_stock_movements_schema):** PURCHASE, SALE, RETURN, ADJUSTMENT, TRANSFER, SELL_RETURN, PURCHASE_RETURN, RENTAL_OUT, RENTAL_RETURN. **PRODUCTION not in CHECK** in that migration; app uses PRODUCTION_IN / production in places.
- **Flow today:**
  - **Sale final:** Trigger `sale_final_stock_movement_trigger` (or app in SalesContext) creates **negative** quantity rows per sale line (movement_type SALE, reference_type 'sale').
  - **Studio backfill:** When `setGeneratedInvoiceItem` is called and production is already completed, app inserts PRODUCTION_IN (+qty) for generated_product_id and optionally adjustment (-qty) for fabric. This is **reactive** (on link), not at “Create Product + Generate Invoice” time.
- **Gap:** No guaranteed **finished goods IN** at “Generate Invoice” with cost = production cost. No formal Raw Material → WIP → Finished Goods; inventory is product-level only.

### 1.2 Sales / sales_items

- **sales:** status (draft | quotation | order | final | cancelled), total, paid_amount, due_amount, studio_charges (optional), journal_entry_id (optional).
- **sales_items / sale_items:** sale_id, product_id, quantity, unit_price, total. Studio line linked via studio_productions.generated_invoice_item_id.
- **Flow:** Studio sale → production → stages → “Create Product + Generate Invoice” (product + sales_items row + generated_product_id / generated_invoice_item_id) → Sale Final → stock OUT per line.

---

## 2. Current Accounting Flow

### 2.1 journal_entries / journal_entry_lines

- **journal_entries:** company_id, branch_id, entry_no, entry_date, description, reference_type, reference_id, total_debit, total_credit, is_posted, posted_at, is_manual, created_by. Optional: payment_id.
- **journal_entry_lines:** journal_entry_id, account_id, debit, credit, description (no line_number in main migrations).
- **accounts:** company_id, code, name, type, balance, is_active; optional **subtype** (account_subtype: cash, bank, sales_revenue, accounts_receivable, cost_of_goods_sold, operating_expense, etc.).

### 2.2 Sale final (existing)

- **Trigger:** `auto_post_sale_to_accounting()` on sales (when status → 'final').
- **Entries:** Dr Cash (paid_amount), Dr AR (due_amount), Cr Sales Revenue (total). No COGS entry.

### 2.3 Studio stage cost (existing)

- **RPC:** `rpc_confirm_payment_stage` (studio_production_stage_workflow_sent_received.sql): when stage payment is confirmed, creates journal entry:
  - **Pay Now:** Dr Production Expense (5000), Cr Cash; worker_ledger_entries status = 'paid'.
  - **Pay Later:** Dr Production Expense (5000), Cr Worker Payable (2010); worker_ledger_entries status = 'unpaid'.
- **Reopen:** Reversal JE (Dr Payable/Cash, Cr Production Expense); delete worker_ledger_entries for that stage.
- **Link:** studio_production_stages.journal_entry_id → journal_entries.id.

### 2.4 Worker ledger

- **worker_ledger_entries:** company_id, worker_id, amount, reference_type ('studio_production_stage'), reference_id (stage id), notes, status (paid/unpaid), paid_at. Used for worker payables and payment tracking.

---

## 3. Missing Accounting Links

| Gap | Description |
|-----|-------------|
| **Production cost → product cost** | studio_productions.actual_cost exists but is not always computed from stages + fabric + expenses; not consistently used as unit_cost in finished-goods stock or COGS. |
| **Finished goods inventory at Generate Invoice** | No guaranteed stock_movements PRODUCTION (+1) with cost = actual_cost at “Create Product + Generate Invoice”; backfill only when link is set and production completed. |
| **Dr Finished Goods / Cr Production Expense** | No journal entry when finished product is “received” (at Generate Invoice or production complete). Production Expense is debited per stage but not cleared into FG. |
| **COGS on sale final** | Sale final posts Dr Cash/AR, Cr Revenue only. No Dr COGS, Cr Finished Goods. |
| **Revenue already posted** | Sale final already posts revenue; any extension must not duplicate revenue entry. |
| **Raw Material / WIP** | No dedicated accounts or movements for raw material issue or WIP; design only in WIP_INVENTORY_DESIGN.md. |

---

## 4. Risks in Current Design

| Risk | Mitigation |
|------|------------|
| **Duplicate stock movements** | Idempotency: check by (reference_type, reference_id, movement_type) before insert; trigger and app both skip if sale already has SALE movements. |
| **Duplicate journal entries** | Sale: one journal per sale (reference_type 'sale', reference_id = sale.id); production: one JE per production (reference_type 'studio_production') for Dr FG Cr Prod Exp; stage costs already one JE per stage. |
| **Negative stock** | Safeguard: before SALE movement or COGS, validate available quantity (or allow negative with policy). Implement check in trigger or app. |
| **Generate Invoice before cost known** | Validate production has actual_cost (or computed cost) before allowing inventory + accounting; or use 0 and allow sync later. |
| **Worker expense double-count** | Stage JEs already Dr Prod Exp Cr Payable; “Production complete” JE should be Dr FG Cr Prod Exp for **total** production cost (sum of stage costs + fabric + extras), not create new worker entries. |
| **Breaking existing flows** | Studio Production Save must NOT create inventory or accounting. Only “Generate Invoice” and “Sale Final” trigger new inventory/accounting. All logic idempotent. |

---

## 5. Tables Summary

| Table | Role in studio accounting/inventory |
|-------|-------------------------------------|
| sales | Header; status final triggers stock OUT + sale journal (revenue). |
| sales_items / sale_items | Line items; source for stock OUT and for linking studio line (generated_invoice_item_id). |
| products | Fabric and generated studio product; product_id and generated_product_id. |
| stock_movements | All IN/OUT; SALE on final; PRODUCTION for finished good IN (to add at Generate Invoice). |
| studio_productions | Links sale; actual_cost; generated_product_id, generated_invoice_item_id. |
| studio_production_stages | Stage costs; journal_entry_id; sum of costs = part of production cost. |
| journal_entries / journal_entry_lines | Sale (revenue); stage (Dr Prod Exp Cr Payable/Cash); to add: production (Dr FG Cr Prod Exp), sale final (Dr COGS Cr FG). |
| accounts | Chart of accounts; need Manufacturing accounts (see STEP 2). |
| worker_ledger_entries | Worker payables; consistent with stage JEs (Pay Later) and payment (Pay Now). |

---

*End of STEP 1 — Full System Analysis.*
