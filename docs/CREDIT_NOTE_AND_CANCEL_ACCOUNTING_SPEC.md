# Credit Note & Sale Cancellation – Accounting Spec

**Date:** February 2026  
**Status:** Phase 1 – Spec Complete | Phase 2 – Pending Implementation  
**Goal:** Standard ERP accounting for sale cancellation – Credit Note, Refund vs Advance, clear ledger chain

---

## 1. Business Cases

### CASE 1: Credit Sale (10,000) + Partial Payment (5,000)

| Step | Action | Ledger Effect |
|------|--------|---------------|
| Original | Sale SL-001 | Dr AR 10,000 / Cr Sales 10,000 |
| Payment | RV-001 (PAY-xxx) | Dr Cash 5,000 / Cr AR 5,000 |
| **Cancel** | Credit Note CN-001 | Dr Sales Return 10,000 / Cr Customer 10,000 |
| Result | Customer balance | Was 5,000 payable → Now 5,000 advance (we owe customer) |
| **Option A** | Refund RF-001 | Dr Customer 5,000 / Cr Cash 5,000 → Balance zero |
| **Option B** | Keep as Advance | No refund; Customer Advance = 5,000 for future purchase |

### CASE 2: Cash Sale (10,000 full receive)

| Step | Action | Ledger Effect |
|------|--------|---------------|
| Original | Sale SL-001 | Dr AR 10,000 / Cr Sales 10,000 |
| Payment | RV-001 | Dr Cash 10,000 / Cr AR 10,000 |
| **Cancel** | Credit Note CN-001 | Dr Sales Return 10,000 / Cr Customer 10,000 |
| **Refund** | RF-001 | Dr Customer 10,000 / Cr Cash 10,000 → Balance zero |

---

## 2. Standard ERP Rules

| Rule | Description |
|------|-------------|
| **Original entries remain** | Sale, payment journal entries are NOT deleted |
| **Reverse entries post** | Credit Note creates new journal (Dr Sales Return, Cr Customer) |
| **Payment unlink** | Payments unlinked from sale (not deleted); refund or advance flow |
| **Ledger reference chain** | SL-001 → RV-001 → CN-001 → RF-001 visible |
| **Description** | "Reversal of SL-001 (Cancelled)" / "Cancelled against Invoice SL-001" |

---

## 3. Database Schema

### 3.1 Credit Notes Table

```sql
CREATE TABLE credit_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  credit_note_no VARCHAR(50) NOT NULL,        -- CN-001, CN-002
  original_sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE RESTRICT,
  credit_note_date DATE NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  reason TEXT NOT NULL,                        -- cancel_reason
  status VARCHAR(20) NOT NULL DEFAULT 'final' CHECK (status IN ('draft', 'final')),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, branch_id, credit_note_no)
);

CREATE INDEX idx_credit_notes_original_sale ON credit_notes(original_sale_id);
CREATE INDEX idx_credit_notes_company ON credit_notes(company_id);
```

### 3.2 Refunds Table (optional – or use payments with reference_type = 'refund')

