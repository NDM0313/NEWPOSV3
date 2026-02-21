# ERP Invoice / Reference Numbering – Technical Architecture

## Executive Summary

**Goal:** 100% centralized, server-side document numbering. No local generation. Multi-device safe. Audit compliant.

---

## STEP 1 – ANALYSIS (Current State)

### 1.1 Mobile App – Current Behavior

| Aspect | Sales (`api/sales.ts`) | Purchases (`api/purchases.ts`) |
|--------|------------------------|-------------------------------|
| **Number source** | Local: `getNextInvoiceNumber()` | Local: `getNextPONumber()` |
| **Flow** | 1. SELECT from `document_sequences`<br>2. Compute next = current + 1<br>3. UPDATE `document_sequences`<br>4. INSERT sale with that number | Same pattern |
| **Race condition** | **YES** – fetch and update are separate. Two devices can get same number. | **YES** – same |
| **Offline** | No offline handling. Fails if no network. | Same |
| **Fallback on error** | `SL-${Date.now().toString(36)}` – timestamp-based, not SL-0001 format | `PUR-${Date.now()...}` |
| **Prefix** | SL- (from document_sequences or fallback) | PUR- (doc type `purchase`) |

### 1.2 Web ERP – Current Behavior

| Aspect | Behavior |
|--------|----------|
| **Number source** | `useDocumentNumbering` hook → reads from Settings (synced from `document_sequences`) |
| **Flow** | 1. `generateDocumentNumber(type)` – sync, uses client-side `nextNumber`<br>2. Create sale/purchase with that number<br>3. `incrementNextNumber(type)` – updates Settings (in-memory + DB) |
| **Race condition** | **YES** – two tabs can read same `nextNumber` before either increments |
| **Atomic** | No – client generates, then persists |

### 1.3 Database – Current State

| Item | Status |
|------|--------|
| `document_sequences` | Exists. Columns: company_id, branch_id, document_type, prefix, current_number, padding |
| **Unique** | `UNIQUE(company_id, branch_id, document_type)` |
| **Triggers** | `set_sale_invoice_number`, `set_purchase_po_number` – **NOT applied** (not in migrations) |
| **RPC** | `get_next_document_number` – **NOT applied** (in functions.sql but not migrations) |
| **sales.invoice_no** | No unique constraint in current schema |
| **purchases.po_no** | No unique constraint in current schema |

### 1.4 Confirmed Facts

- **Branch-based:** Yes – `document_sequences` has `branch_id`; sequences are per (company, branch, type).
- **Company-based unique:** No unique on (company_id, branch_id, invoice_no) for sales.
- **Cancelled reuse:** No explicit rule. Numbers are never decremented; cancelled invoices keep their number. **Reuse not allowed** by design (sequence only increments).

---

## STEP 2 – TARGET ARCHITECTURE

### 2.1 Rules

1. **Mobile never generates** – no local `getNextInvoiceNumber` / `getNextPONumber`.
2. **Server always assigns** – via atomic RPC inside create flow.
3. **Atomic increment** – single DB operation: lock row, increment, return number.
4. **Offline:** Use `TEMP-{uuid}` locally; on sync, server assigns real number and client replaces.
5. **Cancelled:** Number never reused. Sequence only moves forward.
6. **Credit Note, Refund, Payment:** Same central logic (already use `document_sequences` in services).

### 2.2 Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     DOCUMENT CREATE REQUEST                       │
│  (Mobile or Web – invoice_no / po_no = null or omitted)          │
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│  RPC: get_next_document_number(company_id, branch_id, type)      │
│  - SELECT ... FOR UPDATE (lock row)                              │
│  - current_number += 1                                            │
│  - RETURN prefix || LPAD(current_number, padding, '0')            │
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│  INSERT sale/purchase WITH returned number                        │
│  - invoice_no / po_no = value from RPC                            │
└─────────────────────────────────────────────────────────────────┘
```

### 2.3 Offline Flow (Mobile)

```
OFFLINE:
  - Create draft with invoice_no = "TEMP-{uuid}"
  - Store locally (IndexedDB / SQLite)
  - Show "TEMP-xxx" in UI

ON SYNC (when online):
  - Call create API with items, totals, etc. (no invoice_no)
  - Server runs RPC → assigns SL-0001
  - Response: { id, invoiceNo: "SL-0001" }
  - Mobile replaces TEMP-xxx with SL-0001 in local state
  - Print / share uses SL-0001
```

---

## STEP 3 – IMPLEMENTATION

### 3.1 Database

1. **RPC:** `get_next_document_number(p_company_id, p_branch_id, p_document_type)`
   - Uses `SELECT ... FOR UPDATE` or `INSERT ... ON CONFLICT DO UPDATE ... RETURNING`
   - Returns next number atomically.

2. **Unique constraints:**
   - `sales`: `UNIQUE(company_id, branch_id, invoice_no)` – allows same number across branches if needed; typically branch-scoped.
   - `purchases`: `UNIQUE(company_id, branch_id, po_no)`.

3. **Document types in RPC:**
   - sale → SL-
   - purchase → PR- or PUR- (align with web)
   - credit_note → CN-
   - refund → RF-
   - payment → PAY-

### 3.2 Mobile App

1. **Remove** `getNextInvoiceNumber` and `getNextPONumber`.
2. **Do not pass** `invoice_no` / `po_no` in create payload.
3. **Call RPC** before insert, or use Edge Function / API that runs RPC and insert in one transaction.
4. **Preferred:** Single API that:
   - Calls RPC to get next number
   - Inserts sale/purchase with that number
   - Returns `{ id, invoiceNo }` / `{ id, poNo }`

### 3.3 Web ERP

- Use same RPC for numbering.
- `useDocumentNumbering` can call RPC for `generateDocumentNumberSafe` instead of client-side logic.
- Or: create sale/purchase via API that assigns number server-side.

---

## STEP 4 – SYNC SAFETY

1. **After create:** Server returns `invoice_no` / `po_no`; client updates state.
2. **Duplicate prevention:** Unique constraint + conflict handling.
3. **Error on conflict:** Return clear error; client can retry with fresh number (server will assign new one).

---

## Document Type Mapping

| Type | Prefix | Table | Column |
|------|--------|-------|--------|
| sale | SL- | sales | invoice_no |
| purchase | PR- / PUR- | purchases | po_no |
| credit_note | CN- | credit_notes | credit_note_no |
| refund | RF- | refunds | refund_no |
| payment | PAY- | payments | reference_number |

---

## Migration Checklist

- [x] Create `get_next_document_number` RPC with atomic increment
- [ ] Add unique index on sales(company_id, branch_id, invoice_no) – **blocked:** resolve existing duplicates first (run: `SELECT company_id, branch_id, invoice_no, COUNT(*) FROM sales WHERE invoice_no IS NOT NULL GROUP BY 1,2,3 HAVING COUNT(*) > 1`)
- [ ] Add unique index on purchases(company_id, branch_id, po_no) if not exists
- [x] Update mobile sales API – use RPC, no local generation
- [x] Update mobile purchases API – use RPC, no local generation
- [ ] Add offline TEMP-xxx support (future phase)
- [ ] Align web to use same RPC where applicable (optional; web uses useDocumentNumbering + settings sync)
