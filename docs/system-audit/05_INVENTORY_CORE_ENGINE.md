# 05 — Inventory Core Engine

_Stack: Next.js 14 + Supabase (multi-tenant). Last audited: 2026-04-12._

---

## Business Purpose

The inventory engine is the authoritative ledger for all stock quantity changes across the system. Every module that touches stock — POS sales, purchases, returns, adjustments, transfers, and opening balances — writes a row to `stock_movements`. The engine provides:

- A movement-based, append-only audit trail (no in-place quantity editing except the controlled opening-balance reconcile path)
- Real-time stock availability calculation by summing movement quantities
- Branch-level and company-level stock visibility
- Variation-level tracking for variable products
- Stock valuation output for the inventory overview dashboard

---

## UI Entry Points

| Route / View | Purpose |
|---|---|
| `view: stock` → Stock Overview tab | `InventoryDashboard` / `StockDashboard` — calls `inventoryService.getInventoryOverview`; shows per-product qty, status (Low/OK/Out), stock value |
| `view: inventory` → Stock Analytics tab | Movement log — calls `inventoryService.getInventoryMovements`; filterable by product, branch, date, movement type |
| Adjust Stock dialog | Manual adjustment — calls `productService.createStockMovement` with `movement_type = 'adjustment'` |
| Transfer Stock dialog | Branch-to-branch transfer — calls `productService.createStockMovement` with `movement_type = 'transfer'` (typically two rows: OUT from source, IN to destination) |
| Product Form opening stock | Calls `inventoryService.insertOpeningBalanceMovement` / `reconcileParentLevelOpeningStock` / `reconcileVariationOpeningStock` |

---

## Frontend Files

| File | Role |
|---|---|
| `InventoryDashboard` / `StockDashboard` | Stock Overview UI; renders `InventoryOverviewRow[]` returned by `getInventoryOverview`; shows stock, status, value, variation breakdown |
| `StockMovementsTab` / `InventoryMovementsTab` | Analytics view; renders `InventoryMovementRow[]`; supports filter panel |
| `AdjustStockDialog` | Form for manual positive/negative quantity adjustment |
| `TransferStockDialog` | Form for branch-to-branch stock transfer |
| `ProductForm` | Opening stock entry (see doc 04) |

---

## Backend Services

### `inventoryService.ts` — Key Functions

| Function | Description |
|---|---|
| `getInventoryOverview(companyId, branchId?)` | Main stock overview. Queries `products`, `stock_movements`, `product_variations`, `units` in parallel. Sums `quantity` from movements per product/variation. Returns `InventoryOverviewRow[]`. De-duped against concurrent calls via `inventoryOverviewInFlight` map. |
| `_getInventoryOverviewInner(companyId, branchId?)` | Implementation of the overview; handles schema-fallback for variations, combo product item counts, packing columns (boxes/pieces). |
| `getInventoryMovements(filters)` | Movement log query — returns up to 500 rows ordered by `created_at DESC`. Fetches variation details separately (avoids FK relationship requirement). |
| `getStock(companyId, productId, variationId?, branchId?)` | Single product stock: `SUM(quantity)` from `stock_movements`. Returns raw number (can be negative). |
| `getVariationsWithStock(companyId, productId, branchId?)` | Returns all variation rows for a product with their individual stock sums from movements. |
| `getMovementCountForProduct(productId)` | Count of all `stock_movements` rows for a product (used to decide if opening balance can be set). |
| `insertOpeningBalanceMovement(companyId, branchId, productId, qty, unitCost, variationId?)` | Creates one `movement_type='adjustment'`, `reference_type='opening_balance'` row; calls GL sync after. |
| `reconcileParentLevelOpeningStock(...)` | Insert or in-place update the single opening_balance movement for a parent product; calls GL sync. |
| `reconcileVariationOpeningStock(...)` | Same as parent-level but scoped to `variation_id`. |
| `allowsParentOpeningReconcileFromProductForm(...)` | Returns `true` only if zero or exactly one `opening_balance` movement exists (blocks edits once trade history is present). |
| `allowsVariationOpeningReconcileFromProductForm(...)` | Same guard at variation level. |
| `getParentLevelMovementCount(productId)` | Count of `variation_id IS NULL` movements (blocks enabling variations when parent stock exists). |
| `getVariationLevelMovementCount(productId)` | Count of `variation_id IS NOT NULL` movements (blocks disabling variations when variation stock exists). |
| `syncOpeningJournalIfApplicable(movement)` | Called after any generic `createStockMovement`; triggers GL sync only when `reference_type='opening_balance'` and `movement_type='adjustment'`. |

### `productService.ts` — Inventory-Adjacent Functions

