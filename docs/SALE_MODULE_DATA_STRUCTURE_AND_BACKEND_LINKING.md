# Sale Module – Data Structure & Backend Linking (Analysis)

**Roman Urdu:** Sale component ka flow, data structure, aur backend linking ka clear document. Pehle samjho, phir implement karo.

---

## 1. Sale Data Structure (Internal)

### 1.1 Ek Sale Kya Hai?

- **Sale** = Ek invoice/quotation jisme **customer**, **date**, **branch**, **totals**, aur **items** hote hain.
- **Ek sale ke andar multiple items** ho sakte hain.
- **Har item** = Product + (optional) Variation + (optional) Packing + Quantity + Rate + Total.

### 1.2 Backend Tables (Supabase)

| Table | Role |
|-------|------|
| `sales` | Sale header: invoice_no, invoice_date, customer_id, customer_name, branch_id, subtotal, discount, tax, expenses, total, paid_amount, due_amount, payment_status, shipping_status, etc. |
| `sales_items` (ya `sale_items`) | Line items: **sale_id**, **product_id**, **variation_id** (optional), product_name, sku, **quantity**, **unit** (e.g. piece, box, meters), unit_price, discount_*, tax_*, total, **packing_type**, **packing_quantity**, **packing_unit**, **packing_details** (JSONB) |
| `product_variations` | Variation master: product_id, sku, **attributes** (JSONB, e.g. { size, color }), price, stock |
| `products` | Product master: name, sku, category_id, prices, has_variations, etc. |

### 1.3 Sale Item – Required Backend Linkage

Har sold item ke liye backend mein ye **zaroor** store hona chahiye:

| Field | Purpose | Reporting / Ledger / Stock / Audit |
|-------|---------|-----------------------------------|
| **Item ID** (sales_items.id) | Unique line | Ledger line, audit |
| **Product ID** (product_id) | Konsi cheez bechi | Stock, reports, ledger |
| **Variation ID** (variation_id) | Size/color type (agar hai) | Stock by variation, reports |
| **Unit** (unit) | piece, box, carton, meters, etc. | Ledger display, reports |
| **Quantity** (quantity) | Kitni quantity | Stock deduction, totals, ledger |
| **Rate** (unit_price) | Rate per unit | Total, ledger |
| **Total** (total) | Line total | Invoice total, ledger |
| **Packing** (packing_type, packing_quantity, packing_unit, packing_details) | Optional fabric/wholesale packing | Display, reports |

---

## 2. Current Flow (Summary)

1. **SalesPage** → List of sales from **SalesContext** (data from `saleService.getAllSales` → Supabase).
2. **Add/Edit Sale** → **SaleForm** opens (drawer).
3. **SaleForm** loads:
   - **Customers** → `contactService.getAllContacts` (backend).
   - **Products** → `productService.getAllProducts` (backend) with `variations: product_variations(*)`.
   - **Branches** → `branchService.getAllBranches` (backend).
4. User selects **product** from list (backend products).
5. **Variation** (size/color):
   - **Problem:** UI options come from **mock** `productVariations: Record<number, Array<{ size, color }>>` in SaleForm (only product ids 3 and 4, numeric). Backend product ids are **UUID (string)** → mock match nahi hota.
   - **Submit time:** variationId is resolved from **backend** `product.variations` by matching size/color to `v.attributes.size` / `v.attributes.color`. So saved variation_id is real, but **displayed options are dummy**.
6. **Packing** (box, piece, meters):
   - **PackingEntryModal** – fixed UI (boxes, pieces, meters). Koi product-specific packing list backend se nahi aati (e.g. `product_packings` table use nahi ho raha).
   - User-entered values save hoti hain: `packing_details`, `packing_quantity`, `packing_unit` in sales_items. So **packing values real hain**, structure UI-defined.
7. **Quantity / Rate / Total** – User input; save in sales_items. **Real.**
8. **Submit** → SalesContext.createSale → saleService.createSale(sale, items) → Supabase `sales` + `sales_items` insert. Items mein product_id, variation_id, unit, quantity, unit_price, total, packing_* jaate hain. **Backend linkage theek hai**, sirf variation **options** dummy hain.

---

## 3. Dummy vs Real Data (Current State)

| Data | Source | Status |
|------|--------|--------|
| **Products list** | productService.getAllProducts | ✅ Real (backend) |
| **Product variations (list of options in UI)** | Mock `productVariations` in SaleForm (ids 3, 4 only) | ❌ **Dummy** – should be `product.variations` from API |
| **Variation ID saved** | Resolved from product.variations at submit by size/color | ✅ Real (backend) |
| **Quantity** | User input → sales_items.quantity | ✅ Real |
| **Rate / Total** | User input → sales_items.unit_price, total | ✅ Real |
| **Unit** | (item as any).unit \|\| 'piece' → sales_items.unit | ✅ Real (default piece) |
| **Packing (values)** | User input in PackingEntryModal → packing_details, packing_quantity, packing_unit | ✅ Real (saved to backend) |
| **Packing (options/types)** | No backend list; modal is generic (box/piece/meters) | ⚠️ UI-defined, no product_packings used |

---

## 4. What Must Change (Requirements)

