# 🔧 PURCHASE EDIT & STOCK MOVEMENT FIX

**Date:** January 30, 2026  
**Status:** ✅ **FIXES APPLIED**

---

## 🔍 ISSUES IDENTIFIED

### **Issue #1: Recent Purchases Not Creating Stock Movements**
**Problem:**
- All recent purchases (PUR0016, PUR0015, PUR0014, etc.) have `status: 'final'` but NO stock movements
- Old purchases (PUR-0001, PUR-0002, etc.) have stock movements correctly
- Inventory Overview not updating after new purchases

**Root Cause:**
- `newPurchase.items` was empty after `convertFromSupabasePurchase(result)`
- Stock movement creation logic checks `newPurchase.items && newPurchase.items.length > 0`
- Since items were empty, stock movements were never created

**Fix Applied:**
- Added logic to preserve `purchaseData.items` in `newPurchase` before stock movement creation
- Added debug logging to track items availability

---

### **Issue #2: Purchase Edit - New Items Not Saved**
**Problem:**
- When editing purchase and adding new items, notification shows "saved"
- But new items are NOT saved to `purchase_items` table
- Only basic purchase fields (status, total, paid) were being updated

**Root Cause:**
- `updatePurchase` in `PurchaseContext.tsx` only updates purchase fields
- No logic to update `purchase_items` table
- No logic to update stock movements when items change

**Fix Applied:**
- Added complete `purchase_items` update logic in edit mode:
  1. Delete existing items
  2. Insert new items
  3. Delete old stock movements
  4. Create new stock movements for updated items

---

## 🔧 FIXES APPLIED

### **Fix #1: Preserve Items in createPurchase**
**File:** `src/app/context/PurchaseContext.tsx`

**Added:**
```typescript
// 🔒 CRITICAL FIX: Ensure items are populated from purchaseData
if (!newPurchase.items || newPurchase.items.length === 0) {
  newPurchase.items = purchaseData.items.map((item: any) => ({
    // Map items from purchaseData
  }));
}
```

**Result:**
- Items are now available for stock movement creation
- Stock movements will be created correctly for new purchases

---

### **Fix #2: Enhanced Debug Logging**
**File:** `src/app/context/PurchaseContext.tsx`

**Added:**
```typescript
console.log('[PURCHASE CONTEXT] 🔍 Stock movement check:', {
  status: newPurchase.status,
  hasItems: !!newPurchase.items,
  itemsCount: newPurchase.items?.length || 0,
  items: newPurchase.items
});
```

**Result:**
- Better visibility into why stock movements might not be created
- Easier debugging

---

### **Fix #3: Complete Purchase Edit with Items Update**
**File:** `src/app/components/purchases/PurchaseForm.tsx`

**Added:**
1. **Delete existing items:**
   ```typescript
   await supabase
     .from('purchase_items')
     .delete()
     .eq('purchase_id', purchaseId);
   ```

2. **Insert new items:**
   ```typescript
   await supabase
     .from('purchase_items')
     .insert(itemsWithPurchaseId);
   ```

3. **Update stock movements:**
   - Delete old stock movements
   - Create new stock movements for updated items

**Result:**
- New items added during edit are now saved correctly
- Stock movements are updated when items change
- Inventory reflects changes immediately

---

### **Fix #4: Enhanced Event Dispatch**
**File:** `src/app/components/purchases/PurchaseForm.tsx`

**Changed:**
```typescript
// Before
window.dispatchEvent(new CustomEvent('purchaseSaved'));

// After
window.dispatchEvent(new CustomEvent('purchaseSaved', { 
  detail: { purchaseId: isEditMode ? purchaseId : newPurchase?.id } 
}));
```

**Result:**
- Inventory page can refresh specific purchase data
- Better event handling

---

## ✅ VERIFICATION

### **Test Case 1: New Purchase**
1. Create new purchase with status 'final'
2. Add items
3. Save
4. **Expected:** Stock movements created ✅
5. **Expected:** Inventory Overview updates ✅

### **Test Case 2: Edit Purchase - Add Items**
1. Open existing purchase for edit
2. Add new items
3. Save
4. **Expected:** New items saved to `purchase_items` ✅
5. **Expected:** Stock movements updated ✅
6. **Expected:** Inventory Overview updates ✅

---

## 📋 FILES MODIFIED

1. ✅ `src/app/context/PurchaseContext.tsx`
   - Preserve items in `newPurchase` before stock movement creation
   - Enhanced debug logging

2. ✅ `src/app/components/purchases/PurchaseForm.tsx`
   - Complete purchase edit with items update
   - Stock movement update on edit
   - Enhanced event dispatch

---

**Status:** ✅ **FIXES COMPLETE**