| Function | Description |
|---|---|
| `createStockMovement(data)` | Generic movement insert (adjustments, manual entries). Fires `inventory-updated` CustomEvent on success. Calls `inventoryService.syncOpeningJournalIfApplicable`. |
| `getStockMovements(productId, companyId, variationId?, branchId?)` | Full movement history for one product with product and branch joins. De-duped via `stockMovementsInFlight` map. |
| `getStockForProducts(productIds, companyId, branchId?)` | Batch stock check for multiple products — used in POS cart availability. Returns `Map<"productId" | "productId:variationId", number>`. Uses `calculateStockFromMovements` utility. |
| `getLowStockProducts(companyId, branchId?)` | Delegates to `inventoryService.getInventoryOverview`; filters `minStock > 0 && stock < minStock`. |

---

## DB Tables

| Table | Purpose |
|---|---|
| `stock_movements` | Append-only ledger of every stock quantity change |
| `inventory_balance` | Cached running balance per `(company_id, branch_id, product_id, variation_id)` — present in schema but NOT used by `getInventoryOverview` or `getStock`; stock is recalculated from movements at query time |
| `products` | Product master; `has_variations`, `min_stock`, `cost_price`, `retail_price` referenced during overview build |
| `product_variations` | Variation rows; `attributes` JSONB, pricing columns; `id` used as `variation_id` FK in movements |
| `branches` | Branch lookup joined in movement queries (`branches!branch_id`) |
| `units` | Unit short codes joined for display in overview rows |
| `product_combos` / `product_combo_items` | Combo/bundle products; `is_combo_product` flag on `products`; item count fetched in overview |

---

## stock_movements Schema (Key Columns)

| Column | Type | Description |
|---|---|---|
| `id` | UUID PK | Movement identifier |
| `company_id` | UUID FK | Tenant scoping |
| `branch_id` | UUID FK nullable | Branch where movement occurred; `NULL` = company-level / no branch |
| `product_id` | UUID FK | Product affected |
| `variation_id` | UUID FK nullable | Variation; `NULL` = simple product or orphan parent-level movement |
| `movement_type` | text | Classification of movement — see Movement Types below |
| `reference_type` | text nullable | Source document type (e.g. `'opening_balance'`, `'sale'`, `'purchase'`, `'stock_adjustment'`) |
| `reference_id` | UUID nullable | ID of source document (sale ID, purchase ID, movement ID for GL, etc.) |
| `quantity` | numeric | Net quantity change — **positive = stock IN**, **negative = stock OUT** |
| `unit_cost` | numeric | Cost per unit at time of movement |
| `total_cost` | numeric | Monetary value of movement. **Critical: for `movement_type='sale'` this is negative selling price (retail inventory method), NOT purchase cost** |
| `box_change` | integer nullable | Packing unit: net boxes (positive IN, negative OUT); only populated when packing is enabled |
| `piece_change` | integer nullable | Packing unit: net pieces |
| `before_qty` | numeric nullable | Stock level before this movement (populated by some paths; not always set) |
| `after_qty` | numeric nullable | Stock level after this movement (populated by some paths; not always set) |
| `unit` | text nullable | Unit label at time of movement |
| `notes` | text nullable | Human-readable note |
| `created_by` | UUID nullable | User who created the movement |
| `created_at` | timestamptz | Movement timestamp (used as sort key) |

---

## Movement Types and When Each Is Created

| `movement_type` | Sign of `quantity` | Created By | `reference_type` / `reference_id` |
|---|---|---|---|
| `'sale'` | Negative (stock OUT) | POS sale post; sale service | `'sale'` / sale record ID |
| `'sale_return'` | Positive (stock back IN) | Sale return / credit note | `'sale_return'` / return record ID |
| `'sale_return_void'` | Negative (reverses the return IN) | Voiding a sale return | `'sale_return_void'` / original return ID |
| `'purchase'` | Positive (stock IN) | Purchase order receive | `'purchase'` / purchase order ID |
| `'purchase_return'` | Negative (stock OUT back to supplier) | Purchase return | `'purchase_return'` / purchase return ID |
| `'adjustment'` | Positive or Negative | Manual stock adjustment dialog OR opening balance (see `reference_type`) | `'stock_adjustment'` / adjustment record ID; OR `'opening_balance'` / null for opening stock |
| `'opening'` | Positive | Some import/legacy paths (alternative to `adjustment` + `opening_balance`) | `'opening_balance'` / null |
| `'transfer'` | Negative (source) / Positive (destination) | Branch-to-branch transfer; typically two rows | `'transfer'` / transfer record ID |

**Note on opening stock:** The canonical path (`insertOpeningBalanceMovement`) uses `movement_type = 'adjustment'` with `reference_type = 'opening_balance'`. A `movement_type = 'opening'` value exists for legacy / import paths. The GL sync function (`syncInventoryOpeningFromStockMovementId`) checks for `movement_type = 'adjustment'` — it will NOT fire for `movement_type = 'opening'` rows.

