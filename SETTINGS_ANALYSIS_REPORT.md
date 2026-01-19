# Settings Module Analysis Report

## PHASE 1 - SETTINGS INVENTORY

### All Settings Screens and Controls:

1. **Module Toggles**
   - POS Module (Switch)
   - Rental Module (Switch)
   - Studio Module (Switch)
   - Accounting Module (Switch)

2. **Company Info**
   - Business Name (Input)
   - Tax ID / NTN (Input)
   - Business Address (Input)
   - Phone Number (Input)
   - Email Address (Input)
   - Currency (Select)

3. **Branch Management**
   - List of branches with:
     - Branch Name, Code, Address, Phone
     - Cash Account, Bank Account, POS Drawer
     - Active/Inactive status
     - Default branch indicator
   - Add New Branch button

4. **POS Settings**
   - Default Cash Account (Input)
   - Invoice Prefix (Input)
   - Default Tax Rate % (Number)
   - Max Discount % (Number)
   - Credit Sale Allowed (Switch)
   - Auto Print Receipt (Switch)
   - Negative Stock Allowed (Switch)
   - Allow Discount (Switch)

5. **Sales Settings**
   - Invoice Prefix (Input)
   - Default Payment Method (Select)
   - Auto Due Days (Number)
   - Partial Payment Allowed (Switch)
   - Auto Ledger Entry (Switch)
   - Allow Credit Sale (Switch)
   - Require Customer Info (Switch)

6. **Purchase Settings**
   - Supplier Payable Account (Input)
   - Payment Terms Days (Number)
   - Over Receive Allowed (Switch)
   - Approval Required (Switch)
   - GRN Required (Switch)
   - Auto Post to Inventory (Switch)

7. **Inventory Settings**
   - Low Stock Threshold (Number)
   - Reorder Alert Days (Number)
   - Valuation Method (Select: FIFO/LIFO/Weighted Average)
   - Negative Stock Allowed (Switch)
   - Auto Reorder Enabled (Switch)
   - Barcode Required (Switch)

8. **Rental Settings**
   - Late Fee Per Day (Number)
   - Grace Period Days (Number)
   - Advance Percentage % (Number)
   - Security Deposit Amount (Number)
   - Advance Required (Switch)
   - Security Deposit Required (Switch)
   - Damage Charge Enabled (Switch)
   - Auto Extend Allowed (Switch)

9. **Accounting Settings**
   - Fiscal Year Start (Date)
   - Fiscal Year End (Date)
   - Default Currency (Input)
   - Default Tax Rate % (Number)
   - Tax Calculation Method (Select: Inclusive/Exclusive)
   - Lock Accounting Date (Date)
   - Manual Journal Enabled (Switch)
   - Multi Currency Enabled (Switch)

10. **Default Accounts**
    - Cash Account (Select)
    - Bank Account (Select)
    - Mobile Wallet (Select)

11. **Numbering Rules**
    - Sales Invoice: Prefix + Next Number
    - Purchase Order: Prefix + Next Number
    - Rental Booking: Prefix + Next Number
    - POS Invoice: Prefix + Next Number
    - Expense Entry: Prefix + Next Number
    - Product SKU: Prefix + Next Number

12. **User Management**
    - Table of users with:
      - User name, Email, Role, Status
      - Edit button
    - Add User button

13. **Roles & Permissions**
    - Permission toggles for:
      - Create/Edit/Delete Sales
      - View Reports
      - Manage Settings
      - Manage Users
      - Access Accounting
      - Make/Receive Payments
      - Manage Expenses/Products/Purchases/Rentals

---

## PHASE 2 - DATABASE MODEL VERIFICATION

### Tables Found in Schema:

✅ **`settings`** table (lines 715-728)
- `company_id` (UUID)
- `key` (VARCHAR) - setting key
- `value` (JSONB) - setting value
- `category` (VARCHAR) - 'general', 'accounting', 'sales', etc.
- UNIQUE(company_id, key)

✅ **`modules_config`** table (lines 730-741)
- `company_id` (UUID)
- `module_name` (VARCHAR) - 'rentals', 'studio', 'accounting', 'pos'
- `is_enabled` (BOOLEAN)
- `config` (JSONB) - module-specific settings
- UNIQUE(company_id, module_name)

✅ **`document_sequences`** table (lines 743-756)
- `company_id` (UUID)
- `branch_id` (UUID)
- `document_type` (VARCHAR) - 'sale', 'purchase', 'expense', etc.
- `prefix` (VARCHAR)
- `current_number` (INTEGER)
- `padding` (INTEGER)
- UNIQUE(company_id, branch_id, document_type)

✅ **`companies`** table (lines 65-82)
- Has company info fields

✅ **`branches`** table (lines 84-97)
- Has branch info fields

### Missing Tables:

❌ **NO dedicated tables for:**
- POS Settings
- Sales Settings
- Purchase Settings
- Inventory Settings
- Rental Settings
- Accounting Settings
- Default Accounts
- User Permissions

**Solution**: These should use the `settings` table with appropriate keys and categories.

---

## PHASE 3 - CURRENT STATE ANALYSIS

### Issues Found:

1. ❌ **All settings in React state only** (SettingsContext.tsx)
   - No database loading
   - No database saving
   - Resets on refresh

2. ❌ **Module toggles don't affect sidebar**
   - Toggles exist but don't hide/show modules
   - Routes not blocked

3. ❌ **Hardcoded defaults** (lines 216-361 in SettingsContext.tsx)
   - Company settings hardcoded
   - All module settings hardcoded
   - Module toggles hardcoded to `true`

4. ❌ **No persistence**
   - All update functions only update state
   - No Supabase integration

5. ❌ **No loading/error states**
   - No async operations
   - No error handling

---

## PHASE 4 - REQUIRED FIXES

### Priority 1 (CRITICAL):
1. Create `settingsService.ts` for database operations
2. Load all settings from database on mount
3. Save all settings to database on change
4. Make module toggles affect sidebar visibility
5. Make module toggles block routes

### Priority 2 (HIGH):
6. Add loading states
7. Add error handling
8. Remove all hardcoded defaults
9. Implement company-aware loading

### Priority 3 (MEDIUM):
10. Add branch-aware settings where needed
11. Implement permission checks
12. Add validation

---

## FILES TO MODIFY:

1. **NEW**: `src/app/services/settingsService.ts`
2. **MODIFY**: `src/app/context/SettingsContext.tsx`
3. **MODIFY**: `src/app/components/layout/Sidebar.tsx` (or similar)
4. **MODIFY**: `src/app/App.tsx` (route protection)

---

## CURRENT STATE SUMMARY:

- ❌ Settings: React state only (no database)
- ❌ Module Toggles: Don't affect UI/routes
- ❌ Persistence: None (resets on refresh)
- ❌ Loading: None
- ❌ Error Handling: None
- ✅ UI: Complete and functional visually

---

## NEXT STEPS:

1. Create settingsService.ts
2. Update SettingsContext to load/save from database
3. Integrate module toggles with sidebar
4. Add route protection based on module toggles
5. Remove hardcoded defaults
6. Add loading/error states
