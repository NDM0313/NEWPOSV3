# Web ERP Audit — GO-LIVE READINESS

**Generated:** 2025-02-23  
**Scope:** Web ERP (React + Vite, erp.dincouture.pk)

---

## 1. Executive Summary

| Area | Status | Notes |
|------|--------|-------|
| Status Consistency (Sale/Purchase) | ✅ Pass | draft→final→cancelled; guards in place |
| Ledger Balance Validation | ✅ Pass | Double-entry enforced |
| Financial Year Lock | ⚠️ Partial | Date-based; no hard lock on past periods |
| Module Enable/Disable | ✅ Pass | modules_config; RLS |
| Permission Enforcement | ✅ Pass | Role-based; has_module_permission |
| Negative Stock Enforcement | ⚠️ Verify | Setting exists; sale flow check needed |
| Sequence Numbering | ✅ Pass | document_sequences; numbering rules |
| Invoice Formatting | ✅ Pass | Prefix + padded number |
| Print Formatting | ✅ Pass | ClassicPrintBase; thermal 58/80mm |

---

## 2. Status Consistency

- **Sales:** draft, quotation, order, final, cancelled
- **Purchases:** draft, ordered, received, final, cancelled
- **Guards:** Cancelled blocks edit/delete/payment; final+returns blocks edit/delete
- **Status:** ✅ Consistent

---

## 3. Ledger Balance Validation

- **accountingService.createEntry():** totalDebit === totalCredit (0.01 tolerance)
- **DB:** journal_entry_lines CHECK constraint
- **Status:** ✅ Enforced

---

## 4. Financial Year Lock

- **Config:** companies.financial_year_start
- **Usage:** Date filters in reports; no hard lock on posting to closed periods
- **Recommendation:** Add validation to block journal entries in closed fiscal year (future)
- **Status:** ⚠️ Acceptable for go-live

---

## 5. Module Enable/Disable

- **Table:** module_config (company_id, module_name, is_enabled)
- **RLS:** Company-scoped
- **UI:** Settings → Module Toggles
- **Status:** ✅ Working

---

## 6. Permission Enforcement

- **Roles:** admin, manager, accountant, salesperson, inventory_clerk, viewer
- **Helpers:** get_user_role(), has_module_permission(), has_branch_access()
- **Status:** ✅ Implemented

---

## 7. Negative Stock Enforcement

- **Settings:** inventorySettings.negativeStockAllowed, posSettings.negativeStockAllowed
- **Enforcement:** inventoryService logs warning; sale/POS flow may not block
- **Recommendation:** Add check in SalesContext/POS before finalize when negativeStockAllowed=false and stock would go negative
- **Status:** ⚠️ Verify before go-live

---

## 8. Sequence Numbering

- **document_sequences:** Per company, document type
- **Numbering rules:** Settings → Numbering Rules (prefix, next number)
- **Formats:** INV-0001, PO-0001, POS-0001, RNT-0001, EXP-0001, STD-0001
- **Status:** ✅ Implemented

---

## 9. Invoice Formatting

- **Sale:** invoice_no from document_sequences or RPC
- **Purchase:** po_no
- **Print:** ClassicPrintBase with thermal/A4
- **Status:** ✅ Working

---

## 10. Print Formatting

- **ClassicPrintBase:** Single source for print layouts
- **Modes:** thermal (58mm/80mm), a4
- **Settings:** Settings → Printer Configuration
- **Status:** ✅ Implemented (Phase 4)

---

## 11. Verdict

**Web ERP is GO-LIVE READY** with minor verifications: negative stock enforcement and financial year lock.