```sql
CREATE TABLE refunds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  refund_no VARCHAR(50) NOT NULL,              -- RF-001
  credit_note_id UUID REFERENCES credit_notes(id) ON DELETE RESTRICT,
  customer_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  amount DECIMAL(15,2) NOT NULL,
  refund_date DATE NOT NULL,
  payment_method VARCHAR(50),                 -- cash, bank, etc.
  account_id UUID REFERENCES accounts(id),
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Alternative:** Use `payments` table with `reference_type = 'refund'`, `reference_id = credit_note_id`. Simpler, reuses existing payment/journal flow.

### 3.3 Payment Unlink (no new table)

- Add `cancelled_sale_id UUID` to `payments` (nullable) – when sale cancelled, set `cancelled_sale_id = original reference_id`, `reference_id = NULL`, `reference_type = 'cancelled_sale'` or keep as-is but exclude from ledger for that sale.
- **Simpler:** Add `unlinked_at TIMESTAMPTZ`, `unlinked_reason TEXT` – when cancel, set these. Ledger excludes unlinked payments for that sale's balance calc.

**Recommended:** Don't delete payments. Add:
- `payment_status` or `is_void` – when cancel, mark payment as void/unlinked.
- Ledger: show voided payments with "Reversed" / "Unlinked – Refund/Advance" in description.

---

## 4. Document Numbering

| Document | Prefix | Example | Table |
|----------|--------|---------|-------|
| Sale Invoice | SL- / INV- | SL-001 | sales.invoice_no |
| Payment | PAY- | PAY-001 | payments.reference_number |
| Credit Note | CN- | CN-001 | credit_notes.credit_note_no |
| Refund | RF- | RF-001 | refunds.refund_no or payments |

Add to `document_sequences` or `useDocumentNumbering`:
- `credit_note` → CN-001
- `refund` → RF-001

---

## 5. Cancel Flow (Step-by-Step)

### 5.1 Pre-Check

1. Sale status = final (only final can be cancelled)
2. Sale not already cancelled
3. No existing Credit Note for this sale

### 5.2 If Payments Exist

Show modal:
```
"This invoice has received payments (Rs X). How do you want to handle?"
☐ Refund – Return amount to customer (Cash/Bank)
☐ Keep as Advance – Retain for future purchases
```

### 5.3 Cancel Steps

| Step | Action |
|------|--------|
| 1 | Create Credit Note (CN-001) – amount = sale total |
| 2 | Post journal: Dr Sales Return, Cr Customer (AR) |
| 3 | Reverse stock (same as current – positive qty to restore) |
| 4 | Unlink payments (mark void/unlinked, don't delete) |
| 5 | Update sale: status = 'cancelled', cancelled_at, cancelled_by, cancel_reason |
| 6 | If Refund: Create Refund (RF-001) → Dr Customer, Cr Cash/Bank |
| 7 | If Advance: Create customer advance ledger entry (or use existing advance mechanism) |
| 8 | Activity log: sale_cancelled, credit_note_created, refund_created (if any) |

### 5.4 What NOT to Do

- ❌ Delete sale record
- ❌ Delete payment records
- ❌ Delete original journal entries
- ❌ Delete ledger entries (original remain; new reverse entries added)

---

## 6. Ledger View (Expected)

| Ref No | Description | Debit | Credit |
|--------|-------------|-------|--------|
| SL-001 | Sale Invoice 10,000 | 10,000 | |
| PAY-001 | Payment Received 5,000 | | 5,000 |
| CN-001 | Credit Note – Reversal of SL-001 (Cancelled) | | 10,000 |
| RF-001 | Refund – Against CN-001 | 5,000 | |

**Description format:** `"Reversal of SL-001 (Cancelled)"` or `"Credit Note CN-001 – Cancelled against Invoice SL-001"`

---

## 7. Journal Entry Rules

### Credit Note Journal

```
Dr Sales Return (4010 or 4000)    amount
Cr Accounts Receivable (1100)     amount
Reference: credit_note_id
Description: "Credit Note CN-001 – Reversal of SL-001 (Cancelled)"
```

### Refund Journal

```
Dr Accounts Receivable (1100)     amount
Cr Cash/Bank (1000/1010)          amount
Reference: refund_id
Description: "Refund RF-001 – Against CN-001"
```

### Advance (no refund)

- Customer balance = Credit Note Cr − Payments (unlinked) = negative (we owe)
- Show as "Customer Advance" in ledger
- When future sale: apply advance as payment

---

## 8. API / Service Design

### creditNoteService

- `createCreditNote(saleId, reason, performedBy)` → Credit Note + journal
- `getCreditNoteBySaleId(saleId)`
- `getCreditNotes(companyId, filters)`

### refundService (or extend paymentService)

- `createRefund(creditNoteId, amount, method, accountId, options)` → Refund + journal
- `getRefundsByCreditNote(creditNoteId)`

### cancellationService (update)

- `cancelSale(saleId, options: { reason, performedBy, refundOption: 'refund' | 'advance', refundAmount?, refundMethod?, refundAccountId? })`
  - Creates Credit Note
  - Unlinks payments
  - If refundOption = 'refund': creates Refund
  - If refundOption = 'advance': no refund, advance remains

---

## 9. UI Flow

### Cancel Sale Modal (Enhanced)

1. **Reason** (required): Text input
2. **If paid_amount > 0:** Radio options:
   - Refund Rs X to customer
   - Keep as advance for future purchases
3. **If Refund:** Payment method, Account (Cash/Bank)
4. Confirm → Execute cancel flow

### Ledger Display

- Credit Note row: documentType = 'Credit Note', referenceNo = CN-001, description = "Reversal of SL-001 (Cancelled)"
- Refund row: documentType = 'Refund', referenceNo = RF-001
- isCancelled badge on sale row (optional – or show CN as separate row)

---

## 10. Migration Path (Current → New)

| Current | New |
|---------|-----|
| Delete payments | Unlink (mark void) |
| Delete ledger entries | Keep; add CN + Refund entries |
| Delete journal entries | Keep; add CN + Refund journal |
| sale status = cancelled | Same |
| Stock reverse | Same |

**Backward compatibility:** Existing cancelled sales (pre-migration) may have no CN. Ledger can show "Sale Cancelled" as before. New cancels use full CN + Refund flow.

---

## 11. Phase 2 Implementation Checklist

- [ ] Migration: credit_notes table
- [ ] Migration: refunds table (or use payments)
- [ ] Migration: payment unlink columns (is_void, unlinked_at, unlinked_reason)
- [ ] Document numbering: CN-, RF-
- [ ] creditNoteService
- [ ] refundService (or paymentService.refund)
- [ ] Update cancellationService.cancelSale
- [ ] Update saleService.deleteSaleCascade (cancel path)
- [ ] Cancel modal UI: Refund vs Advance
- [ ] Ledger: Credit Note, Refund rows
- [ ] Activity log: credit_note_created, refund_created
- [ ] Customer advance handling (if keep as advance)

---

## 12. References

- ERP_DELETE_ANALYSIS_AND_SAFE_SYSTEM_PLAN.md
- sale_returns_module (existing – for product returns, different from cancellation)
- CORE_ACCOUNTING_BACKBONE_RULES.md
