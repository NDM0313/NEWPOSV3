# 🔒 CORE ACCOUNTING BACKBONE RULES (NON-NEGOTIABLE)

**Status:** ✅ **ENFORCED**  
**Date:** 2026-01-30  
**Architect:** Senior ERP Architect

---

## 📋 EXECUTIVE SUMMARY

This document defines the **CORE ACCOUNTING BACKBONE** rules that are **NON-NEGOTIABLE** and apply to **EVERY business** regardless of Accounting Module ON/OFF status.

**Key Principle:** Accounting module is a **FEATURE**, but Cash/Bank/Mobile Wallet accounts are the **FOUNDATION** of the ERP system.

---

## 🎯 CORE PAYMENT ACCOUNTS (MANDATORY)

### The 3 Non-Negotiable Accounts

Every business **MUST** have these 3 accounts:

1. **Cash Account**
   - Code: `1000`
   - Type: `cash`
   - Name: `Cash` (can be renamed)
   - Status: **ALWAYS ACTIVE**

2. **Bank Account**
   - Code: `1010`
   - Type: `bank`
   - Name: `Bank` (can be renamed)
   - Status: **ALWAYS ACTIVE**

3. **Mobile Wallet Account**
   - Code: `1020`
   - Type: `mobile_wallet`
   - Name: `Mobile Wallet` (can be renamed)
   - Status: **ALWAYS ACTIVE**

### Rules

✅ **MUST EXIST:** Created automatically on business creation  
✅ **ALWAYS ACTIVE:** Cannot be disabled/deactivated  
❌ **CANNOT DELETE:** Deletion is blocked (throws error)  
✅ **RENAME ALLOWED:** User can rename for clarity  
✅ **MODULE INDEPENDENT:** Exist regardless of Accounting Module ON/OFF

---

## 🗄️ DATABASE LEVEL ENFORCEMENT

### Business Creation

**File:** `supabase-extract/migrations/create_business_transaction.sql`

```sql
-- Step 7: Create CORE PAYMENT ACCOUNTS (NON-NEGOTIABLE)
-- Core Account 1: Cash (code: 1000)
IF NOT EXISTS (SELECT 1 FROM accounts WHERE company_id = v_company_id AND code = '1000') THEN
  INSERT INTO accounts (company_id, code, name, type, is_active)
  VALUES (v_company_id, '1000', 'Cash', 'cash', true);
END IF;

-- Core Account 2: Bank (code: 1010)
IF NOT EXISTS (SELECT 1 FROM accounts WHERE company_id = v_company_id AND code = '1010') THEN
  INSERT INTO accounts (company_id, code, name, type, is_active)
  VALUES (v_company_id, '1010', 'Bank', 'bank', true);
END IF;

-- Core Account 3: Mobile Wallet (code: 1020)
IF NOT EXISTS (SELECT 1 FROM accounts WHERE company_id = v_company_id AND code = '1020') THEN
  INSERT INTO accounts (company_id, code, name, type, is_active)
  VALUES (v_company_id, '1020', 'Mobile Wallet', 'mobile_wallet', true);
END IF;
```

### Account Deletion Prevention

**File:** `src/app/services/accountService.ts`

```typescript
async deleteAccount(id: string, companyId?: string) {
  // CRITICAL: Check if this is a core payment account
  if (companyId) {
    const { defaultAccountsService } = await import('./defaultAccountsService');
    const account = await this.getAccountById(id);
    
    if (account && defaultAccountsService.isCorePaymentAccount(account)) {
      throw new Error(
        `Cannot delete core payment account "${account.name}". ` +
        `Core accounts (Cash, Bank, Mobile Wallet) are mandatory and cannot be deleted. ` +
        `You can rename the account if needed.`
      );
    }
  }
  // ... rest of deletion logic
}
```

---

## 🔧 SERVICE LEVEL ENFORCEMENT

### Default Accounts Service

**File:** `src/app/services/defaultAccountsService.ts`

**Core Accounts Definition:**
```typescript
const CORE_PAYMENT_ACCOUNTS: DefaultAccount[] = [
  { code: '1000', name: 'Cash', type: 'cash' },
  { code: '1010', name: 'Bank', type: 'bank' },
  { code: '1020', name: 'Mobile Wallet', type: 'mobile_wallet' },
];
```

**Enforcement Methods:**
- `ensureDefaultAccounts(companyId)` - Creates missing core accounts (throws error if fails)
- `isCorePaymentAccount(account)` - Checks if account is core (cannot delete)
- `getCorePaymentAccounts()` - Returns list of core accounts

**Called On:**
- Business creation (`create_business_transaction.sql`)
- System initialization (`SupabaseContext.tsx`)
- Branch creation (`branchService.ts`)

---

## 💳 PAYMENT VALIDATION RULES