---

## inventory_balance: How It Works

The `inventory_balance` table stores a cached running quantity per `(company_id, branch_id, product_id, variation_id)`. It is intended for fast point-in-time reads (e.g. POS availability) without summing the full movements ledger.

**Current state:** The application's primary stock queries (`getInventoryOverview`, `getStock`, `getStockForProducts`) do **not** read `inventory_balance` — they all recalculate from `stock_movements` at query time. The table appears to be maintained via DB-level triggers or a separate sync path that is not present in the audited service files.

**Implication:** Until `inventory_balance` is verified to be kept in sync by a reliable trigger on all movement writes, it must not be used as the authoritative stock source. Any consumer that reads directly from `inventory_balance` may see stale data.

---

## Stock Adjustment Flow (Manual Adjustment)

1. User opens Adjust Stock dialog, enters product (and optionally variation), branch, and quantity delta (positive or negative).
2. `productService.createStockMovement` is called with:
   ```
   movement_type  = 'adjustment'
   reference_type = 'stock_adjustment'  (or null for simple adjustments)
   reference_id   = <adjustment record ID if one exists>
   quantity       = <delta — positive for increase, negative for decrease>
   unit_cost      = <entered or defaulted cost>
   total_cost     = unit_cost × |quantity|
   ```
3. On success: fires `inventory-updated` CustomEvent; calls `syncOpeningJournalIfApplicable` (no-op because `reference_type` is not `'opening_balance'`).
4. Stock overview recalculates automatically on next load by summing all movements including the new adjustment row.

No balance update is written to `inventory_balance` through this code path (service layer only writes to `stock_movements`).

---

## Stock Transfer Flow (Branch-to-Branch Transfer)

A transfer between branches results in two `stock_movements` rows — one OUT from the source branch and one IN to the destination branch:

```
Row 1 (source OUT):
  movement_type  = 'transfer'
  branch_id      = <source branch>
  quantity       = <negative>
  reference_type = 'transfer'
  reference_id   = <transfer document ID>

Row 2 (destination IN):
  movement_type  = 'transfer'
  branch_id      = <destination branch>
  quantity       = <positive>
  reference_type = 'transfer'
  reference_id   = <transfer document ID>
```

When `branchId` filter is applied in `getInventoryOverview` or `getStock`, only movements where `branch_id` matches are included, so each branch sees its own net stock correctly.

---

## Stock Valuation Method — Retail Inventory Method

**This system uses the retail inventory method, not a cost-based method.**

For a sale movement:
- `quantity` = negative selling units (e.g. -3)
- `unit_cost` = selling price per unit (NOT purchase cost)
- `total_cost` = negative selling price total (e.g. -450.00 if unit sold at 150)

This means `SUM(stock_movements.total_cost)` for a product gives **net retail value flow**, not gross margin or purchase cost basis.

The `cost_price` column on `products` (and `cost_price` / `purchase_price` on `product_variations`) is a reference field set at product setup time and is not automatically written into movement rows at point of sale.

**Inventory valuation on the overview screen** (`InventoryOverviewRow.stockValue`) is calculated as:
```
stockValue = totalStock × products.cost_price
```
This uses the product's reference cost price, not `total_cost` from movements.

