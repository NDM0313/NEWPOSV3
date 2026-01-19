# 📦 PURCHASES MODULE - SYSTEMATIC REBUILD PLAN

## 🎯 MODULE: PURCHASES (Priority #2)

### PHASE 0: INVENTORY COMPLETE ✅

#### **Components Identified:**
1. **PurchasesPage.tsx** - Main list page ✅
2. **PurchaseForm.tsx** - Add/Edit form ✅
3. **UnifiedPaymentDialog** - Payment recording ✅
4. **UnifiedLedgerView** - Ledger view ✅
5. **ViewPurchaseDetailsDrawer** - View details (NEEDS CREATION)
6. **Delete Confirmation Dialog** - Already exists but needs integration

#### **Actions Identified (Three-Dots Menu):**
1. ✅ View Details → **MISSING** - No handler, no component
2. ✅ Edit Purchase → **MISSING** - No handler, needs PurchaseForm in edit mode
3. ✅ Print PO → `handlePrintPO()` - **WORKING** ✅
4. ✅ Make Payment → `handleMakePayment()` - **WORKING** ✅
5. ✅ View Ledger → `handleViewLedger()` - **WORKING** ✅
6. ✅ Delete → `handleDelete()` - **PARTIALLY WORKING** (needs confirmation dialog)

#### **Backend Services:**
- ✅ `purchaseService.getAllPurchases()` - Available
- ✅ `purchaseService.getPurchase()` - Available
- ✅ `purchaseService.createPurchase()` - Available
- ✅ `purchaseService.updatePurchase()` - Available
- ✅ `purchaseService.deletePurchase()` - Available
- ✅ `purchaseService.recordPayment()` - Available

---

## 🚨 ISSUES IDENTIFIED:

### **CRITICAL (Blocking):**
1. ❌ **View Details** - No handler, no component
2. ❌ **Edit Purchase** - No handler, no edit mode in PurchaseForm
3. ❌ **Uses Mock Data** - Not loading from Supabase
4. ❌ **Delete Confirmation** - Missing AlertDialog integration

### **HIGH PRIORITY:**
5. ⚠️ **handleViewLedger** - Has duplicate `setSelectedPurchase` (line 181-183)
6. ⚠️ **Purchase ID Mapping** - Uses index-based IDs instead of UUIDs
7. ⚠️ **Refresh After Actions** - No data refresh after payment/delete

### **MEDIUM PRIORITY:**
8. ⚠️ **PurchaseForm Edit Mode** - Needs to accept purchase prop and pre-populate

---

## 📋 SYSTEMATIC FIX PLAN:

### **STEP 1: Fix Data Loading** ✅
- Remove mock data
- Load from Supabase via `purchaseService.getAllPurchases()`
- Add UUID to Purchase interface
- Map Supabase data to app format

### **STEP 2: Create Missing Components**
- Create `ViewPurchaseDetailsDrawer.tsx`
- Add Delete Confirmation AlertDialog

### **STEP 3: Fix Edit Purchase Flow**
- Add edit handler to three-dots menu
- Update PurchaseForm to accept purchase prop
- Update GlobalDrawer to handle edit-purchase
- Pre-populate form with purchase data

### **STEP 4: Fix Action Handlers**
- Fix duplicate `setSelectedPurchase` in handleViewLedger
- Add View Details handler
- Integrate Delete Confirmation Dialog
- Add refresh after actions

### **STEP 5: Test All Actions**
- View Details → Opens drawer with real data
- Edit → Opens form with pre-filled data
- Print PO → Opens print dialog
- Make Payment → Opens payment dialog, saves, refreshes
- View Ledger → Opens ledger view
- Delete → Confirms and deletes, refreshes

### **STEP 6: Verify CRUD Operations**
- ✅ Create → Test add purchase
- ⚠️ Read → Test view details
- ⚠️ Update → Test edit purchase
- ✅ Delete → Test delete (after fix)

### **STEP 7: Verify Data Persistence**
- Refresh page → Data persists
- No console errors
- All filters work
- Pagination works

---

## ✅ COMPLETION CRITERIA:

**Purchases Module will be 100% complete when:**
1. ✅ All 6 three-dots actions work
2. ✅ All dialogs/drawers open with real data
3. ✅ Edit form pre-populates correctly
4. ✅ Delete uses proper UUID
5. ✅ Data loads from Supabase
6. ✅ No console errors
7. ✅ Data persists after refresh
8. ✅ All CRUD operations tested

---

## 📊 PROGRESS TRACKING:

- [ ] STEP 1: Fix Data Loading
- [ ] STEP 2: Create Missing Components
- [ ] STEP 3: Fix Edit Purchase Flow
- [ ] STEP 4: Fix Action Handlers
- [ ] STEP 5: Test All Actions
- [ ] STEP 6: Verify CRUD Operations
- [ ] STEP 7: Verify Data Persistence

**Status: 0/7 Steps Complete**

---

**Next Action:** Start with STEP 1 - Fix Data Loading
