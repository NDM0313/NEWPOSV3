# ✅ STEP 7: END-TO-END FLOW VERIFICATION CHECKLIST

## Purpose
Manual testing checklist to verify all ERP modules are properly linked and working correctly.

---

## 🔍 PRE-TESTING SETUP

### Database State
- [ ] All old demo data truncated
- [ ] Fresh data inserted via STEP 8 script
- [ ] Default accounts exist (Cash, Bank, AR, AP, Sales, Expense)
- [ ] Default "Piece" unit exists
- [ ] At least 1 branch exists
- [ ] At least 1 user (admin) exists

---

## 📦 TEST 1: PRODUCT & VARIATION CREATION

### Test Steps:
1. [ ] Navigate to Products page
2. [ ] Create a new product (e.g., "Test Shirt")
3. [ ] Set SKU, cost price, retail price
4. [ ] Select unit (should default to "Piece")
5. [ ] Save product

### Expected Results:
- [ ] Product appears in products list
- [ ] Product can be searched by SKU
- [ ] Product shows in inventory with 0 stock

### Variation Test:
1. [ ] Edit the product
2. [ ] Add variations (e.g., Size: Small/Medium/Large, Color: Red/Blue)
3. [ ] Save variations

### Expected Results:
- [ ] Variations appear in product details
- [ ] Each variation has unique SKU
- [ ] Variations show in inventory separately

---

## 🛒 TEST 2: PURCHASE FLOW (COMPLETE)

### Test Steps:
1. [ ] Navigate to Purchases page
2. [ ] Click "Add Purchase"
3. [ ] Select supplier
4. [ ] Select date (NOT today - test date override)
5. [ ] Add 3-5 products with quantities
6. [ ] For products with variations, select variation
7. [ ] Add shipping/cargo expense (e.g., 500)
8. [ ] Add discount (e.g., 100)
9. [ ] Add payment (Cash: 50%, Bank: 50%)
10. [ ] Save purchase

### Expected Results:
- [ ] Purchase appears in purchases list
- [ ] Purchase number is correct (e.g., PUR-0001)
- [ ] Date matches selected date (NOT current date)
- [ ] Location/branch shows correctly
- [ ] "Added By" shows actual user name (NOT "Unknown")

### Stock Verification:
- [ ] Navigate to Inventory page
- [ ] Stock increased for all purchased products
- [ ] Variation-specific stock increased correctly
- [ ] Stock calculated from `stock_movements` (not cached)

### Accounting Verification:
- [ ] Navigate to Accounting → Transactions
- [ ] Journal entries created for:
  - [ ] Purchase items (Inventory Dr, AP Cr)
  - [ ] Shipping expense (Expense Dr, Cash/Bank Cr)
  - [ ] Discount (AP Dr, Discount Cr)
- [ ] Navigate to Supplier Ledger
- [ ] Purchase entry visible with correct amount
- [ ] Payment entries visible
- [ ] Shipping and discount entries visible

### Payment Verification:
- [ ] Open purchase details drawer
- [ ] Click "Payments" tab
- [ ] Payments show correctly (Cash + Bank)
- [ ] Payment history shows dates, amounts, methods

---

## 💰 TEST 3: SALE FLOW (COMPLETE)

### Test Steps:
1. [ ] Navigate to Sales page
2. [ ] Click "Add Sale"
3. [ ] Select customer
4. [ ] Select date (NOT today - test date override)
5. [ ] Add 3-5 products with quantities
6. [ ] For products with variations, select variation
7. [ ] Add payment (Cash: 100%)
8. [ ] Save sale

### Expected Results:
- [ ] Sale appears in sales list
- [ ] Sale number is correct (e.g., SL-0001)
- [ ] Date matches selected date (NOT current date)
- [ ] Location/branch shows correctly
- [ ] "Added By" shows actual user name (NOT "Unknown")

### Stock Verification:
- [ ] Navigate to Inventory page
- [ ] Stock decreased for all sold products
- [ ] Variation-specific stock decreased correctly
- [ ] Stock matches `stock_movements` calculation

### Accounting Verification:
- [ ] Navigate to Accounting → Transactions
- [ ] Journal entries created for:
  - [ ] Sale items (AR/Cash Dr, Sales Revenue Cr)
- [ ] Navigate to Customer Ledger
- [ ] Sale entry visible with correct amount
- [ ] Payment entry visible

### Payment Verification:
- [ ] Open sale details drawer
- [ ] Click "Payments" tab
- [ ] Payment shows correctly
- [ ] Payment history shows date, amount, method