**Implication:** `total_cost` in `stock_movements` should not be used for COGS or gross margin analysis in any standard accounting sense. Cost-based reports must use `products.cost_price` or `product_variations.cost_price` (or the weighted-average from purchase movements' `unit_cost`) joined to movement quantities.

---

## Source of Truth for Stock

| Query Path | Uses | When to Use |
|---|---|---|
| `inventoryService.getInventoryOverview` | `SUM(stock_movements.quantity)` in-app | Stock Overview dashboard — all products at once |
| `inventoryService.getStock` | `SUM(stock_movements.quantity)` direct DB query | Single product/variation/branch stock lookup |
| `productService.getStockForProducts` | `SUM(stock_movements.quantity)` batch | POS cart availability for a set of product IDs |
| `calculateStockFromMovements` utility | Client-side sum of already-fetched movement rows | After `getStockMovements` has loaded rows |
| `inventory_balance` table | Cached balance (trigger-maintained) | **Not currently used by service layer** — do not trust without confirming trigger coverage |

**Design rule from service comments:** "Stock = movement-based only (`stock_movements`); no `product.current_stock`."

---

## Reports Impact

### StockDashboard / InventoryDashboard

- Calls `inventoryService.getInventoryOverview(companyId, branchId?)`.
- Displays `stock`, `boxes`, `pieces`, `unit`, `avgCost`, `sellingPrice`, `stockValue`, `status` per product.
- Status thresholds:
  - `'Out'` — `totalStock <= 0`
  - `'Low'` — `minStock > 0 && totalStock <= minStock`
  - `'OK'` — otherwise
- Movement velocity (`movement` field) is always returned as `'Medium'` — the velocity classification logic has not been implemented.
- Variation breakdown is returned in `variations[]` per product including `purchasePrice`, `sellingPrice`, `stockValueAtCost`, `retailStockValue`.

### StockMovementsTab / InventoryMovementsTab

- Calls `inventoryService.getInventoryMovements(filters)`.
- Hard limit: 500 rows per query (no pagination implemented).
- Variation attributes fetched in a second query; `variation` field on each row is a denormalised `{ id, attributes }` object.

---

## Known Failure Points

1. **Phantom stock from draft returns:** If a `sale_return` movement is created before a return is confirmed/posted, stock is immediately increased. If the return is later cancelled (not voided via `sale_return_void`), the phantom stock remains.

2. **Negative stock is silent:** The service allows and returns negative stock totals with no automatic block. A console warning is logged in DEV mode only. The POS may sell items into negative stock if no client-side guard is enforced at checkout.

3. **Orphan movements (no variation_id for variable products):** When a sale or adjustment is created without supplying `variation_id` for a product with `has_variations = true`, the movement is recorded at the parent level (`variation_id IS NULL`). `getInventoryOverview` accounts for this via the `orphanParent` sum, but `getVariationsWithStock` will miss the stock — the variation-level UI will show lower-than-actual stock.

4. **500-row limit on movement log:** `getInventoryMovements` returns a hard-coded `.limit(500)`. High-volume products lose older movement history in the UI with no pagination or warning.

5. **`movement_type = 'opening'` excluded from GL sync:** The canonical opening path uses `movement_type = 'adjustment'`. Legacy or import-created `movement_type = 'opening'` rows are never processed by `syncOpeningJournalIfApplicable` because it checks for `movement_type = 'adjustment'`. Those rows create stock without a GL entry.

6. **`inventory_balance` staleness:** The `inventory_balance` table exists but the service layer always bypasses it. If any consumer does read `inventory_balance`, it may see stale data because there is no confirmed write path for it in the audited services.

7. **`total_cost` semantic mismatch:** For sale movements, `total_cost` = negative selling price (retail method). Any report that naively sums `total_cost` across all movement types (purchases + sales) will produce meaningless numbers. There is no column flag to distinguish cost-basis vs. selling-price total.

8. **No GL entry for non-opening adjustments:** Manual `adjustment` movements with `reference_type = 'stock_adjustment'` do not trigger a GL journal. Inventory count changes (positive or negative) are not reflected in the general ledger outside of the opening balance path. This is a material accounting gap for accrual-basis reporting.

9. **`before_qty` / `after_qty` not always populated:** These columns exist on `stock_movements` but are only populated by specific code paths. The movement log UI cannot reliably show running balance from these columns.

10. **In-flight guard races:** `inventoryOverviewInFlight` and `stockMovementsInFlight` guards protect against duplicate concurrent requests within a single browser session, but are in-memory only. Server-side or multi-tab scenarios are not covered.

---

## Recommended Standard

1. **Enforce `variation_id` on all movements for variable products:** Add a server-side check (DB constraint or service guard) that rejects `stock_movements` inserts where the product has `has_variations = true` and `variation_id IS NULL`. This eliminates orphan parent-level movements silently inflating or deflating the wrong level.

2. **Implement GL entries for manual adjustments:** Positive adjustments should post Dr Inventory 1200 / Cr Stock Adjustment Expense (or a designated contra account). Negative adjustments should reverse. This closes the accounting gap identified in Known Failure Point 8.

3. **Paginate the movement log:** Replace the hard `.limit(500)` in `getInventoryMovements` with cursor-based or offset pagination so high-volume products have full auditability.

4. **Standardise `movement_type = 'opening'` to `'adjustment'`:** Run a data migration to update all rows with `movement_type = 'opening'` to `movement_type = 'adjustment'` where `reference_type = 'opening_balance'`, then trigger `syncInventoryOpeningFromStockMovementId` for each. Remove `'opening'` from documented movement types.

5. **Activate and trust `inventory_balance`:** Implement a DB trigger on `stock_movements` (INSERT/UPDATE/DELETE) that upserts `inventory_balance` atomically. Once verified, replace `SUM(stock_movements.quantity)` calls in `getStockForProducts` (the POS hot path) with a direct `inventory_balance` read for sub-millisecond availability checks.

6. **Add a `cost_basis` column to `stock_movements`:** Separate the retail-price tracking (`total_cost`) from cost-basis tracking by adding a `cost_basis` column that stores `quantity × purchase_cost` on all movement types. This enables standard COGS and gross-margin reporting without rewriting the retail inventory valuation method.

7. **Surface negative stock warnings to users:** Add a UI badge or banner in the Stock Overview when any product shows negative stock, rather than logging only to the dev console.
