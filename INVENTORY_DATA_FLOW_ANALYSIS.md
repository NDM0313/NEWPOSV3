# 📊 INVENTORY DATA FLOW ANALYSIS

**Date:** January 30, 2026  
**Issue:** Stock movements created but not showing on Inventory page

---

## 🔍 DATA SOURCE ANALYSIS

### 1. **Inventory Overview Tab (Stock List)**
**Component:** `InventoryDashboardNew.tsx`  
**Data Source:** `inventoryService.getInventoryOverview()`

**Flow:**
1. Calls `inventoryService.getInventoryOverview(companyId, branchId)`
2. Service queries:
   - `products` table (all active products)
   - `stock_movements` table (SUM of quantities by product_id + variation_id)
3. Calculates stock: `SUM(quantity) FROM stock_movements WHERE product_id = X`
4. Returns `InventoryOverviewRow[]` with calculated stock

**Key Code:**
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

---

### 2. **Inventory Analytics Tab (Stock Movements)**
**Component:** `InventoryDashboardNew.tsx`  
**Data Source:** `inventoryService.getInventoryMovements()`

**Flow:**
1. Calls `inventoryService.getInventoryMovements(filters)`
2. Service queries `stock_movements` table with filters:
   - `movement_type` (purchase/sale/adjustment)
   - `product_id`
   - `branch_id`
   - Date range
3. Returns `InventoryMovementRow[]` with all movement details

**Key Code:**
```typescript
// InventoryDashboardNew.tsx - Line 69-88
const loadMovements = useCallback(async () => {
  const list = await inventoryService.getInventoryMovements({
    companyId,
    branchId: branchId === 'all' ? undefined : branchId || undefined,
    productId: filters.productId || undefined,
    movementType: filters.movementType || undefined,
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
  });
  setMovements(list);
}, [companyId, branchId, filters]);
```

---

## 🔄 STOCK MOVEMENT CREATION

### **Purchase Flow:**
**File:** `src/app/context/PurchaseContext.tsx`

**When:** Purchase saved with status = 'received' or 'final'

**Code:**
```typescript
// PurchaseContext.tsx - Line 517-530
const movement = await productService.createStockMovement({
  company_id: companyId,
  branch_id: purchaseBranchId === 'all' ? undefined : purchaseBranchId,
  product_id: item.productId,
  variation_id: item.variationId || undefined,
  movement_type: 'purchase',
  quantity: qtyToAdd, // ✅ POSITIVE for stock IN
  reference_type: 'purchase',
  reference_id: newPurchase.id,
  // ...
});
```

**Event Dispatch:**
```typescript
// PurchaseContext.tsx - Line ~860 (after purchase saved)
window.dispatchEvent(new CustomEvent('purchaseSaved', { 
  detail: { purchaseId: newPurchase.id } 
}));
```

---

### **Sale Flow:**
**File:** `src/app/context/SalesContext.tsx`

**When:** Sale saved with status = 'final' and type = 'invoice'

**Code:**
```typescript
// SalesContext.tsx - Line 594-607
const movement = await productService.createStockMovement({
  company_id: companyId,
  branch_id: effectiveBranchId === 'all' ? undefined : effectiveBranchId,
  product_id: item.productId,
  variation_id: item.variationId || undefined,
  movement_type: 'sale',
  quantity: -item.quantity, // ✅ NEGATIVE for stock OUT
  reference_type: 'sale',
  reference_id: newSale.id,
  // ...
});
```

**Event Dispatch:**
```typescript
// SalesContext.tsx - Line 864
window.dispatchEvent(new CustomEvent('saleSaved', { 
  detail: { saleId: newSale.id } 
}));
```

---

## 🐛 IDENTIFIED ISSUES

### **Issue #1: Event Listeners Dependency**
**File:** `InventoryDashboardNew.tsx` - Line 91-127

**Problem:**
```typescript
useEffect(() => {
  const handlePurchaseSaved = () => {
    loadOverview();
    if (activeTab === 'analytics') loadMovements();
  };
  // ...
}, [loadOverview, loadMovements, activeTab]); // ⚠️ Dependencies might cause issues
```

**Issue:** `loadOverview` and `loadMovements` are in dependencies, which might cause the effect to re-run unnecessarily or miss events.

---

### **Issue #2: Branch Filtering in getInventoryOverview**
**File:** `inventoryService.ts` - Line 109-115

**Current Code:**
```typescript
if (branchId && branchId !== 'all') {
  stockQuery = stockQuery.eq('branch_id', branchId);
}
// If branchId is 'all' or null, don't filter by branch_id - include all movements
```

**Potential Issue:** If `branchId` is passed as `null` but movements have a specific `branch_id`, they might not be included correctly.

---

### **Issue #3: Event Not Firing After Stock Movement Creation**
**Check:** Verify that `purchaseSaved` and `saleSaved` events are dispatched AFTER stock movements are created.

**Current Flow:**
1. Purchase/Sale saved
2. Stock movements created
3. Event dispatched

**Potential Issue:** If stock movement creation fails silently, event still fires but inventory doesn't update.

---

## ✅ VERIFICATION QUERIES

### **Check Stock Movements Exist:**
```sql
SELECT 
  sm.id,
  sm.product_id,
  sm.movement_type,
  sm.quantity,
  sm.reference_type,
  sm.reference_id,
  sm.branch_id,
  sm.created_at,
  p.name as product_name
FROM stock_movements sm
LEFT JOIN products p ON p.id = sm.product_id
ORDER BY sm.created_at DESC
LIMIT 20;
```

**Result:** ✅ Stock movements exist in database (verified)

---

### **Check Stock Calculation:**
```sql
-- Calculate stock for a specific product
SELECT 
  p.id,
  p.name,
  p.sku,
  COALESCE(SUM(sm.quantity), 0) as calculated_stock
FROM products p
LEFT JOIN stock_movements sm ON sm.product_id = p.id
WHERE p.id = 'PRODUCT_UUID_HERE'
GROUP BY p.id, p.name, p.sku;
```

---

## 🔧 REQUIRED FIXES

### **Fix #1: Improve Event Listener Stability**
- Remove `loadOverview` and `loadMovements` from dependencies
- Use refs or direct function calls

### **Fix #2: Ensure Events Fire After Stock Movements**
- Verify event dispatch happens AFTER stock movement creation
- Add error handling if stock movement fails

### **Fix #3: Fix Branch Filtering**
- Ensure `branchId === 'all'` correctly includes all branches
- Test with specific branch vs 'all' branches

---

**Next Steps:**
1. Fix event listener dependencies
2. Add explicit refresh after purchase/sale
3. Test branch filtering logic
4. Add console logs for debugging
