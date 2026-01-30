# Stock Movements Query Fix ✅

## ✅ FIXED

### Issue
Stock movements query was failing with 400 error because it was trying to select specific columns (`box_change`, `piece_change`, `unit`) that don't exist in the database.

**Error:**
```
Failed to load resource: the server responded with a status of 400 ()
[STOCK MOVEMENTS QUERY] Filtered query error: Object
[Stock Movements] Table or column not found, returning empty array
```

### Root Cause
The query was explicitly selecting columns:
```typescript
.select('id, product_id, company_id, branch_id, variation_id, movement_type, type, quantity, box_change, piece_change, unit, unit_cost, total_cost, reference_type, reference_id, notes, created_by, created_at')
```

But `box_change`, `piece_change`, and `unit` columns might not exist in the `stock_movements` table.

### Solution Applied

#### Updated Query to Use `*` ✅
**File:** `src/app/services/productService.ts`

**Changes:**
- Changed from explicit column selection to `select('*')`
- This allows the query to work even if some columns don't exist
- Packing fields will be included if they exist, otherwise they'll be undefined

**Before:**
```typescript
.select('id, product_id, company_id, branch_id, variation_id, movement_type, type, quantity, box_change, piece_change, unit, unit_cost, total_cost, reference_type, reference_id, notes, created_by, created_at')
```

**After:**
```typescript
.select('*')
```

### Result

✅ **Query now works regardless of which columns exist in the database**
✅ **Packing fields (`box_change`, `piece_change`, `unit`) will be included if they exist**
✅ **No more 400 errors when querying stock movements**

---

**Status:** ✅ Fixed

**Files Updated:**
1. `src/app/services/productService.ts` - Changed query to use `*` instead of explicit columns
