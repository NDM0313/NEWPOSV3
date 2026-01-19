# 📦 SALES MODULE - SYSTEMATIC REBUILD PLAN

## 🎯 MODULE: SALES (Priority #3)

### PHASE 0: INVENTORY COMPLETE ✅

#### **Components Identified:**
1. **SalesPage.tsx** - Main list page ✅
2. **SaleForm.tsx** - Add/Edit form ✅
3. **ViewSaleDetailsDrawer.tsx** - View details ✅ (exists)
4. **UnifiedPaymentDialog** - Payment recording ✅
5. **UnifiedLedgerView** - Ledger view ✅
6. **Shipping Update Dialog** - Needs creation/verification
7. **Delete Confirmation Dialog** - Already exists but needs integration

#### **Actions Identified (Three-Dots Menu):**
1. ✅ View Details → `handleSaleAction('view_details')` - **WORKING** ✅
2. ⚠️ Edit Sale → `handleSaleAction('edit')` - **PARTIALLY WORKING** (opens drawer but doesn't pre-populate)
3. ✅ Print Invoice → `handleSaleAction('print_invoice')` - **WORKING** ✅
4. ✅ Receive Payment → `handleSaleAction('receive_payment')` - **WORKING** ✅
5. ✅ View Ledger → `handleSaleAction('view_ledger')` - **WORKING** ✅
6. ✅ Update Shipping → `handleSaleAction('update_shipping')` - **WORKING** ✅
7. ✅ Delete → `handleSaleAction('delete')` - **WORKING** ✅

#### **Backend Services:**
- ✅ `saleService.getAllSales()` - Available
- ✅ `saleService.getSale()` - Available
- ✅ `saleService.createSale()` - Available
- ✅ `saleService.updateSale()` - Available
- ✅ `saleService.deleteSale()` - Available
- ✅ `saleService.recordPayment()` - Available
- ✅ `saleService.updateSaleStatus()` - Available

---

## 🚨 ISSUES IDENTIFIED:

### **CRITICAL (Blocking):**
1. ❌ **Uses Mock Data** - Not loading from Supabase (line 380: fallback to mockSales)
2. ❌ **Edit Sale** - Opens drawer but doesn't pre-populate form with sale data
3. ❌ **Sale ID Mapping** - Uses string IDs instead of UUIDs (deleteSale uses sale.id which is string)

### **HIGH PRIORITY:**
4. ⚠️ **SalesContext Integration** - SalesPage uses `useSales()` but still falls back to mock data
5. ⚠️ **UUID Support** - Sale interface uses string id, needs UUID for database operations
6. ⚠️ **Shipping Update Dialog** - Needs verification if component exists

### **MEDIUM PRIORITY:**
7. ⚠️ **SaleForm Edit Mode** - Needs to accept sale prop and pre-populate
8. ⚠️ **Refresh After Actions** - Some actions refresh, some don't

---

## 📋 SYSTEMATIC FIX PLAN:

### **STEP 1: Fix Data Loading** ✅
- Remove mock data fallback
- Ensure SalesContext loads from Supabase
- Add UUID to Sale interface
- Map Supabase data to app format

### **STEP 2: Fix Edit Sale Flow**
- Update handleSaleAction('edit') to use edit-sale drawer
- Update SaleForm to accept sale prop
- Update GlobalDrawer to handle edit-sale
- Pre-populate form with sale data

### **STEP 3: Fix Sale ID Mapping**
- Add UUID to Sale interface
- Store actual UUID from Supabase
- Fix deleteSale to use UUID

### **STEP 4: Verify Shipping Update Dialog**
- Check if ShippingUpdateDialog component exists
- Create if missing
- Integrate properly

### **STEP 5: Test All Actions**
- View Details → Opens drawer with real data ✅
- Edit → Opens form with pre-filled data
- Print Invoice → Opens print dialog ✅
- Receive Payment → Opens payment dialog, saves, refreshes ✅
- View Ledger → Opens ledger view ✅
- Update Shipping → Opens dialog, saves changes
- Delete → Confirms and deletes, refreshes ✅

### **STEP 6: Verify CRUD Operations**
- ✅ Create → Test add sale
- ⚠️ Read → Test view details
- ⚠️ Update → Test edit sale
- ✅ Delete → Test delete (after UUID fix)

### **STEP 7: Verify Data Persistence**
- Refresh page → Data persists
- No console errors
- All filters work
- Pagination works

---

## ✅ COMPLETION CRITERIA:

**Sales Module will be 100% complete when:**
1. ✅ All 7 three-dots actions work
2. ✅ All dialogs/drawers open with real data
3. ✅ Edit form pre-populates correctly
4. ✅ Delete uses proper UUID
5. ✅ Data loads from Supabase (no mock fallback)
6. ✅ No console errors
7. ✅ Data persists after refresh
8. ✅ All CRUD operations tested

---

## 📊 PROGRESS TRACKING:

- [ ] STEP 1: Fix Data Loading
- [ ] STEP 2: Fix Edit Sale Flow
- [ ] STEP 3: Fix Sale ID Mapping
- [ ] STEP 4: Verify Shipping Update Dialog
- [ ] STEP 5: Test All Actions
- [ ] STEP 6: Verify CRUD Operations
- [ ] STEP 7: Verify Data Persistence

**Status: 0/7 Steps Complete**

---

**Next Action:** Start with STEP 1 - Fix Data Loading
