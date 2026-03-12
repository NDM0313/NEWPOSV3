# ERP Stock System Verification

Run this after applying the full stock diagnostic and mobile fixes.

## 1. Database schema diagnostic

In **Supabase SQL Editor**, run:

```bash
# From repo root, or paste contents of:
scripts/erp_stock_schema_diagnostic.sql
```

Or run the file:

```bash
psql "$DATABASE_URL" -f scripts/erp_stock_schema_diagnostic.sql
```

Check:

- `product_variations`: which column exists — `stock`, `stock_quantity`, or `current_stock`
- `products`: whether `current_stock` exists (mobile app no longer selects it)
- `purchase_status` enum values (e.g. `draft`, `ordered`, `received`, `final`)
- Trigger `purchase_final_stock_movement_trigger` exists on `purchases`

## 2. Variation stock display

1. Open mobile app → Purchase (or Sale) → Add Products.
2. Add a product that has **variations** (e.g. Size S/M/L).
3. In the variation selector, confirm **Stock: N** is shown (not “Stock: 0” when DB has stock).
4. If still 0, ensure DB has either:
   - `product_variations.stock`, or
   - `product_variations.stock_quantity`, or
   - Rows in `stock_movements` with `variation_id` set.

## 3. Purchase Mark as Final

1. Create a purchase (ordered) with at least one item.
2. Open the purchase detail.
3. Tap **Mark as Final**.
4. Expect: status updates to Final, no PATCH 400.
5. If 400: run `SELECT unnest(enum_range(NULL::purchase_status));` and ensure the app sends that exact value (e.g. `final`).

## 4. Stock movement after finalize

1. After marking a purchase as Final, check `stock_movements`:

```sql
SELECT * FROM stock_movements
WHERE reference_type = 'purchase' AND reference_id = '<purchase_id>'
ORDER BY created_at DESC;
```

2. Expect one row per purchase line (product_id, variation_id, quantity).
3. Confirm inventory/balance updates if your app uses it.

## 5. Console errors

- No **column "current_stock" does not exist** (products and product_variations no longer select it).
- No PATCH 400 on Mark as Final when enum matches.

## 6. Mobile bottom action bar

- **Add Purchase** → Items step: bottom bar shows Subtotal + “Next: Summary →”.
- **Add Purchase** → Summary: bottom bar shows “Proceed to Payment →”.
- **Purchase detail**: when status is ordered/draft, bottom bar shows Total + “Mark as Final”.
- **Add Sale** → Add Items: when cart has items, bottom bar shows Subtotal + “Continue to Summary →”.

All use the same `MobileActionBar` component (above bottom nav when visible).

## 7. Layout (Cart / Search / Grid)

- **Add Purchase** and **Add Sale** product steps: **CART** at top, then **Search**, then **Product grid**.
- New items appear in the cart at the top without needing to scroll to the bottom.
