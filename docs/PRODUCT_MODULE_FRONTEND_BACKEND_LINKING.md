# Product Module – Frontend & Backend Linking (Analysis & Implementation)

**Roman Urdu:** Products page ka 3-dots Actions menu, data flow, aur backend/database linking ka clear document. Sale module jaisi approach: pehle frontend analyze, phir backend mapping, single source of truth, aur documentation.

---

## STEP 1 – Frontend Deep Analysis (Done)

### 1.1 Products List Data Flow

| Item | Source | Status |
|------|--------|--------|
| **API** | `productService.getAllProducts(companyId)` | ✅ Real (Supabase) |
| **Tables** | `products` (+ join `product_categories`, `product_variations`) | ✅ Backend |
| **Fields** | id, sku, name, thumbnail, branch_name, unit, cost_price, retail_price, current_stock, has_variations, category.name, brand, is_active, min_stock | ✅ All from backend |
| **Summary cards** | totalProducts, totalValue, lowStock, outOfStock – computed from `products` | ✅ Real (no dummy) |
| **Filters** | branch, category, brand, type, status, stockStatus – applied client-side on loaded products | ✅ Real data; branch options are hardcoded list (improvement: load branches from API) |

**Conclusion:** Products list is backend-driven. No dummy product array; data comes from `getAllProducts`.

---

### 1.2 3-Dots Actions – Per-Action Analysis

| Action | UI behavior | API call? | Response source |
|--------|-------------|-----------|-----------------|
| **View Details** | Opens `ViewProductDetailsDrawer` | ✅ Yes – `productService.getProduct(product.uuid)` on open | Backend (product + category + variations) |
| **Edit Product** | Opens drawer `edit-product` → `EnhancedProductForm` with `drawerData.product` | ✅ Yes – on Save: `productService.updateProduct(id, productData)` (fixed; was only create) | Backend (UPDATE `products`) |
| **Stock History** | Opens `ProductStockHistoryDrawer` | ✅ Yes – `productService.getStockMovements(productId, companyId, ...)` | Backend (`stock_movements` table) |
| **Adjust Price** | Opens `AdjustPriceDialog` | ✅ Yes – on Save: `productService.updateProduct(product.uuid, { cost_price, retail_price })` | Backend (UPDATE `products`) |
| **Adjust Stock** | Opens `AdjustStockDialog` | ✅ Yes – on Save: `productService.updateProduct(..., { current_stock })` + `productService.createStockMovement({ movement_type: 'adjustment', quantity, notes })` | Backend (UPDATE `products` + INSERT `stock_movements`) |
| **Delete** | Opens AlertDialog; on confirm: `productService.deleteProduct(selectedProduct.uuid)` | ✅ Yes – soft delete (is_active: false) | Backend (UPDATE `products`) |

**Dummy / UI-only removed or verified:**

- **Edit Product:** Previously the form always called `createProduct` even when opening with a product (edit mode). **Fixed:** When `initialProduct.uuid` or `initialProduct.id` is present, the form now calls `productService.updateProduct(productId, productData)` so Save runs a real UPDATE.
- **View Details:** Already fetched full product via `getProduct(uuid)` – real.
- **Stock History:** Already used `getStockMovements` – real; totals are derived from movements (sale/purchase/adjustment).
- **Adjust Price / Adjust Stock / Delete:** Already called backend – real.

---

## STEP 2 – Backend & Database Mapping

### 2.1 View Details

| Requirement | Implementation |
|-------------|----------------|
| Backend se product ka complete record | `productService.getProduct(id)` → `products` + `product_categories` + `product_variations` |
| product, variations, stock, pricing, history | Product + variations from API; stock = `current_stock`; pricing = cost_price, retail_price; history = Stock History action (separate drawer) |
| Dummy data not allowed | ✅ All from `getProduct` |

**Tables touched:** `products`, `product_categories`, `product_variations` (read).

---

### 2.2 Edit Product

| Requirement | Implementation |
|-------------|----------------|
| Form fields → DB columns | name, sku, category_id, cost_price, retail_price, current_stock, min_stock, description, etc. mapped to `products` |
| Save = real UPDATE | `productService.updateProduct(id, productData)` → Supabase `products.update().eq('id', id)` |
| Pre-fill from list or API product | Form accepts both list shape (purchasePrice, sellingPrice, stock) and API shape (cost_price, retail_price, current_stock); pre-populate with fallbacks. |

**Tables touched:** `products` (update). Variations: create path only; edit path can be extended later for variation updates.

---

### 2.3 Stock History

| Requirement | Implementation |
|-------------|----------------|
| Actual stock movement table | `productService.getStockMovements(productId, companyId, variationId?, branchId?)` → `stock_movements` |
| sale, purchase, adjustment | Filtering by `movement_type` (sale, purchase, adjustment, return, etc.); UI shows all types. |
| No UI-only / fake entries | ✅ All rows from `stock_movements`. |

**Tables touched:** `stock_movements` (read).

---

### 2.4 Adjust Price

| Requirement | Implementation |
|-------------|----------------|
| Price change saved | `productService.updateProduct(product.uuid, { cost_price, retail_price })` → `products` |
| Old + new price record (audit) | Currently only `products` is updated. For full audit trail, a future `product_prices` or `price_history` table can store old/new + timestamp. |

**Tables touched:** `products` (update – cost_price, retail_price).

---

### 2.5 Adjust Stock

