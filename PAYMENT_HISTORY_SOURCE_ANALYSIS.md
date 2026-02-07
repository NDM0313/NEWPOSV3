# 🔍 PAYMENT HISTORY SOURCE ANALYSIS

**Date:** January 30, 2026  
**Component:** ViewPaymentsModal (Purchase Payment History)

---

## 📊 PAYMENT HISTORY DATA FLOW

### Step 1: ViewPaymentsModal Opens
**File:** `src/app/components/sales/ViewPaymentsModal.tsx`

```typescript
useEffect(() => {
  if (isOpen && invoice?.id) {
    const fetchPayments = async () => {
      // Determine if this is a purchase or sale
      const invoiceNoUpper = (invoice.invoiceNo || '').toUpperCase();
      const isPurchase = invoiceNoUpper.startsWith('PUR-') || invoiceNoUpper.startsWith('PO-');
      
      if (isPurchase) {
        // ✅ Purchase payments - ALWAYS from payments table
        const { purchaseService } = await import('@/app/services/purchaseService');
        const fetchedPayments = await purchaseService.getPurchasePayments(invoice.id);
        setPayments(fetchedPayments || []);
      }
    };
    fetchPayments();
  }
}, [isOpen, invoice?.id, invoice?.invoiceNo]);
```

**Key Points:**
- ✅ Invoice number pattern detection: `PUR-` or `PO-` = Purchase
- ✅ Calls `purchaseService.getPurchasePayments(invoice.id)`
- ✅ `invoice.id` = Purchase UUID (database ID)

---

### Step 2: purchaseService.getPurchasePayments()
**File:** `src/app/services/purchaseService.ts` (Line 674-722)

```typescript
async getPurchasePayments(purchaseId: string) {
  console.log('[PURCHASE SERVICE] getPurchasePayments called with purchaseId:', purchaseId);
  
  const { data, error } = await supabase
    .from('payments')
    .select(`
      id,
      payment_date,
      reference_number,
      amount,
      payment_method,
      payment_account_id,
      notes,
      attachments,
      created_at,
      account:accounts(id, name)
    `)
    .eq('reference_type', 'purchase')  // ✅ Filter: Only purchase payments
    .eq('reference_id', purchaseId)     // ✅ Filter: Only this purchase's payments
    .order('payment_date', { ascending: false })
    .order('created_at', { ascending: false });

  // Map to Payment format
  if (data && data.length > 0) {
    return data.map((p: any) => ({
      id: p.id,
      date: p.payment_date || p.created_at?.split('T')[0],
      referenceNo: p.reference_number || '',
      amount: parseFloat(p.amount || 0),
      method: p.payment_method || 'cash',
      accountId: p.payment_account_id,
      accountName: p.account?.name || '',
      notes: p.notes || '',
      attachments: p.attachments || null,
      createdAt: p.created_at,
    }));
  }
  
  // Fallback: Check purchases table if no payments found
  // ... (fallback logic)
}
```

**Database Query:**
```sql
SELECT 
  id,
  payment_date,
  reference_number,
  amount,
  payment_method,
  payment_account_id,
  notes,
  attachments,
  created_at,
  account:accounts(id, name)
FROM payments
WHERE reference_type = 'purchase'
  AND reference_id = '<purchase_uuid>'
ORDER BY payment_date DESC, created_at DESC;
```

---

## 🔍 VERIFICATION CHECKLIST

### ✅ Source Verification

1. **ViewPaymentsModal Detection:**
   - ✅ Invoice number pattern: `PUR-0002` → Detected as Purchase
   - ✅ Calls `purchaseService.getPurchasePayments(invoice.id)`

2. **Database Query:**
   - ✅ Table: `payments`
   - ✅ Filter: `reference_type = 'purchase'`
   - ✅ Filter: `reference_id = purchase_uuid`
   - ✅ Join: `accounts` table for account name

3. **Data Mapping:**
   - ✅ Maps to Payment interface format
   - ✅ Includes account name from join
   - ✅ Includes reference number, date, amount, method

### 🔍 Potential Issues

#### Issue 1: Purchase ID Mismatch
**Problem:** `invoice.id` might not match the actual purchase UUID in database.

**Check:**
- In `PurchasesPage.tsx`, when opening ViewPaymentsModal:
  ```typescript
  invoice={{
    id: selectedPurchase.uuid,  // ✅ Should be database UUID
    invoiceNo: selectedPurchase.poNo,
    // ...
  }}
  ```

**Verification:**
- ✅ `selectedPurchase.uuid` = Database UUID (from `purchases.id`)
- ✅ `selectedPurchase.id` = Display ID (index-based, NOT used for query)

#### Issue 2: Payment Not Linked to Purchase
**Problem:** Payment might exist but `reference_id` doesn't match purchase UUID.

**Check:**
```sql
-- Verify payment exists for this purchase
SELECT * FROM payments 
WHERE reference_type = 'purchase' 
  AND reference_id = '<purchase_uuid>';
```

#### Issue 3: Reference Type Mismatch
**Problem:** Payment might have wrong `reference_type`.

**Check:**
```sql
-- Check all payments for this purchase (any reference_type)
SELECT * FROM payments 
WHERE reference_id = '<purchase_uuid>';
```

---

## 🧪 DEBUGGING STEPS

### Step 1: Check Console Logs
When ViewPaymentsModal opens, check browser console for:
```
[VIEW PAYMENTS] Fetching purchase payments for purchase ID: <uuid>
[PURCHASE SERVICE] getPurchasePayments called with purchaseId: <uuid>
[PURCHASE SERVICE] Payment query result: { dataCount: X, error: ..., purchaseId: ... }
[VIEW PAYMENTS] Purchase payments loaded: X
```

### Step 2: Verify Purchase UUID
In `PurchasesPage.tsx`, verify:
```typescript
// When opening ViewPaymentsModal
invoice={{
  id: selectedPurchase.uuid,  // ✅ Must be database UUID, not display ID
  // ...
}}
```

### Step 3: Check Database Directly
Run SQL query to verify payments exist:
```sql
SELECT 
  p.id,
  p.reference_type,
  p.reference_id,
  p.amount,
  p.payment_method,
  p.payment_date,
  p.reference_number,
  pur.po_no
FROM payments p
LEFT JOIN purchases pur ON pur.id = p.reference_id
WHERE p.reference_type = 'purchase'
  AND pur.po_no = 'PUR-0002';
```

---

## 📋 SUMMARY

### Payment History Source (Purchase)

1. **Component:** `ViewPaymentsModal`
2. **Service:** `purchaseService.getPurchasePayments(purchaseId)`
3. **Database Table:** `payments`
4. **Query Filters:**
   - `reference_type = 'purchase'`
   - `reference_id = purchase_uuid`
5. **Join:** `accounts` table (for account name)
6. **Order:** `payment_date DESC, created_at DESC`

### Key Requirements

✅ **Purchase ID:** Must be database UUID (not display ID)  
✅ **Reference Type:** Must be `'purchase'`  
✅ **Reference ID:** Must match purchase UUID  
✅ **Payment Account:** Must exist in `accounts` table  

### Golden Rule

🔒 **Payment History = `payments` table ONLY**
- ❌ Never read from `purchase.paid_amount`
- ❌ Never read from `invoice.payments`
- ✅ Always query `payments` table with `reference_type` and `reference_id`

---

**Last Updated:** January 30, 2026