### Payment Account ID - REQUIRED

**Files:**
- `src/app/services/saleService.ts` - `recordPayment()`
- `src/app/services/purchaseService.ts` - `recordPayment()`

**Validation:**
```typescript
if (!accountId) {
  throw new Error('Payment account_id is required. Cannot save payment without account.');
}
```

**Result:** Payment **CANNOT** be saved without `payment_account_id`.

### Default Account Selection

**File:** `src/app/services/accountHelperService.ts`

**Mapping:**
- Cash → Account with code `1000`
- Bank/Card/Cheque → Account with code `1010`
- Mobile Wallet → Account with code `1020` (or Bank if not exists)

---

## 🎨 FRONTEND BEHAVIOR RULES

### Payment Options - Always Visible

**Files:**
- `src/app/components/sales/SaleForm.tsx`
- `src/app/components/purchases/PurchaseForm.tsx`
- `src/app/components/shared/UnifiedPaymentDialog.tsx`

**Rule:** Cash, Bank, Mobile Wallet options are **ALWAYS** visible, regardless of:
- Accounting Module ON/OFF status
- User permissions
- Branch settings

**Implementation:**
```typescript
// Payment method options (always available)
<SelectItem value="cash">Cash</SelectItem>
<SelectItem value="bank">Bank</SelectItem>
<SelectItem value="Mobile Wallet">Mobile Wallet</SelectItem>
```

### Account Selection - Mandatory

**File:** `src/app/components/shared/UnifiedPaymentDialog.tsx`

**Rule:** User **MUST** select an account before saving payment.

**Validation:**
```typescript
if (!selectedAccount || selectedAccount === '') {
  toast.error('Payment account is required. Please select an account.');
  return;
}
```

---

## 🔄 ACCOUNTING MODULE TOGGLE LOGIC

### Accounting Module OFF

**Behavior:**
- ✅ Core 3 accounts (Cash, Bank, Mobile Wallet) **STILL EXIST**
- ✅ Payment options **STILL AVAILABLE**
- ✅ Payment account selection **STILL MANDATORY**
- ⚠️ Limited journal entries (internal tracking only)
- ⚠️ No advanced reports
- ⚠️ No additional accounts can be created

### Accounting Module ON

**Behavior:**
- ✅ Core 3 accounts **STILL EXIST** (cannot be deleted)
- ✅ User can create **ADDITIONAL** accounts
- ✅ Full chart of accounts available
- ✅ Full journal, ledger, reports enabled
- ✅ Advanced accounting features available

**Key Point:** Core accounts exist in **BOTH** scenarios.

---

## 🚫 REJECTION RULES

### Changes That Will Be REJECTED

❌ **Removing core accounts from business creation**  
❌ **Allowing deletion of core accounts**  
❌ **Hiding Cash/Bank/Mobile Wallet from payment options**  
❌ **Making payment_account_id optional**  
❌ **Bypassing account selection validation**  
❌ **Creating business without core accounts**

### Enforcement

All rejection rules are enforced at:
1. **Database Level:** SQL constraints and triggers
2. **Service Level:** Validation in `accountService`, `defaultAccountsService`
3. **Frontend Level:** UI validation and mandatory fields

---

## ✅ VERIFICATION CHECKLIST

### Business Creation
- [x] Core accounts created automatically
- [x] Accounts are always active
- [x] Accounts cannot be deleted
- [x] Accounts can be renamed

### Payment Flows
- [x] Cash/Bank/Mobile Wallet always visible
- [x] Account selection mandatory
- [x] payment_account_id validation enforced
- [x] Default account auto-selection works

### Accounting Module Toggle
- [x] Core accounts exist when OFF
- [x] Core accounts exist when ON
- [x] Additional accounts only when ON
- [x] Core accounts cannot be deleted in either state

---

## 📝 SUMMARY

**Core Accounting Backbone = Foundation of ERP**

- **3 Core Accounts:** Cash, Bank, Mobile Wallet
- **Always Exist:** Regardless of module status
- **Cannot Delete:** Enforced at service level
- **Payment Required:** Account selection mandatory
- **Frontend Always Shows:** Payment options always visible

**This is NOT a feature - this is the FOUNDATION.**

---

## 🔗 RELATED FILES

- `src/app/services/defaultAccountsService.ts` - Core accounts service
- `src/app/services/accountService.ts` - Account deletion prevention
- `supabase-extract/migrations/create_business_transaction.sql` - Business creation
- `src/app/services/saleService.ts` - Payment validation
- `src/app/services/purchaseService.ts` - Payment validation
- `src/app/components/shared/UnifiedPaymentDialog.tsx` - Account selection UI

---

**Last Updated:** 2026-01-30  
**Status:** ✅ **ENFORCED & VERIFIED**
