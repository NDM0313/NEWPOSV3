# Purchase Module – Frontend Analysis & Alignment with Sale Module

**Reference:** Sale module (SaleForm, SalesPage) as the standard.  
**Goal:** Purchase header, pricing, items, and backend linking match Sale maturity; same ERP family visually and behaviorally.

---

## STEP 1 – Purchase Header vs Sale Header (Layout, Fields, Styling)

### Sale Header (Reference)

- **Top bar:** Close, title "New Sale" / "Edit Sale", Branch selector (right).
- **Form header row (single row, grid):**
  - **Customer** – SearchableSelect (orange accent label), Due balance right-aligned.
  - **Date** – CalendarDatePicker, soft input (gray-900/50, border-gray-800).
  - **Ref #** – Input, placeholder "REF", same soft style.
  - **Type** – Chip (Regular / Studio), Popover.
  - **Shipping** – Toggle (only for regular).
- **Optional row:** Studio details (deadline, notes) when Type = Studio.
- **Sale-only (do NOT replicate in Purchase):** Type (Regular/Studio), Shipping, Salesman (in summary), Commission.

**Typography & colors (Sale):**

- Background: `#0B1019` (top), `#0F1419` (form header).
- Labels: `text-xs text-gray-500`, uppercase tracking.
- Accent labels: e.g. Customer `text-orange-400` (Sale); Supplier in Purchase can use same orange.
- Inputs: `bg-gray-900/50 border-gray-800`, `h-[28px]` or `h-10`, `text-xs` / `text-sm`.
- Border: `border-gray-800`, `rounded-lg`.

### Purchase Header (Current)

- **Top bar:** Close, "New Purchase Order", "Standard Entry", BranchSelector (right). ✅ Matches intent.
- **Form header row:** Supplier, Date, Ref#, Invoice#, Status. ✅ Same grid idea.
- **Missing vs Sale:** Invoice# in Sale is not in the same visible row in the snippet we have; Purchase has Invoice# (read-only). So Purchase has one more field (Status) and same Ref#/Invoice# idea.
- **Difference:** Sale uses "Ref #" and has Type + Shipping; Purchase uses "Ref#", "Invoice#", "Status". So Purchase should keep: Supplier, Date, Ref#, Invoice#, Status, Branch.

### Required Purchase Header (Exact layout to match Sale)

| Field     | Widget           | Label style      | Notes |
|----------|------------------|------------------|--------|
| Supplier | SearchableSelect | Orange accent    | Like Customer in Sale |
| Date     | CalendarDatePicker | Gray label     | Same as Sale |
| Ref#     | Input            | Gray label       | Same as Sale Ref # |
| Invoice# | Input (read-only) | Cyan accent    | Same as Sale if present |
| Status   | Select           | Cyan accent      | Draft / Ordered / Received / Final |
| Branch   | In header top bar | Right            | Already BranchSelector ✅ |

**Layout:** One row, same grid (`grid-cols-1 md:grid-cols-5` or 6), same spacing (`gap-2.5`, `p-3`), same wrapper (`bg-gray-900/30 border border-gray-800/50 rounded-lg`). No Salesman, no Type (Regular/Studio), no Shipping.

**Spacing & typography:** Match Sale exactly: label `text-[10px]` or `text-xs`, `uppercase`, `tracking-wide`, `mb-1.5`; inputs `h-10` or `h-[28px]`, `text-sm`; container `px-6 py-2.5` / `py-4` for the form header row.

---

## STEP 2 – Product Default Price (Backend-Driven)

### Sale (Reference)

- Products loaded with: `price: p.salePrice || p.price || 0`.
- Backend (productService / DB): `retail_price` (snake_case). So map: `price: p.retail_price ?? p.salePrice ?? p.price ?? 0`.
- On product select, item gets `product.price` → selling price; user can edit.

### Purchase (Required)

- Products loaded with: `price: p.cost_price ?? p.costPrice ?? p.price ?? 0` (backend: `cost_price`).
- On product select, item gets `product.price` → purchase/cost price; user can edit.
- No hardcoded or zero default when DB has a value; no dummy values.

**Consistency:** Same pattern in both modules: one “price” per context (selling vs cost), backend-driven, editable.

---

## STEP 3 – Items Entry (Packing, Qty, Unit)

### Sale (Reference)

- Packing: Box / Pieces / Measurement in structured form (PackingDetails: total_boxes, total_pieces, total_meters).
- Quantity: number only.
- Unit: separate column/field.
- Packing, Qty, Unit never merged into one string; variation in separate column.

### Purchase (Required)

- Same structure: Packing (boxes, pieces, meters) structured; Quantity numeric; Unit separate.
- PurchaseItem to include: `packing_quantity`, `packing_unit`, `packingDetails`, `variationId` where applicable.
- Save to backend: packing as structured JSON (e.g. boxes, pieces, meters); no single merged string.

---

## STEP 4 – Backend & Database Linking

### Purchase flow

- **Product select** → products table (already via productService).
- **Default purchase price** → products.cost_price (via STEP 2).
- **Save Purchase** →
  - Header → purchase_orders (supplier, date, ref, invoice#, status, branch).
  - Lines → purchase_items (product_id, quantity, price, packing as JSON).
  - Packing → structured (e.g. total_boxes, total_pieces, total_meters).
- **Stock:** On save, stock increases (inverse of sale); same pattern as Sale, direction opposite.

### Validation

- No dummy data; no frontend-only state as source of truth for persisted data.
- Single source of truth: database (purchase_orders, purchase_items, stock_movements).

---

## STEP 5 – UI Consistency (Fonts, Colors, Inputs, Spacing)

- **Font:** Same as Sale (e.g. system sans).
- **Colors:** Same grays (`#0B1019`, `#0F1419`, gray-900, gray-800), same accent for primary entity (Customer = orange, Supplier = orange), Status/Cyan where used.
- **Inputs:** Same height, border, radius, padding as Sale.
- **Buttons:** Same variants (outline, primary), same sizes.
- **Spacing:** Same padding/margins (`px-6`, `py-2.5`/`py-4`, `gap-2.5`/`gap-3`).

Result: “Yeh ek hi ERP system ka native module hai, koi alag page nahi.”

---

## STEP 6 – Validation & Acceptance

- Product select → purchase price auto (from cost_price), editable; save → correct price in DB, stock increases.
- Same product in Sale → selling price auto (from retail_price), editable.
- UI: Sale and Purchase look and feel like the same family.
- No “double-click to save” or “reload resets to zero” as acceptable behavior.

---

## Implementation Order

1. **Price mapping (STEP 2):** SaleForm + PurchaseForm use backend snake_case + camelCase fallback for price.
2. **Purchase header (STEP 1 + 5):** Align layout, labels, and styles with Sale (same wrapper, grid, label/input classes).
3. **Purchase items (STEP 3):** Ensure Packing/Qty/Unit and variation match Sale structure; backend packing JSON.
4. **Backend (STEP 4):** Verify createPurchase and stock update; fix if needed.
5. **Final pass (STEP 5 + 6):** Font/color/input/button/spacing consistency and acceptance checks.
