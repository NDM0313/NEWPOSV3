# DIN CHINA — Imported Sale Edit + Variation Fix (Home Handoff)

**Date:** 2026-07-08  
**Company:** DIN CHINA — `30bd8592-3384-4f34-899a-f3907e336485`  
**Example sale:** Invoice **DC-0018** (legacy txn 22), line **VELVET SETECHABLE**, qty was under-imported and needs correction.

---

## 1. Problems fixed

| # | Symptom | Root cause |
|---|---------|------------|
| A | `Failed to save sale: invalid input syntax for type uuid: "[object Object]"` on Update | Raw `getSaleById()` rows passed to `SaleForm` with `customer` as contacts **object**; `customerId.toString()` became `"[object Object]"` on PATCH `sales.customer_id` |
| B | Every imported line shows Variation (`_erp_purchase_price: 0`) | Legacy import set `has_variations: true` on **all** products; sentinel `variation_id == product_id` rows treated as real variations |

**Legacy truth (CSV):** Only **TR** (product 3 → variations 3,15,16) and **WOOL** (product 13 → 20,21) are real multi-variation products. **VELVET** (14) uses sentinel `14/14`.

---

## 2. Code changes (in repo)

| File | Change |
|------|--------|
| [`src/app/utils/uuidCoerce.ts`](../src/app/utils/uuidCoerce.ts) | `coerceUuidOrNull()` — never sends `[object Object]` to Postgres |
| [`src/app/utils/saleLineVariation.ts`](../src/app/utils/saleLineVariation.ts) | `shouldShowSaleLineVariations`, `formatSaleLineVariationText`, `normalizeVariationIdForPersist` |
| [`src/app/context/SalesContext.tsx`](../src/app/context/SalesContext.tsx) | UUID coercion on `customer_id`, `branch_id`, `salesman_id`, tailor charge UUIDs; variation persist helper |
| [`src/app/components/sales/SaleForm.tsx`](../src/app/components/sales/SaleForm.tsx) | Safe customer resolve; variation visibility after catalog load |
| [`src/app/components/sales/SaleItemsSection.tsx`](../src/app/components/sales/SaleItemsSection.tsx) | Public variation labels only (no `__erp_*` keys) |
| [`src/app/services/saleService.ts`](../src/app/services/saleService.ts) | Coerce `variation_id` / `product_id` on line insert |
| [`TransactionDetailModal.tsx`](../src/app/components/accounting/TransactionDetailModal.tsx), [`NotificationsDropdown.tsx`](../src/app/components/layout/NotificationsDropdown.tsx), [`openJournalSourceDocument.ts`](../src/app/lib/openJournalSourceDocument.ts) | `convertFromSupabaseSale(full)` before edit drawer |
| [`migration-tools/lib/dinChinaApply.js`](../migration-tools/lib/dinChinaApply.js) | `has_variations` only when legacy product has multiple / non-sentinel variation ids |
| [`scripts/sql/repair_din_china_fake_variations.sql`](../scripts/sql/repair_din_china_fake_variations.sql) | VPS data repair (verify + apply) |

**Unit tests:** [`src/app/utils/saleLineVariation.test.ts`](../src/app/utils/saleLineVariation.test.ts)

---

## 3. Reproduce (before deploy)

1. Sales → open **DC-0018** (or sale id from URL `?invoice=...`).
2. Edit **VELVET SETECHABLE** quantity (e.g. 1070.78).
3. Click **Update**.
4. **Before fix:** toast `invalid input syntax for type uuid: "[object Object]"`; Network → `PATCH .../rest/v1/sales` → 400.
5. **After fix:** save succeeds; stock delta applied for qty change only.

---

## 4. Diagnosis on VPS (read-only)

```bash
ssh dincouture-vps
cd /root/NEWPOSV3
```

```bash
# Sale header
docker exec -i supabase-db psql -U postgres -d postgres -c "
SELECT id, invoice_no, customer_id, branch_id, salesman_id, customer_name, total
FROM sales
WHERE company_id = '30bd8592-3384-4f34-899a-f3907e336485'
  AND (invoice_no ILIKE '%0018%' OR customer_bill_ref ILIKE '%0018%')
ORDER BY created_at DESC
LIMIT 5;
"

# Lines + variation attrs
docker exec -i supabase-db psql -U postgres -d postgres -c "
SELECT s.invoice_no, si.product_name, si.quantity, si.variation_id, pv.attributes
FROM sales_items si
JOIN sales s ON s.id = si.sale_id
LEFT JOIN product_variations pv ON pv.id = si.variation_id
WHERE s.company_id = '30bd8592-3384-4f34-899a-f3907e336485'
  AND s.invoice_no ILIKE '%0018%';
"
```

