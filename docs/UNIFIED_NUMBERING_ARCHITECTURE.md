# Unified Document Numbering – Single ERP Engine

## Rule

**Settings → Numbering Rules** is the single source of truth.  
All modules (Web, Mobile, API, POS) use the **same** backend engine. No separate or hardcoded numbering.

```
Settings → Numbering Rules (prefix, digits, year reset, branch based)
        ↓
erp_document_sequences (DB)
        ↓
generate_document_number(company_id, branch_id, document_type, include_year)
        ↓
ALL modules: Sale, Purchase, Payment, Expense, Rental, Studio, POS, Product, Customer, Supplier, Worker, Job
```

## Backend

- **Canonical RPC:** `generate_document_number(p_company_id, p_branch_id, p_document_type, p_include_year)`
  - Reads prefix/digits/year_reset/branch_based from `erp_document_sequences` (synced from Settings).
  - Atomic increment, no duplicates, multi-user safe.
- **Legacy wrapper:** `get_next_document_number(p_company_id, p_branch_id, p_document_type)`  
  Calls `generate_document_number(..., false)` so existing callers use the same engine.

**Migration:** `migrations/unify_document_numbering_single_engine.sql` – run in Supabase so `get_next_document_number` delegates to `generate_document_number`.

## Modules & prefixes (from Settings)

| Module   | Prefix | Type     |
|----------|--------|----------|
| Sale     | SL     | DOCUMENT |
| Purchase | PUR    | DOCUMENT |
| Payment  | PAY    | DOCUMENT |
| Expense  | EXP    | DOCUMENT |
| Rental   | REN    | DOCUMENT |
| Studio   | STD    | DOCUMENT |
| POS      | POS    | DOCUMENT |
| Product  | PRD    | MASTER   |
| Customer | CUS    | MASTER   |
| Supplier | SUP    | MASTER   |
| Worker   | WRK    | MASTER   |
| Job      | JOB    | MASTER   |

## Web

- `documentNumberService.getNextDocumentNumber(companyId, branchId, documentType, includeYear)`  
  → RPC `generate_document_number`.
- Settings save → `setErpDocumentSequence` upserts `erp_document_sequences`.

## Mobile

- `api/documentNumber.ts`: `getNextDocumentNumber(companyId, branchId, documentType, includeYear?)`  
  → RPC `generate_document_number`.
- Sales, Purchases, Expenses, Accounts (payments, journal) use `getNextDocumentNumber`; no local number generation.

## Result

- Mobile sale → e.g. **SL-0023**
- Web sale → **SL-0024**
- POS sale → **SL-0025**  

Same sequence, no duplicates, same Settings rules.
