# ERP Global Save / Edit / Inventory / Packing Contract

**Roman Urdu summary neeche. Ye document system-level rules define karta hai.**

---

## 1. GLOBAL SAVE / EDIT RULE

> **"Jo cheez user input karta hai aur save hoti hai, woh database mein proper IDs (foreign keys) ke sath save hogi, aur edit mode open hone par exact wahi values UI mein pre-filled hongi."**

### Entities & Required IDs

| Entity      | Save (DB) | Edit load (Frontend) |
|------------|-----------|----------------------|
| **Product** | category_id, unit_id, brand_id, has_variations | Dropdowns ID se map; unit_id → units.short_code |
| **Purchase** | purchase + purchase_items (product_id, variation_id, unit, packing_details) | items: variation_id → selectedVariationId, unit, packingDetails from packing_details |
| **Sale**    | sale + sale_items (product_id, variation_id, unit, packing_details) | Same: variation_id, unit, packing_details → form |
| **Customer/Supplier** | contact id, type | getById → form pre-fill |
| **Inventory** | Stock = stock_movements se calculated; koi manual current_stock update nahi as source of truth | getInventoryOverview() = movement-based |

### Agar edit pe kuch select nahi hota

- **Backend:** Check karo woh field DB mein save ho raha hai (correct column + FK).
- **Frontend:** Check karo load karte waqt same key se map ho (e.g. `item.variation_id` → `selectedVariationId`, `item.packing_details` → `packingDetails`).

---

## 2. PRODUCT UNIT – SINGLE SOURCE OF TRUTH

- **products.unit_id** = FK to **units.id**. Sirf label nahi, ID save hoti hai.
- Edit screen: unit dropdown **unit_id** se map (value = unit.id).
- Inventory / Purchase / Sale: unit display **units.short_code** (pcs, m, yd) – product se resolve ya line item par saved `unit` (short code).
- "Meter & Yards (M&Y)" jaisa name **units** table mein name/short_code ke sath store ho.

---

## 3. PACKING TOGGLE (GLOBAL)

| Setting       | Stock column | Boxes | Pieces | Unit column |
|---------------|--------------|-------|--------|-------------|
| **Packing OFF** | ✅ (actual qty) | ❌ hide | ❌ hide | ❌ hide |
| **Packing ON**  | ✅ | ✅ | ✅ | ✅ (numeric value, e.g. 38, 128.2) |

- Inventory, Purchase View, Sale View – sab jagah same logic (enablePacking se control).
- Unit column = quantity number, sirf "pcs" text nahi.

---

## 4. INVENTORY + VARIATIONS

- Parent product **stock** = sum of all variation stocks (negative allowed).
- Variation row: stock negative ho sakta hai (red + minus).
- Packing ON: Boxes/Pieces ab **real** – `stock_movements.box_change` / `piece_change` ka sum (migration 30 + aggregate).
- Source: **stock_movements** only; **products.current_stock** direct source of truth nahi.

---

## 5. PURCHASE / SALE EDIT – IDs SAVE + HYDRATE

- **PurchaseItem / SaleItem** DB mein: product_id, variation_id, unit (short code), packing_details (JSONB).
- Edit load: Form ko **IDs + unit + packing** ke basis par hydrate karo (guess nahi).
  - variation_id → selectedVariationId (dropdown preselect).
  - unit → item.unit.
  - packing_details → packingDetails (total_boxes, total_pieces, total_meters).
- Same logic Purchase aur Sale dono par.

---

## 6. INVENTORY FLOW (SINGLE SOURCE)

- **Purchase create** → stock_movements (+qty, reference_type=purchase).
- **Sale create** → stock_movements (-qty, reference_type=sale).
- **Delete purchase** → reverse movement (adjustment -qty) then delete purchase.
- **Delete sale** → reverse movement (adjustment +qty) then delete sale.
- Inventory page = **calculated** from stock_movements (getInventoryOverview); manual value nahi.

---

## 7. ACCOUNTING & INVENTORY LINK

- Extra expenses (freight, cargo) → accounting entry + optional inventory value impact.
- Discount → accounting + sale/purchase total par.
- Supplier ledger: Purchase, Payment, Discount, Extra expense sab visible (ledger service + reference_type).

---

## 8. VERIFICATION CHECKLIST

- [ ] Save ke baad edit mein same data (IDs + unit + packing + variation).
- [ ] Inventory numbers purchase/sale ke sath sync (movement-based).
- [ ] Packing ON/OFF har page par consistent (Inventory, Purchase View, Sale View).
- [ ] Variations correctly show (parent = sum; variation row negative allowed).
- [ ] No hardcoded UI-only values; sab transactional (DB se save/load).
- [ ] Product unit = unit_id FK; edit par unit dropdown preselect.

---

**Files touched in this ERP fix:**

- `PurchaseContext.tsx` – convertFromSupabasePurchase: unit, packingDetails, variation; default unit 'pcs'; PurchaseItem type; createStockMovement with box_change, piece_change from packingDetails.
- `SalesContext.tsx` – sale item unit default 'pcs'; create/update item.unit; createStockMovement with box_change, piece_change (negative for sale).
- `PurchaseForm.tsx` – edit item map: unit from item.unit.
- `SaleForm.tsx` – edit map: unit, packing_details || packingDetails.
- `ViewPurchaseDetailsDrawer.tsx` – packing_details || packingDetails; unit fallback 'pcs'.
- `inventoryService.ts` – getInventoryOverview: select/aggregate box_change, piece_change; row boxes/pieces + variation boxes/pieces.
- `productService.ts` – createStockMovement: box_change, piece_change params.
- `purchaseService.ts` – deletePurchase: reverse movement mein box_change, piece_change reverse.
- `InventoryDashboardNew.tsx` – variation row: v.boxes, v.pieces.
- Migration: `29_erp_products_unit_id_and_units_columns.sql` – units table + products.unit_id.
- Migration: `30_stock_movements_box_piece_columns.sql` – stock_movements.box_change, piece_change.
