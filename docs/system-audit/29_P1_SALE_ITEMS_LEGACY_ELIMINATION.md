# 29. P1-2: Sale Items Legacy Table Elimination

**Date:** 2026-04-12  
**Status:** PATCHED  
**Priority:** P1  
**Bug class:** Legacy table receiving new writes

---

## 1. Problem Statement

Two tables hold sale line items:
- `sales_items` (canonical — plural) — all new sales write here
- `sale_items` (legacy — singular) — old records; must receive no new writes

Before P1-2, three code locations wrote to `sale_items`:

| File | Lines | Context |
|------|-------|---------|
| `src/app/services/studioProductionService.ts` | 703–713 | Fallback when `sales_items` insert fails (`is_studio_product` column missing) |
| `src/app/components/admin/AccountingIntegrityLabPage.tsx` | 931–933 | Debug tool fallback read+write |
| `src/app/components/admin/AccountingIntegrityLabPage.tsx` | 1133–1143 | Debug tool fallback read+write (second action) |

---

## 2. Root Cause

The primary `sales_items` insert in `studioProductionService.ts` includes `is_studio_product: true`. If `sales_items` lacks this column (schema mismatch), the insert fails with error code `42703`. The fallback then redirected the write to `sale_items` — which has the `is_studio_product` column from an older migration.

---

## 3. Code Fixes

### Fix A — `studioProductionService.ts` (lines 693–724)

**Before:** On `sales_items` insert failure, fallback inserted into `sale_items` (legacy)  
**After:** On `sales_items` insert failure, retry into `sales_items` without `is_studio_product` (drops the offending column from the fallback payload, uses `unit_price` as the canonical column name)

The fallback payload is now:
```typescript
{ sale_id, product_id, product_name, sku, quantity: 1, unit_price: 0, total: 0 }
// inserted into 'sales_items' — never 'sale_items'
```

Log message updated: `'studio line added (sales_items fallback)'` to make monitoring clearer.

### Fix B — `AccountingIntegrityLabPage.tsx` (lines 928–935, admin debug tool)

**Before:** Read `sales_items` first; if empty, read+write `sale_items` as fallback  
**After:** Read `sales_items` only; update `sales_items` only. No fallback to `sale_items`.

```typescript
// P1-2: use sales_items (canonical) only — was: fallback to sale_items (legacy)
const { data: row } = await supabase.from('sales_items').select(...).maybeSingle();
if (row) await supabase.from('sales_items').update(...).eq('id', row.id);
```

### Fix C — `AccountingIntegrityLabPage.tsx` (lines 1125–1149, second action)

Same pattern as Fix B — removed the `sale_items` fallback read and write.

---

## 4. Remaining Read-Only Allowances

`studioProductionService.ts` line 380–383 still READs from `sale_items` as a fallback when `sales_items` has no records for older sales. This is a **read-only backward compat path** — acceptable until a data migration copies old `sale_items` records into `sales_items`.

---

## 5. Retirement Roadmap

1. **Now:** No new writes to `sale_items` (P1-2 complete)
2. **Q2 2026:** Run migration: `INSERT INTO sales_items SELECT ... FROM sale_items ON CONFLICT DO NOTHING`
3. **Q2 2026:** Remove `sale_items` fallback reads from `studioProductionService.ts`
4. **Q4 2026:** Drop `sale_items` table

---

## 6. Verification

```sql
-- After P1-2: no new writes to sale_items
SELECT COUNT(*), MAX(created_at) FROM sale_items WHERE created_at > '2026-04-12';
-- Expected: 0 new rows after patch date
```
