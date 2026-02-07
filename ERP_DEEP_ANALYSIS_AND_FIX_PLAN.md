# ERP DEEP ANALYSIS & RE-ARCHITECT PLAN

## 📊 CURRENT STATE ANALYSIS

### Database Counts (Current)
- Companies: 1
- Branches: 1
- Users: 3
- Accounts: 5
- Units: 3
- Products: 6
- Purchases: 0 (all deleted)
- Sales: 4
- Stock Movements: 0 ⚠️ **CRITICAL ISSUE**
- Journal Entries: 7
- Payments: 4
- Contacts: 16

### 🔴 CRITICAL ISSUES IDENTIFIED

1. **Stock Movements = 0** (Should have movements for sales)
2. **Purchases = 0** (All deleted, need fresh data)
3. **Stock system not linked to transactions**
4. **Need to verify all accounting entries are properly linked**

---

## 🏗️ BUSINESS LIFECYCLE ANALYSIS

### ✅ Business Creation Flow (VERIFIED)
**File:** `supabase-extract/migrations/create_business_transaction.sql`

**What happens:**
1. Company created
2. Default branch created ("Main Branch")
3. User created (admin role)
4. User linked to branch
5. **Default "Piece" unit created** ✅
6. **Default accounts NOT created in function** ⚠️

**Missing:**
- Default accounts creation (Cash, Bank, AR, AP) - handled separately via `defaultAccountsService.ensureDefaultAccounts()`
- Document sequences initialization

### ✅ Branch Creation Flow (VERIFIED)
**File:** `src/app/services/branchService.ts`

**What happens:**
1. Branch created
2. **Default accounts ensured** ✅ (via `defaultAccountsService.ensureDefaultAccounts()`)

**Status:** ✅ CORRECT

---

## 📋 MASTER DATA ANALYSIS

### 1. Users
- **Table:** `users`
- **Links:** `company_id`, `created_by` (self-reference)
- **Delete/Update:** Need to verify cascade rules

### 2. Contacts (Customers/Suppliers)
- **Table:** `contacts`
- **Links:** `company_id`, `branch_id`, `created_by`
- **Ledger Link:** Via `ledger_master` (ledger_type='supplier'/'customer')
- **Delete/Update:** Need to verify ledger cleanup

### 3. Products
- **Table:** `products`
- **Links:** `company_id`, `category_id`, `unit_id`, `brand_id`
- **Variations:** `product_variations` (linked via `product_id`)
- **Stock:** `current_stock` (cache) + `stock_movements` (source of truth)
- **Delete/Update:** Need to verify stock movement cleanup

### 4. Units
- **Table:** `units`
- **Links:** `company_id`
- **Default:** One `is_default=true` per company (Piece)
- **Delete/Update:** Default unit protected

---

## 🔄 CORE TRANSACTION FLOWS

### 🔹 Purchase Flow (ANALYSIS NEEDED)

**Expected Flow:**
1. Purchase record created
2. Purchase items created
3. **Stock movements created** (if status='received' or 'final')
4. **Supplier ledger entry created**
5. **Journal entry created** (Debit: Inventory, Credit: Accounts Payable)
6. **Extra expenses** (shipping/cargo) → Journal entry
7. **Discount** → Journal entry

**Current Status:** ⚠️ Need to verify all steps are implemented

### 🔹 Sale Flow (ANALYSIS NEEDED)

**Expected Flow:**
1. Sale record created
2. Sale items created
3. **Stock movements created** (negative, if status='final')
4. **Customer ledger entry created**
5. **Journal entry created** (Debit: Accounts Receivable, Credit: Sales)
6. **Payment** → Journal entry (Debit: Cash/Bank, Credit: Accounts Receivable)

**Current Status:** ⚠️ Stock movements = 0 suggests this is broken

### 🔹 Inventory/Stock System

**Golden Rule:**
- `stock_movements` = Single source of truth
- `products.current_stock` = Cache (updated from movements)
- Inventory page = SUM from `stock_movements` grouped by `product_id` + `variation_id`

**Current Status:** ❌ **BROKEN** - Stock movements = 0

---

## 🧾 ACCOUNTING & LEDGER RULES

### Journal Entries
- **Table:** `journal_entries` + `journal_entry_lines`
- **Links:** `reference_type` + `reference_id` (purchase/sale/payment)
- **Delete Rule:** Should reverse entries, not just delete

### Ledger Entries
- **Table:** `ledger_entries` (linked to `ledger_master`)
- **Source:** Derived from journal entries
- **Delete Rule:** Should not delete directly, reverse via journal

### Supplier Ledger
- **Source:** `ledger_entries` where `ledger_type='supplier'`
- **Should show:** Purchase, Payment, Discount, Extra Expenses
- **Current Status:** ✅ Filtering implemented (only active purchases)

---

## 🧹 DELETE/UPDATE CONSISTENCY

### Purchase Delete
**Expected:**
1. Delete payments
2. Reverse stock movements
3. Delete ledger entries
4. Delete journal entries
5. Delete purchase items
6. Delete purchase record

**Current Status:** ✅ Implemented (7-step cascade)

### Sale Delete
**Expected:** Same as purchase (reverse flow)

**Current Status:** ⚠️ Need to verify

---

## 🔧 FIX PLAN

### PHASE 1: Stock System Fix
1. Verify stock movements are created on purchase/sale
2. Fix inventory calculation to use `stock_movements`
3. Update `products.current_stock` as cache

### PHASE 2: Accounting Completeness
1. Verify all transactions create journal entries
2. Verify ledger entries are derived correctly
3. Fix any missing accounting links

### PHASE 3: Data Cleanup & Fresh Data
1. Truncate demo data
2. Insert fresh test data (10+ records each)
3. Verify all flows work end-to-end

---

## ✅ ACCEPTANCE CRITERIA

1. ✅ Purchase → Stock increases
2. ✅ Sale → Stock decreases
3. ✅ Delete → Stock reverses
4. ✅ Ledger matches accounting
5. ✅ Inventory page accurate
6. ✅ No stale data after navigation
7. ✅ All modules properly linked

---

## 📝 NEXT STEPS

1. Analyze current purchase/sale creation code
2. Fix stock movement creation
3. Verify accounting entries
4. Truncate and insert fresh data
5. End-to-end testing