1. **Variation options** – **Dummy remove.** Sale form mein variation list **product.variations** se aani chahiye (id, attributes.size, attributes.color ya jo bhi attributes hain). Key product **id (string)** se, number nahi.
2. **Quantity / Rate / Total / Unit / Packing** – Already backend-linked; ensure **no hardcoded defaults** where actual saved value should show (e.g. edit mode mein item.unit, item.packingDetails backend se aaye).
3. **SaleItem type (Context)** – Optional fields add karein: unit, packingDetails (ya packing_*) taaki ledger/reports same structure use karein.
4. **Ledger / Reports** – Use actual columns from sales_items: product_id, variation_id, unit, quantity, unit_price, total, packing_* so that **sab real data** reflect ho.

---

## 5. Backend Linking Checklist (Final)

- [x] **Item ID** – sales_items.id (backend generated).
- [x] **Product ID** – sales_items.product_id (from selection).
- [x] **Variation ID** – sales_items.variation_id (resolved from product.variations; UI options must come from same source, not mock).
- [x] **Unit** – sales_items.unit (user/context; default piece).
- [x] **Quantity** – sales_items.quantity.
- [x] **Rate / Total** – sales_items.unit_price, total.
- [x] **Packing** – sales_items.packing_type, packing_quantity, packing_unit, packing_details.
- [ ] **Variation options in UI** – Replace mock with product.variations (backend).

---

## 6. Files Touched (Implementation)

| File | Change |
|------|--------|
| `SaleForm.tsx` | Remove mock `productVariations`. Build variation options per product from `product.variations` (from loaded products). Use product.id (string) as key. |
| `SaleItemsSection.tsx` | Accept `productVariations` keyed by product id (string); display from backend variations. |
| `SalesContext.tsx` | SaleItem type: optional unit, packingDetails/packing_* for consistency with backend. convertFromSupabaseSale: already maps packing_details, size, color from item. |
| `saleService.ts` | Already sends variation_id, unit, packing_* in insert. No change needed for linkage. |
| Ledger / Reports | Use sales_items columns (product_id, variation_id, unit, quantity, unit_price, total, packing_*) – verify existing code uses these. |

---

**Conclusion:** Sale data structure backend se aligned hai; **sirf variation options** UI mein dummy thay. Unhe product.variations se replace kar diya gaya hai taaki jo options dikhte hain wahi backend se hon, aur reporting/ledger/stock/audit sab real data pe based hon.

---

## 7. Implementation Done (Summary)

| Change | File(s) |
|--------|--------|
| **Mock variations removed** | SaleForm.tsx – removed hardcoded `productVariations` for product ids 3 and 4. |
| **Variation options from backend** | SaleForm.tsx – `productVariationsFromBackend` useMemo builds options from `products[].variations` (productService). Products load with `variations: product_variations(*)`. |
| **variationId on item** | SaleForm.tsx SaleItem – added `variationId`. handleInlineVariationSelect sets `variationId: variation.id` when user selects from backend list. Submit uses `item.variationId` first, else fallback size/color lookup. |
| **SaleItemsSection** | productVariations type `Record<string, Array<{ id, size, color }>>`; key `String(item.productId)` so UUID products work. handleInlineVariationSelect(itemId, variation) passes full variation including `id`. |
| **SalesContext SaleItem** | Added optional `unit`, `packingDetails`. convertFromSupabaseSale maps `item.unit`, `item.packing_details` from backend. |
| **Ledger** | CustomerLedgerPage / ItemPurchaseTable already use `sale_items` columns: unit, unit_price, quantity, total. No change needed. |

**Dummy data ab nahi:** Variation list ab backend `product.variations` se aati hai. Quantity, rate, total, unit, packing values pehle se backend se linked hain.

---

## 8. Sale vs Ledger 1:1 Match (Ledger Product Breakdown Fix)

**Requirement:** Sale invoice aur Ledger report 100% match; packing, unit, variation clearly visible; no merged/ambiguous values.

### 8.1 Ledger reads from sale_items only

- **CustomerLedgerPage** (View tab): Fetches sale items from **sales_items** (then fallback **sale_items**) with full columns: product_id, variation_id, product_name, sku, quantity, unit, unit_price, discount_amount, tax_amount, total, packing_type, packing_quantity, packing_unit, packing_details. Join **product_variations(id, attributes)** for variation display. No derived/assumed calculation.
- **ItemPurchaseTable**: Same select; same structure. Used where sale items are listed in ledger context.

### 8.2 Product Breakdown columns (separate, no merge)

| Column | Source | Note |
|--------|--------|------|
| # | index | |
| Product Name | sale_items.product_name | |
| **Variation** | product_variations.attributes (size, color) | Separate column; "—" if none |
| **Packing** | packing_type + packing_quantity + packing_unit | Separate column; "—" if none |
| **Qty** | sale_items.quantity | Numeric only, no unit merged |
| **Unit** | sale_items.unit | Separate column (piece, meters, box, etc.) |
| Unit Price | sale_items.unit_price | |
| Discount | sale_items.discount_amount | |
| Tax | sale_items.tax_amount | |
| Price inc. tax | unit_price + tax_amount | |
| Subtotal | sale_items.total | |

**No merged "25 M&Y" or "80.1 piece" in one cell** – Quantity numeric, Unit separate, Packing separate.

### 8.3 Sale form → backend unit when packing used

- **SalesContext** createSale: When item has packingDetails, **unit** is set from packingDetails.unit or default 'meters'; otherwise (item as any).unit or 'piece'. So ledger **Unit** column matches what was sold (piece vs meters/box when packing used).