| Requirement | Implementation |
|-------------|----------------|
| Separate record | `productService.createStockMovement({ movement_type: 'adjustment', quantity, notes, ... })` → `stock_movements` |
| Quantity + reason | quantity (signed); notes = reason text. |
| Real decrement/increment | `productService.updateProduct(..., { current_stock: newStock })` then `createStockMovement`; product row and movement row both updated. |

**Tables touched:** `products` (update – current_stock), `stock_movements` (insert).

---

### 2.6 Delete Product

| Requirement | Implementation |
|-------------|----------------|
| Soft delete (recommended) | `productService.deleteProduct(id)` → `products.update({ is_active: false }).eq('id', id)` |
| Linked sales/stock integrity | Soft delete keeps FK references valid; no cascade delete. |

**Tables touched:** `products` (update – is_active).

---

## STEP 3 – Single Source of Truth Rule

- **Products page UI** reads from backend only: list from `getAllProducts`, details from `getProduct`, stock history from `getStockMovements`.
- **No dummy arrays, hardcoded status, fake stock, or mock responses** in the product module for list/details/actions.
- **Jo product DB mein hai → wahi UI mein show ho; jo UI mein change ho → wahi DB mein save ho.**

---

## STEP 4 – Database Consistency

- **Product** – `products` (id, company_id, category_id, name, sku, cost_price, retail_price, current_stock, etc.).
- **Product Variations** – `product_variations` (product_id, attributes, price, stock).
- **Stock** – `products.current_stock`; movements in `stock_movements`.
- **Stock History** – `stock_movements` (product_id, movement_type, quantity, reference_type, reference_id, notes).
- **Price adjustments** – currently on `products`; optional future: `product_prices` or audit table for old/new + timestamp.

All linked by `product_id` (and optionally variation_id, branch_id) so reports and ledger can stay consistent (Sale module level).

---

## STEP 5 – Documentation Summary

### Frontend Components

| Component | Role |
|-----------|------|
| `ProductsPage.tsx` | List, filters, pagination, 3-dots menu; calls `productService.getAllProducts`, handles action routing. |
| `ViewProductDetailsDrawer.tsx` | View Details: fetches `productService.getProduct(uuid)`, shows product + category + pricing + stock. |
| `EnhancedProductForm.tsx` | Add/Edit: create = `createProduct`; edit = `updateProduct` (when initialProduct.uuid/id present). |
| `ProductStockHistoryDrawer.tsx` | Stock History: fetches `productService.getStockMovements`, shows movements and derived totals. |
| `AdjustPriceDialog.tsx` | Adjust Price: saves via `productService.updateProduct(uuid, { cost_price, retail_price })`. |
| `AdjustStockDialog.tsx` | Adjust Stock: `updateProduct(..., { current_stock })` + `createStockMovement(..., movement_type: 'adjustment')`. |
| Delete | In ProductsPage: `productService.deleteProduct(uuid)` (soft delete). |

### APIs Used (productService)

| Method | Purpose | Table(s) |
|--------|---------|----------|
| `getAllProducts(companyId)` | List products | products, product_categories, product_variations |
| `getProduct(id)` | Single product + category + variations | products, product_categories, product_variations |
| `createProduct(payload)` | Add product | products (insert) |
| `updateProduct(id, updates)` | Edit product / adjust price / adjust stock (current_stock) | products (update) |
| `deleteProduct(id)` | Soft delete | products (update is_active) |
| `getStockMovements(productId, companyId, ...)` | Stock history | stock_movements |
| `createStockMovement(data)` | Adjustment record | stock_movements (insert) |

### Action → API → DB Flow

| Action | API | DB operation |
|--------|-----|--------------|
| View Details | getProduct(uuid) | SELECT products + joins |
| Edit Product | updateProduct(uuid, data) | UPDATE products |
| Stock History | getStockMovements(productId, ...) | SELECT stock_movements |
| Adjust Price | updateProduct(uuid, { cost_price, retail_price }) | UPDATE products |
| Adjust Stock | updateProduct + createStockMovement | UPDATE products; INSERT stock_movements |
| Delete | deleteProduct(uuid) | UPDATE products SET is_active = false |

---

## Implementation Done (Summary)

| Change | File(s) |
|--------|---------|
| **Edit Product – real UPDATE** | `EnhancedProductForm.tsx`: onSubmit checks `initialProduct?.uuid ?? initialProduct?.id`; if present calls `productService.updateProduct(productId, productData)` instead of createProduct. |
| **Edit pre-fill from list product** | `EnhancedProductForm.tsx`: Pre-fill uses purchasePrice/sellingPrice/stock/lowStockThreshold/category when API names (cost_price, retail_price, etc.) missing so list-row product works. |
| **Edit header** | `EnhancedProductForm.tsx`: Title shows "Edit Product" when initialProduct passed, "Add New Product" otherwise. |

---

## Final Acceptance Criteria

- ✅ Product 3-dots ke har option ka backend se real connection (View, Edit, Stock History, Adjust Price, Adjust Stock, Delete).
- ✅ UI aur DB mein koi mismatch na ho – list/details/actions sab backend-driven.
- ✅ Dummy/fake logic removed – Edit ab duplicate create nahi karta, sirf UPDATE.
- ✅ Product module Sale module ke level ka solid – single source of truth, DB consistency, documented.

---

**Conclusion:** Products module ab fully backend-linked hai. Edit Product fix ensure karta hai ke Save par real UPDATE query chalti hai; baaki actions pehle se hi API/DB use kar rahe thay. Documentation is file mein complete hai.