---

## 🗑️ TEST 4: DELETE FLOW (FULL REVERSE)

### Delete Purchase Test:
1. [ ] Select a purchase from list
2. [ ] Click delete
3. [ ] Confirm deletion

### Expected Results:
- [ ] Purchase removed from list
- [ ] Stock REVERSED (decreased back to original)
- [ ] Navigate to Inventory - stock matches pre-purchase level
- [ ] Navigate to Accounting - journal entries removed
- [ ] Navigate to Supplier Ledger - entries removed
- [ ] Navigate to Payments - payments removed
- [ ] Page navigation - purchase does NOT reappear

### Delete Sale Test:
1. [ ] Select a sale from list
2. [ ] Click delete
3. [ ] Confirm deletion

### Expected Results:
- [ ] Sale removed from list
- [ ] Stock REVERSED (increased back to original)
- [ ] Navigate to Inventory - stock matches pre-sale level
- [ ] Navigate to Accounting - journal entries removed
- [ ] Navigate to Customer Ledger - entries removed
- [ ] Navigate to Payments - payments removed
- [ ] Page navigation - sale does NOT reappear

---

## 📊 TEST 5: INVENTORY ACCURACY

### Test Steps:
1. [ ] Note current stock for Product A (e.g., 10 units)
2. [ ] Create purchase for Product A (quantity: 5)
3. [ ] Check inventory - should show 15
4. [ ] Create sale for Product A (quantity: 3)
5. [ ] Check inventory - should show 12
6. [ ] Delete the purchase
7. [ ] Check inventory - should show 7 (12 - 5)
8. [ ] Delete the sale
9. [ ] Check inventory - should show 10 (7 + 3)

### Expected Results:
- [ ] Inventory always matches `stock_movements` calculation
- [ ] No negative stock (unless explicitly allowed)
- [ ] Variation stock tracked separately
- [ ] Product total stock = sum of variation stocks

---

## 💳 TEST 6: PAYMENT MANAGEMENT

### Edit Payment Test:
1. [ ] Open purchase/sale with payment
2. [ ] Click edit icon on payment
3. [ ] Change amount or method
4. [ ] Save

### Expected Results:
- [ ] Payment updated in database
- [ ] Accounting entries updated
- [ ] Ledger balances recalculated
- [ ] UI reflects changes immediately

### Delete Payment Test:
1. [ ] Open purchase/sale with payment
2. [ ] Click delete icon on payment
3. [ ] Confirm deletion

### Expected Results:
- [ ] Confirmation modal appears (NOT behind other modals)
- [ ] Payment removed from database
- [ ] Accounting entries reversed
- [ ] Ledger balances recalculated
- [ ] Purchase/sale due amount updated

---

## 🔄 TEST 7: DATA CONSISTENCY

### Cross-Module Verification:
1. [ ] Create purchase → Check inventory → Check accounting → Check ledger
2. [ ] Create sale → Check inventory → Check accounting → Check ledger
3. [ ] Delete purchase → Verify ALL modules updated
4. [ ] Delete sale → Verify ALL modules updated

### Expected Results:
- [ ] All modules show consistent data
- [ ] No orphaned records
- [ ] No stale data after navigation
- [ ] All calculations match across modules

---

## ✅ ACCEPTANCE CRITERIA

### Must Pass All:
- [ ] Stock movements created for ALL purchases/sales
- [ ] Stock calculated from `stock_movements` (not `products.current_stock`)
- [ ] Delete = Full reverse (stock, accounting, ledger, payments)
- [ ] Date override works (user-selected date saved)
- [ ] "Added By" shows actual user name
- [ ] Payment history shows for new purchases/sales
- [ ] Document numbers increment correctly (no duplicates)
- [ ] All accounting entries created correctly
- [ ] All ledger entries linked correctly
- [ ] No data appears after deletion (even after navigation)

---

## 🐛 IF ANY TEST FAILS:

1. **Note the exact failure point**
2. **Check browser console for errors**
3. **Check database directly (Supabase dashboard)**
4. **Verify stock_movements table has entries**
5. **Verify journal_entries table has entries**
6. **Report specific issue with steps to reproduce**

---

## 📝 TESTING NOTES

**Date:** _______________  
**Tester:** _______________  
**Environment:** Development / Production  
**Browser:** _______________  

**Issues Found:**
1. ________________________________
2. ________________________________
3. ________________________________

**Status:** ⬜ Pass / ⬜ Fail / ⬜ Partial

---

**END OF CHECKLIST**
