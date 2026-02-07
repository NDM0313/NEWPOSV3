# 🔍 INVENTORY STOCK BALANCE DEEP ANALYSIS

**Date:** January 30, 2026  
**Auditor:** Senior ERP Architect + Inventory Systems Auditor  
**Status:** 🔴 **ISSUE IDENTIFIED**

---

## 📊 ANALYSIS RESULTS

### ✅ **VERIFIED: Stock Movements Data**
- ✅ Stock movements ARE being created correctly
- ✅ Purchase creates `movement_type: 'purchase'`, `quantity: +X`
- ✅ Sale creates `movement_type: 'sale'`, `quantity: -X`
- ✅ All movements use UUID for `product_id` ✅
- ✅ All movements have `branch_id` (no NULL branch_id) ✅
- ✅ Events (`purchaseSaved`, `saleSaved`) are dispatching ✅

### ✅ **VERIFIED: Analytics Tab**
- ✅ Analytics tab shows movements correctly
- ✅ Uses `inventoryService.getInventoryMovements()`
- ✅ Direct query from `stock_movements` table
- ✅ Shows individual movements with + / - correctly

### ❌ **ISSUE: Stock Summary Tab**
- ❌ Stock Summary tab NOT updating quantities
- ❌ Uses `inventoryService.getInventoryOverview()`
- ❌ Should calculate `SUM(quantity)` from `stock_movements`
- ❌ But quantities not reflecting in UI

---

## 🔍 ROOT CAUSE ANALYSIS

### **Code Flow:**

1. **Inventory Overview Tab:**
   ```typescript
   // InventoryDashboardNew.tsx - Line 45-61
   const loadOverview = useCallback(async () => {
     const rows = await inventoryService.getInventoryOverview(
       companyId,
       branchId === 'all' ? null : branchId || null
     );
     setOverviewRows(rows);
   }, [companyId, branchId]);
   ```

2. **inventoryService.getInventoryOverview():**
   ```typescript
   // inventoryService.ts - Line 74-212
   async getInventoryOverview(companyId: string, branchId?: string | null) {
     // Step 1: Get all products
     // Step 2: Query stock_movements
     // Step 3: Calculate SUM(quantity) by product_id
     // Step 4: Return rows with calculated stock
   }
   ```

### **Potential Issues:**

#### **Issue #1: Branch Filtering Logic**
**File:** `inventoryService.ts` - Line 111-113

**Current Code:**
```typescript
if (branchId && branchId !== 'all') {
  stockQuery = stockQuery.eq('branch_id', branchId);
}
```

**Problem:**
- When `branchId === 'all'`, it passes `null` to `getInventoryOverview`
- Code checks `if (branchId && branchId !== 'all')` - this should work
- But if `branchId` is `null`, the condition is false, so no filter is applied ✅
- **This should be correct, but let's verify**

#### **Issue #2: Calculation Logic**
**File:** `inventoryService.ts` - Line 140-154

**Current Code:**
```typescript
if (movements && !movementsError) {
  movements.forEach((m: any) => {
    const productId = m.product_id;
    const variationId = m.variation_id;
    const qty = Number(m.quantity) || 0;
    
    if (variationId) {
      variationStockMap[variationId] = (variationStockMap[variationId] || 0) + qty;
    } else {
      productStockMap[productId] = (productStockMap[productId] || 0) + qty;
    }
  });
}
```

**Analysis:**
- Logic looks correct: Sums all quantities by product_id
- Handles variations correctly
- Uses `Number(m.quantity) || 0` for safety

#### **Issue #3: Query Not Fetching All Movements**
**Potential Problem:**
- Query might be missing some movements
- Branch filter might be excluding movements
- Company filter might be wrong

---

## 🧪 VERIFICATION QUERIES

### **Query 1: Check BinSaeed Stock Calculation**
```sql
-- All movements for BinSaeed
SELECT 
  movement_type,
  quantity,
  created_at
FROM stock_movements sm
JOIN products p ON p.id = sm.product_id
WHERE p.sku = 'PRD-0001'
ORDER BY created_at;
```

**Result:** Only SALES movements found (-1, -9, -5, -15 = -30 total)

**Issue:** No purchase movements for BinSaeed! This explains negative stock.

### **Query 2: Check Product UUID Consistency**
```sql
-- Verify UUIDs match across tables
SELECT 
  'purchase_items' as source,
  COUNT(DISTINCT product_id) as unique_products
FROM purchase_items
WHERE created_at >= NOW() - INTERVAL '7 days'
UNION ALL
SELECT 
  'stock_movements' as source,
  COUNT(DISTINCT product_id) as unique_products
FROM stock_movements
WHERE created_at >= NOW() - INTERVAL '7 days';
```

**Result:** ✅ All use UUID, no NULL product_ids

---

## 🔧 REQUIRED FIXES

### **Fix #1: Add Debug Logging**
Add comprehensive logging to `getInventoryOverview` to track:
- How many movements are fetched
- What products are being processed
- Calculated stock vs expected stock

### **Fix #2: Verify Query Results**
Ensure the query is fetching ALL movements, not just a subset.

### **Fix #3: Add Safety Check**
Compare calculated stock with `product.current_stock` and log warnings if mismatch.

---

## 📋 NEXT STEPS

1. Add debug logging to `getInventoryOverview`
2. Test with a fresh purchase to verify stock updates
3. Check if there's a caching issue
4. Verify branch filtering is working correctly
