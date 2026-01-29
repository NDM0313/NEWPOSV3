# Inventory Management – Single Source of Truth (ERP Design)

**Goal:** Inventory is not dummy numbers. Stock is the single source of truth. Sale / Purchase / Adjustment / Packing all verify from here.

---

## STEP 1 – Real Scope (ERP Thinking)

Inventory must answer:

| Question | Answer source |
|----------|----------------|
| Kitna stock hai? | `inventory_balance` (current snapshot) |
| Stock kyun badha/kam hua? | `stock_movements` / `inventory_movements` |
| Kis document se? | `ref_type` + `ref_id` |
| Kis branch mein? | `branch_id` |
| Kis unit / packing ke sath? | `qty` + `boxes` + `pieces` + `unit` |
| Abhi current balance kya hai? | `inventory_balance` |
| Reorder kab karna hai? | Derived from `min_stock` + balance |

---

## STEP 2 – Two Tabs, Clear Roles

### Tab 1: Stock Overview (Summary + Control)

**Role:** High-level monitoring, decision making, action triggers.

**Recommended columns (flexible):**

| Field | Source |
|-------|--------|
| Product | `products` |
| SKU | `products` |
| Category | `product_categories` |
| Stock (Main Qty) | `inventory_balance.qty` |
| Boxes | `inventory_balance.boxes` |
| Pieces | `inventory_balance.pieces` |
| Unit | `products` |
| Avg Cost | Computed (from movements or product) |
| Selling Price | `products.retail_price` |
| Stock Value | qty × avg cost |
| Status | Derived (Low / OK / Out) |
| Movement | Derived (Fast / Slow) |

- Packing (Box / Pieces) must be visible – not just “27” but “27 pcs, 2 box” clarity.

### Tab 2: Stock Analytics (Deep Analysis)

**Role:** Trends, audit, reports, print/PDF.

**Features:**

- Date range filter  
- Branch filter  
- Product filter  
- Movement type: Purchase, Sale, Adjustment, Opening  
- Charts: In vs Out, Fast/Slow moving  
- Export / PDF  

---

## STEP 3 – Database Design

### 3.1 `inventory_balance` (Current snapshot – **NEW**)

**Purpose:** Only current balance. Never manually edited.

| Column | Type | Notes |
|--------|------|------|
| product_id | UUID | FK products |
| branch_id | UUID | FK branches, nullable = company-level |
| qty | NUMERIC | Main quantity (meters/pcs) |
| boxes | NUMERIC | Box count |
| pieces | NUMERIC | Loose pieces |
| unit | TEXT | e.g. meters, pcs |
| updated_at | TIMESTAMPTZ | |

- **Unique:** `(product_id, branch_id)` (or product_id only if no branch).
- Updated only by: Purchase Final, Sale Final, Adjustment (via movements).

### 3.2 `stock_movements` (Single source of truth – **EXTEND**)

**Existing:** id, company_id, branch_id, product_id, variation_id, movement_type, quantity, unit_cost, total_cost, reference_type, reference_id, notes, created_by, created_at.

**Add for packing + audit:**

| Column | Type | Notes |
|--------|------|------|
| box_change | NUMERIC | +/– boxes |
| piece_change | NUMERIC | +/– pieces |
| before_qty | NUMERIC | Balance before this movement |
| after_qty | NUMERIC | Balance after this movement |
| unit | TEXT | Optional, e.g. meters |

- **movement_type:** purchase \| sale \| adjustment \| opening (and existing RETURN, TRANSFER if used).
- **reference_type / reference_id:** PO, Sale, Adjustment document.

All stock changes (Sale, Purchase, Adjustment) must insert here first; then `inventory_balance` is updated (trigger or app logic).

---

## STEP 4 – Packing Integration

At inventory level, track in parallel:

1. **Quantity** (meters / qty)  
2. **Boxes**  
3. **Pieces**  

**Example – Sale:**

- 1 Box, 2 Pieces, 80.1 meters

**In `stock_movements`:**

