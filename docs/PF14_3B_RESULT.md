# PF-14.3B – Journal Entry Presentation Fix for Posted Sale Edits

**Status:** Implemented  
**Mode:** Production-safe, accounting-safe, audit-safe  
**Scope:** Presentation and grouping only; customer ledger and underlying accounting unchanged.

---

## 1. Root-cause analysis

**Problem:** When a posted sale was edited, the customer ledger correctly showed the final effective sale. In the **Journal Entries** list, however, the original sale JE and the new sale_adjustment / payment_adjustment JEs appeared as **separate top-level rows**. To the user it looked like extra sales or unrelated documents instead of one sale with an edit trail.

**Cause:** The journal list was a flat list of all `journal_entries` (one row per JE). There was no notion of a “root document” or grouping, so:

- `reference_type = 'sale'`, `reference_id = sale_id` → one row  
- `reference_type = 'sale_adjustment'`, `reference_id = sale_id` → another row  
- `reference_type = 'payment_adjustment'`, `reference_id = payment_id` → another row  

All were shown as independent rows with no link to the original sale.

**Fix:** Keep immutable accounting (no deletion or overwrite of JEs). Add **root-document grouping** in the app and change the **default Journal Entries view** to one logical row per document (e.g. per sale), with the full audit trail (original + adjustments) available when that row is opened.

---

## 2. Files changed

| File | Change |
|------|--------|
| `src/app/services/accountingService.ts` | `getAllEntries`: include `payment_adjustment` in payment-id collection and validation; enrich each JE with `root_reference_type` and `root_reference_id` (sale/purchase from `reference_id` or via `payments` for payment/payment_adjustment). No DB schema change. |
| `src/app/context/AccountingContext.tsx` | `AccountingEntry.metadata`: add `rootReferenceId`, `rootReferenceType`. `convertFromJournalEntry`: read root from raw JE; map `sale_adjustment` → Sale, `payment_adjustment` → Payment for display. |
| `src/app/components/accounting/AccountingDashboard.tsx` | Journal Entries: state `journalViewMode` ('grouped' \| 'audit'), `selectedGroupEntries`; build `groupedJournalRows` by root key; default view = one row per group (primary + “+N” adjustments); “By document” / “All entries (audit)” toggle; pass `groupEntries` into detail modal on grouped row click. |
| `src/app/components/accounting/TransactionDetailModal.tsx` | New prop `groupEntries?: AccountingEntry[]`; when present and length > 1, show “Document trail (same sale / payment)” with Original sale / Sale edit / Payment edit labels and amounts. |
| `src/app/components/reports/DayBookReport.tsx` | Label sale_adjustment / payment_adjustment in description: append “ (sale edit)” or “ (payment edit)” so Day Book clearly shows these as edits of the same document. |
| `scripts/verify-pf14-3b-journal-grouping.sql` | Verification queries: JEs by reference_type, payment_adjustment → sale_id via payments, and sale_ids with multiple JEs (grouping candidates). |

---

## 3. Minimal migration

**None.** Root linkage is computed in the application from existing columns (`journal_entries.reference_type`, `reference_id`, and `payments.reference_type`, `reference_id`). No new columns or tables.

---

## 4. Journal grouping implementation

- **Root key:**  
  - Sale / sale_adjustment: `root_reference_type = 'sale'`, `root_reference_id = reference_id` (sale_id).  
  - Payment / payment_adjustment: root resolved via `payments` (id = JE `reference_id`, then `payments.reference_id` = sale_id when `reference_type = 'sale'`).  
  - Purchase: root = `reference_id` (purchase_id).  
- **Service:** In `getAllEntries`, after filtering valid entries, each returned JE is enriched with `root_reference_type` and `root_reference_id` (and passed through to `AccountingEntry.metadata`).  
- **Dashboard:** Entries are grouped by `(rootReferenceType, rootReferenceId)` (fallback to `referenceType/referenceId` or `single:id`). Primary row per group = sale > purchase > payment > earliest by date. Default view shows one row per group with “+N” when there are adjustments; “All entries (audit)” shows the previous flat list.

---

## 5. Journal detail / expand (document trail)

- When the user opens a row from the **grouped** view, the dashboard passes that group’s entries as `groupEntries` to `TransactionDetailModal`.  
- The modal shows a **“Document trail (same sale / payment)”** section: all entries in the group sorted by date, with labels “Original sale”, “Sale edit”, “Payment edit”, “Payment”, etc., plus reference no, date, description, and amount.  
- The primary transaction (loaded by `referenceNumber`) is still shown in full below; the trail makes it clear these are one logical document with an edit history.

---

## 6. Day Book

- Day Book already mapped `sale_adjustment` → “Sale” and `payment_adjustment` → “Payment”.  
- Added description suffix: “ (sale edit)” or “ (payment edit)” so each line is clearly an edit of the same document, not a new sale.

---

## 7. Verification

- Run `scripts/verify-pf14-3b-journal-grouping.sql` (optionally with your `company_id`):  
  - Confirms JEs by type and that payment_adjustment can be joined to sales via `payments`.  
  - Confirms sale_ids with multiple JEs (expected to be grouped into one logical row in the default journal view).

**Acceptance:**

- Editing a posted sale does **not** appear as a new extra sale in the Journal Entries **default** view (one logical row per sale).  
- Customer ledger is **unchanged** and still shows the final effective edited sale.  
- Original JE is **preserved**; adjustment JEs remain.  
- Raw adjustment entries are available in **“All entries (audit)”** and in the **document trail** in the detail modal.  
- Default view shows **one logical sale thread** per sale; payment edit adjustments are grouped under the same logical document/payment thread.  
- **No loss of audit trail** and no destructive overwrite of the original JE.

---

## 8. Global pattern (future)

The same pattern (root key + grouped default view + audit view + document trail in detail) can be applied to:

- Purchases (and purchase adjustments, if any)  
- Rentals, Studio, Expenses, Worker payments, Transfers  

as those flows get edit/adjustment JEs. This task implemented it for **Sales** (sale + sale_adjustment + payment_adjustment).