**Browser DevTools (if error returns):** In `SaleForm.proceedWithSave`, check `customerId`, `finalBranchId`, `salesmanId` — any `typeof === 'object'` was the bug.

---

## 5. Deploy web fix

```bash
ssh dincouture-vps
cd /root/NEWPOSV3
git pull
bash deploy/deploy.sh
```

Hard-refresh browser (Ctrl+Shift+R) after deploy.

---

## 6. Production data repair (variations)

**Script:** [`scripts/sql/repair_din_china_fake_variations.sql`](../scripts/sql/repair_din_china_fake_variations.sql)

### Step A — Backup

```bash
docker exec -i supabase-db psql -U postgres -d postgres -c "
CREATE TABLE IF NOT EXISTS _bak_products_dc_var_fix_20260708 AS
SELECT * FROM products WHERE company_id = '30bd8592-3384-4f34-899a-f3907e336485';
CREATE TABLE IF NOT EXISTS _bak_sales_items_dc_var_fix_20260708 AS
SELECT si.* FROM sales_items si
JOIN sales s ON s.id = si.sale_id
WHERE s.company_id = '30bd8592-3384-4f34-899a-f3907e336485';
"
```

### Step B — Verify (no writes)

```bash
docker exec -i supabase-db psql -U postgres -d postgres \
  < scripts/sql/repair_din_china_fake_variations.sql
```

Review output:
- Products with `has_variations=true` but `variation_count <= 1` → should flip to false
- Multi-variation products (TR, WOOL) → `variation_count > 1` → **unchanged**

### Step C — Apply

1. Open `scripts/sql/repair_din_china_fake_variations.sql`
2. Uncomment the `BEGIN; ... COMMIT;` APPLY block
3. Re-run on VPS:

```bash
docker exec -i supabase-db psql -U postgres -d postgres \
  < scripts/sql/repair_din_china_fake_variations.sql
```

**What APPLY does:**
- `products.has_variations = false` where only one variation row exists
- `sales_items.variation_id = NULL` (and `purchase_items`) for those simple products
- Keeps `product_variations` rows for stock/FK history

### Rollback (if needed)

```sql
UPDATE products p SET has_variations = b.has_variations
FROM _bak_products_dc_var_fix_20260708 b WHERE p.id = b.id;

UPDATE sales_items si SET variation_id = b.variation_id
FROM _bak_sales_items_dc_var_fix_20260708 b WHERE si.id = b.id;
```

---

## 7. Test matrix (after deploy + optional SQL)

| Test | Steps | Expected |
|------|-------|----------|
| DC-0018 qty edit | Open DC-0018 → change VELVET qty → Update | Save OK, no UUID error |
| VELVET variation UI | Same sale | Variation column `-` or empty; no `_erp_purchase_price` |
| TR sale | Open any sale with TR — SET WASIE | Variation selector/labels still work |
| WOOL sale | Open sale with WOOL — LAAT | Two variations (20/21) still selectable |
| Stock | After qty decrease on final sale | Stock restored by delta only (check stock movements) |
| GL | After qty-only edit | Original sale JE updated in-place (no duplicate SL) |
| Journal → Edit sale | Accounting → open sale from JE link | Edit drawer opens and saves (no raw customer object) |

---

## 8. Local dev verify

```bash
cd "NEW POSV3"
npm run test -- src/app/utils/saleLineVariation.test.ts
```

---

## 9. Notes

- **DC-0018 legacy row:** `legacy_din_china_sale_items.csv` line 41 — VELVET qty **428** @ 400; user correcting under-imported quantity.
- **Customer on 0018:** Legacy contact 57 (DIN COUTURE) — `customer_id` must remain a UUID string, never a JS object.
- **Do not** drop `product_variations` or change GL triggers in this fix.
- **Future re-import:** `dinChinaApply.js` now sets `has_variations` only for TR/WOOL-style products.

---

## 10. Quick checklist

- [x] `git pull` + deploy on VPS (2026-07-08 — `a6641f79`, deploy OK)
- [x] Hard refresh ERP in browser (after deploy)
- [x] SQL verify — 0 simple products left with `has_variations=true`; TR/WOOL multi-var OK
- [x] Backup tables `_bak_products_dc_var_fix_20260708`, `_bak_sales_items_dc_var_fix_20260708`
- [x] SQL apply — **not needed** (verify returned 0 rows to fix)
- [x] DC-0018 spot-check — sale `27439e2d-…`, VELVET qty `1070.78`, `variation_id` NULL, `has_variations` false
- [ ] Edit DC-0018 in UI once more → Update (confirm no UUID error in browser)
- [ ] Commit/push if working from office PC copy