- `quantity` = -80.1  
- `box_change` = -1  
- `piece_change` = -2  

**In `inventory_balance` (after movement):**

- `qty` = old_qty - 80.1  
- `boxes` = old_boxes - 1  
- `pieces` = old_pieces - 2  

Packing from Sale/Purchase forms must flow into these columns so inventory and ledger match.

---

## STEP 5 – Backend Flow (Real Wiring)

| Event | Action |
|-------|--------|
| **Purchase Final** | INSERT `stock_movements` (+qty, +boxes, +pieces), then UPDATE `inventory_balance` |
| **Sale Final** | INSERT `stock_movements` (-qty, -boxes, -pieces), then UPDATE `inventory_balance` |
| **Adjustment** | INSERT `stock_movements` (+/–), then UPDATE `inventory_balance` |

- Inventory UI **never** updates stock directly.  
- All changes go through movements only.

---

## STEP 6 – APIs (Backend Linking)

### Stock Overview API

**GET** inventory overview (e.g. `/inventory/overview` or service method).

- Join: `products`, `inventory_balance`, `product_categories`, prices.
- Optional: branch_id filter.
- Returns: product, SKU, category, qty, boxes, pieces, unit, avg cost, selling price, stock value, status, movement.

### Stock Analytics / Movements API

**GET** inventory movements (e.g. `/inventory/movements` or service method).

- Filters: product_id, branch_id, date_from, date_to, movement_type.
- Returns: list of movements with ref_type, ref_id, qty_change, box_change, piece_change, before_qty, after_qty, created_at.

---

## STEP 7 – UI Actions (Allowed Only)

| Action | Allowed |
|--------|--------|
| View Full Ledger | Yes |
| Adjust Stock | Yes (creates movement + updates balance) |
| Print / Export | Yes |
| Direct edit stock (typing in balance) | **No** |

---

## STEP 8 – Print / PDF

- Product info  
- Opening balance  
- All movements (with packing: box/pieces/qty)  
- Closing balance  
- Align with existing **Full Stock Ledger View** (product + movements + totals).

---

## STEP 9 – Out of Scope (Future)

- Multi-warehouse transfer  
- Batch / lot tracking  
- Expiry dates  

---

## Current vs Target (Codebase)

| Aspect | Current | Target |
|--------|---------|--------|
| Balance | `products.current_stock` (no boxes/pieces, no branch) | `inventory_balance` (qty, boxes, pieces, branch_id) |
| Movements | `stock_movements` (quantity, no box/piece, no before/after) | `stock_movements` extended (box_change, piece_change, before_qty, after_qty) |
| Overview | Products + sales/purchases derived | API from `inventory_balance` + products + categories |
| Analytics | Ad hoc | Dedicated movements API + filters + export |
| Packing | In sale/purchase items, not always in movements | Every movement has qty + box_change + piece_change |

---

## Implementation Phases

**Phase 1 – Foundation**  
- Add `inventory_balance` table.  
- Add columns to `stock_movements`: box_change, piece_change, before_qty, after_qty, unit.  
- Trigger or service: on INSERT movement → update `inventory_balance` (and optionally keep `products.current_stock` in sync for backward compatibility).

**Phase 2 – APIs**  
- `getInventoryOverview(companyId, branchId?)`  
- `getInventoryMovements(filters)`  

**Phase 3 – UI**  
- Tab 1: Stock Overview (table from overview API, View Ledger, Adjust, Print).  
- Tab 2: Stock Analytics (filters, movements table, charts, export/PDF).  

**Phase 4 – Wiring**  
- Purchase Final → insert movement (+qty, +boxes, +pieces), update balance.  
- Sale Final → insert movement (-qty, -boxes, -pieces), update balance.  
- Adjustment drawer → insert movement, update balance.  

---

## Final Outcome

- Inventory numbers match Sale / Purchase.  
- Packing mismatch = zero (boxes/pieces in movements + balance).  
- Stock audit clear from movements.  
- ERP-grade, long-term design.
