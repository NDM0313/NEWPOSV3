# Studio Accounting Flow

**Purpose:** Document inventory and accounting flows for Studio Manufacturing.  
**Test migrations:** All automation lives under `migrations/test/` until approved.

---

## 1. Inventory Flow

| Step | Event | Inventory change |
|------|--------|-------------------|
| Raw material (fabric) | Sale line added (fabric product) | No stock movement yet (fabric may be purchased separately). |
| Production stages | Customize Tasks → Save | **No** inventory change (stages only). |
| Worker costs | Confirm payment (Pay Now / Pay Later) | **No** stock movement; accounting only (Dr Prod Exp, Cr Payable/Cash). |
| **Generate Invoice** | User clicks “Create Product + Generate Invoice” | **Trigger:** `trigger_studio_generate_invoice_inventory_journal_test` → INSERT stock_movements: product_id = generated_product_id, quantity = +1, movement_type = PRODUCTION, total_cost = actual_cost. |
| Sale Final | Status → final | **Existing trigger:** stock_movements (negative) per sale line (SALE). |

**Rules:** Studio Production Save must NOT create inventory. Only Generate Invoice (and Sale Final) trigger inventory changes.

---

## 2. Accounting Flow

| Step | Event | Journal entry |
|------|--------|----------------|
| Stage cost recorded | rpc_confirm_payment_stage (Pay Now) | Dr Production Expense (5000), Cr Cash. |
| Stage cost recorded | rpc_confirm_payment_stage (Pay Later) | Dr Production Expense (5000), Cr Worker Payable (2010). |
| **Generate Invoice** | generated_product_id set on studio_productions | Dr Finished Goods Inventory (1220), Cr Production Expense (5000). Amount = actual_cost. |
| **Sale Final** | status = final | (Existing) Dr Cash/AR, Cr Sales Revenue. **(Test)** Dr COGS (5100), Cr Finished Goods (1220). Amount = sum(studio_productions.actual_cost) for that sale. |
| Worker paid | Payment to worker | Dr Worker Payable (2010), Cr Cash. (Handled by payment flow; worker_ledger_entries status → paid.) |

---

## 3. Account Codes (Manufacturing)

| Code | Name | Type |
|------|------|------|
| 1200 | Raw Material Inventory | asset |
| 1210 | Work In Progress | asset |
| 1220 | Finished Goods Inventory | asset |
| 5100 | Cost of Goods Sold | expense |
| 5000 | Production Expense | expense |
| 2010 | Worker Payable | liability |
| 4000 | Sales Revenue | revenue |

---

## 4. Idempotency and Safety

- **Stock PRODUCTION:** One per studio_production (unique index + trigger skip if movement exists).
- **Sale final stock OUT:** Existing trigger skips if SALE movements already exist for that sale.
- **COGS journal:** Trigger skips if a journal entry for that sale with account 5100 already exists.
- **Production cost:** calculate_production_cost() overwrites actual_cost; safe to call multiple times.

---

*See also: docs/PRODUCTION_COSTING_MODEL.md, docs/STUDIO_ACCOUNTING_ANALYSIS.md.*
