# Supplier Ledger — Data Flow (Backend & Database)

Yeh document batata hai ke **Supplier Ledger** page (e.g. "Supplier SHD Last 30 Days") ka data kahan se aata hai aur agar sahi show nahi ho raha to kya check karein.

---

## 1. UI → Backend flow

| Step | Location | Kya hota hai |
|------|----------|----------------|
| 1 | **AccountingDashboard** | User "Ledger" → "Supplier Ledger" select karta hai. |
| 2 | **LedgerHub** | Supplier list `contactService.getAllContacts(companyId, 'supplier')` + `'both'` se aati hai. User dropdown se **supplier select** karta hai (e.g. "SHD") → `entityId` = contact id, `entityName` = "SHD". |
| 3 | **GenericLedgerView** | `entityId`, `entityName` + **date range** (default: Last 30 Days = aaj se 30 din pehle tak) use hota hai. |
| 4 | **Data fetch** | `getSupplierLedgerData(companyId, entityId, entityName, dateRange.from, dateRange.to)` call hota hai. |

---

## 2. Backend → Database (exact source)

**File:** `src/app/services/ledgerDataAdapters.ts` → `getSupplierLedgerData`  
**File:** `src/app/services/ledgerService.ts` → `getOrCreateLedger`, `getLedgerEntries`

### Tables used

| Data | Table / source | Column / logic |
|------|----------------|----------------|
| **Ledger header** | `ledger_master` | `company_id`, `ledger_type = 'supplier'`, **`entity_id` = supplier contact id** (jo dropdown se select hota hai). `entity_name`, `opening_balance`. |
| **Entries (rows)** | `ledger_entries` | `ledger_id` = ledger_master.id, `entry_date` between **fromDate** and **toDate** (Last 30 Days). `source` = 'purchase' | 'payment', `reference_id` = purchase_id ya payment_id, `debit`, `credit`, `balance_after`. |
| **Opening balance** | `ledger_master.opening_balance` + last `balance_after` of entries **before** fromDate (agar maujood ho). |
| **Purchase validity** | `purchases` | Agar entry `source = 'purchase'` hai to `reference_id` wala purchase exist karna chahiye; warna row **show nahi hoti**. |
| **Payment validity** | `payments` | Payment entries tab hi count hoti hain jab: (1) `payments.contact_id = supplierId`, ya (2) reference_id supplier ki purchase id ho, ya (3) reference_id purchase-linked payment ho, ya (4) reference_id is ledger ki koi bhi payment ref ho. |

### Summary cards (OPENING / DEBIT / CREDIT / CLOSING)

- **Opening Balance:** `ledger_master.opening_balance` + (agar fromDate se pehle entries hain to unka last `balance_after`).
- **Total Debit / Total Credit:** Sirf **in-range** aur **valid** entries se (purchase exist kare, payment valid ho).
- **Closing Balance:** Opening + (Total Debit − Total Credit) in that range.

### Current Invoices Summary

- **Total Invoices / Invoice Amount / Pending:** Supplier ledger adapter **sirf purchase entries** se invoice banata hai (har purchase entry = ek “invoice” with paid=0). Agar purchase entries filter ho kar chali jayein (e.g. purchase deleted) to ye numbers kam ho sakte hain ya zero.

---

## 3. Data sahi na dikhne ke common reasons

1. **Date range**  
   Default "Last 30 Days" hai. Agar saari activity is range se bahar hai to list empty dikhegi; opening/closing theek ho sakta hai agar pehle entries hain.

2. **Ledger / entity_id mismatch**  
   Dropdown me jo supplier select hai uski **contact id** = `ledger_master.entity_id` honi chahiye. Agar kahi galat contact id pass ho rahi ho ya ledger create hi na hua ho to data nahi aayega.

3. **Entries filter ho rahi hain**  
   - **Purchase:** Agar `ledger_entries` me `source = 'purchase'` aur `reference_id` = koi purchase id hai jo **delete** ho chuki hai, to wo entry **show nahi** hoti.  
   - **Payment:** Agar payment entry ki `reference_id` (payment_id) ko adapter “valid” nahi manta (contact_id / purchase link / ledger ref check), to wo entry **show nahi** hoti.

4. **Ledger / entries create hi nahi hue**  
   - Purchase save hote waqt supplier ledger entry add honi chahiye.  
   - Payment (manual / on-account / purchase-linked) pe supplier ledger sync hona chahiye.  
   Agar ye steps fail ho rahe hon ya kabhi run hi na hue hon to `ledger_entries` empty rahegi.

5. **RLS (Row Level Security)**  
   Agar Supabase RLS se koi row hide ho rahi ho (e.g. company_id / user check) to bhi backend ko kam rows dikhengi.

---

## 4. Quick checks (DB)

Company id: `eb71d817-b87e-4195-964b-7b5321b480f5`. Supplier name "SHD" → pehle contact id nikalein.

```sql
-- Supplier contact id (e.g. SHD)
SELECT id, name, type FROM contacts
WHERE company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  AND (LOWER(name) LIKE '%shd%' OR name = 'SHD');

-- Us contact id ke liye ledger (entity_id = contact id)
SELECT id, entity_id, entity_name, opening_balance
FROM ledger_master
WHERE company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  AND ledger_type = 'supplier'
  AND entity_id = '<yahan_contact_id>';

-- Us ledger ki entries (e.g. last 30 days)
SELECT id, entry_date, source, reference_id, debit, credit, balance_after
FROM ledger_entries
WHERE ledger_id = '<yahan_ledger_id>'
  AND entry_date >= (CURRENT_DATE - INTERVAL '30 days')::text
  AND entry_date <= CURRENT_DATE::text
ORDER BY entry_date DESC;
```

Agar `ledger_master` row nahi hai to ledger create hona chahiye jab first time supplier select karte hain (`getOrCreateLedger`). Agar ledger hai lekin entries 0 hain to purchases/payments post hote waqt supplier ledger sync check karein.

---

## 5. Summary

- **Data source:** `ledger_master` (entity_id = supplier contact id) + `ledger_entries` (date range + valid purchase/payment).  
- **UI:** GenericLedgerView → getSupplierLedgerData → ledgerService (getOrCreateLedger, getLedgerEntries) + ledgerDataAdapters (filter + totals).  
- **Agar data sahi nahi dikh raha:** (1) Date range, (2) correct supplier/entity_id, (3) entries filter (deleted purchase / payment validity), (4) ledger/entries create hona, (5) RLS — in ko step-by-step check karein.  
- **Invoices Summary:** Supplier ledger me abhi “invoices” = purchase entries; agar wo filter ho kar hat rahi hain to summary bhi kam/zero dikhega.
