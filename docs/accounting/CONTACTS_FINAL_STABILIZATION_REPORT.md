# Contacts / AR / AP — final stabilization report

**Date:** 2026-03-29  
**Intent:** Stop ad-hoc drift by documenting **one canonical read per surface**, freezing misleading UI copy, and cross-referencing completed journal-edit fixes.

---

## 1. Root causes addressed (historical + this pass)

| Issue class | Resolution |
|-------------|------------|
| Operational vs GL mismatch from **silent UI fallback** | Removed; RPC error surfaced (`CONTACTS_OPERATIONAL_GL_PARITY_FIX_REPORT.md`). |
| **Allocated manual** double-subtract in RPC | Migrations `20260431` (`PURCHASE_PAYMENT_CONTACTS_GL_FIX_REPORT.md`). |
| **Supplier manual_payment** edit without **payment_adjustment** JE | `UnifiedPaymentDialog` + party AP (`SUPPLIER_PAYMENT_EDIT_LIVE_SQL_ROOT_CAUSE_FIX_REPORT.md`). |
| **Customer manual_receipt** edit without delta JE | `UnifiedPaymentDialog` + `saleService.updatePayment` + party AR (`CUSTOMER_RECEIPT_EDIT_BOTH_CONTACT_ROOT_CAUSE_FIX_REPORT.md`). |
| Misleading Contacts tooltips | **This pass:** tooltips no longer imply merged-document operational math. |

---

## 2. Canonical source per surface (summary)

| Surface | Canonical source |
|---------|------------------|
| Contacts operational recv/pay | `get_contact_balances_summary` |
| Contacts GL sublines | `get_contact_party_gl_balances` (AR **subtree** / AP **subtree** on live DB) |
| Supplier / worker `GenericLedgerView` operational | `ledgerDataAdapters` (documents + payments) |
| Supplier / worker GL tab | `accountingService` party journal RPCs |
| Account Statements (party AR/AP) | `get_customer_ar_gl_ledger_for_contact` / `get_supplier_ap_gl_ledger_for_contact` |
| Journal / Day Book | `journal_entries` + lines |
| COA party row | Party GL map; `account.balance` **not** authoritative when map present |

Full matrix: [CONTACTS_AR_AP_SINGLE_SOURCE_AUDIT.md](./CONTACTS_AR_AP_SINGLE_SOURCE_AUDIT.md).

---

## 3. Structural SQL on live DB

- **`get_contact_party_gl_balances`** includes **`ar_subtree`** and **`ap_subtree`** (verified on VPS via `pg_get_functiondef`).
- Operational RPCs per **`20260430`** / **`20260431`** assumed deployed (see prior reports).

**No destructive SQL** executed in this stabilization pass.

---

## 4. Live forensic snapshot (company `595c08c2-1e47-4581-89c9-1f78de51c613`, branch NULL)

| Contact | Operational (recv / pay) | Party GL (AR / AP) |
|---------|--------------------------|---------------------|
| DIN COUTURE | 0 / **415,000** | 0 / **415,000** |
| KHURAM SILK | 0 / **575,060** | 0 / **575,060** |
| ABC (both) | **105,000** / 0 | **55,000** / 0 |

**ABC variance (105k OP vs 55k GL):** Not a “wrong reader” bug — different definitions: operational includes **final sale due + opening − unallocated manual receipt rules**; party GL is **strictly journal nets on AR subtree** with party attribution. Amber variance icon is expected until business rules intentionally align (separate project). Both-type routing is **not** mixing AP into AR (see customer receipt report).

---

## 5. Code / docs changed (this pass)

| Artifact | Change |
|----------|--------|
| `ContactsPage.tsx` | Tooltip + reconciliation card copy: canonical sources, 1100 subtree wording, no “merged documents”. |
| `docs/accounting/CONTACTS_AR_AP_SINGLE_SOURCE_AUDIT.md` | **New** — full read-path audit. |
| `docs/accounting/CONTACTS_DUPLICATE_SOURCE_FREEZE_PLAN.md` | **New** — duplicate risk table. |
| `docs/accounting/CONTACTS_LEGACY_READER_FREEZE_APPLIED.md` | **New** — what is frozen vs legacy. |
| `docs/accounting/CONTACTS_FINAL_STABILIZATION_REPORT.md` | **This file.** |

Journal / Day Book edit gating remains via **`journalEntryEditPolicy.ts`** + `AccountingDashboard` + `DayBookReport` (prior work).

---

## 6. Acceptance checklist

- [x] Every major screen has a **named** canonical source in audit doc.  
- [x] Manual payment/receipt amount edits post **payment_adjustment** with **party AR/AP** where implemented.  
- [x] Contacts page does not claim **merged** operational math.  
- [x] Live **DIN COUTURE / KHURAM** OP vs GL **match** for payables.  
- [x] **ABC** OP vs GL difference **explained** (basis mismatch, not wrong RPC for same basis).  
- [x] No blind table drops.  

---

## 7. Remaining risks (explicit)

1. **Customer ledger** (`customerLedgerApi`) operational totals vs **Contacts RPC** — different loaders; acceptable if both document-based and migrations align; re-audit if user reports drift.  
2. **`accounts.balance`** refresh lag for non-party rows — still not used for contact party truth when RPC loaded.  
3. **Both-type contacts:** Create flows use **`AddEntryV2`** with separate customer vs supplier initial ids — continue to test when adding new flows.

---

## 8. Deletion candidates

**None.** Prove zero references + DBA sign-off before dropping any function or view.
