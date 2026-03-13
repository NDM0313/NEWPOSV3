# ERP Accounting Guardrail Check

**Date:** 2026-03-13  
**Phase:** Final stabilization — confirm all posting uses canonical accounting tables only.

---

## Canonical accounting path

- **accounts** — Chart of accounts.
- **journal_entries** — Double-entry headers (company_id, branch_id, entry_date, reference_type, reference_id).
- **journal_entry_lines** — Lines (journal_entry_id, account_id, debit, credit).

All transactional posting must flow into these three tables. Subsidiary ledgers (**ledger_master**, **ledger_entries**, **worker_ledger_entries**) are kept for supplier/user/worker views but are not the primary books.

---

## Verification summary

| Flow | Posts via | Uses journal_entries + journal_entry_lines? |
|------|-----------|---------------------------------------------|
| **Sales** | Trigger (trigger_auto_post_sale_to_accounting) and/or saleAccountingService | Yes |
| **Purchases** | PurchaseContext / purchaseService on confirm | Yes |
| **Payments** | Triggers (e.g. create_payment_journal_entry) + AccountingContext.createEntry | Yes |
| **Expenses** | AccountingContext.createEntry (expense flow) | Yes |
| **Refunds / sale returns** | refundService, SaleReturnForm — createEntry (reversal) | Yes |
| **Shipment** | shipmentAccountingService.createEntry | Yes |
| **Stock adjustments** | Trigger trigger_post_stock_adjustment_to_accounting | Yes |
| **Manual entries** | ManualEntryDialog → AccountingContext.createEntry | Yes |
| **Studio (stage cost / invoice / worker)** | studioProductionService, studioCustomerInvoiceService, AccountingContext | Yes |
| **Credit notes** | creditNoteService — INSERT journal_entries + journal_entry_lines | Yes |

---

## No posting to legacy paths

- **chart_accounts** / **account_transactions** — Not used by application for posting. Confirmed: chartAccountService uses **accountService** (accounts table only).
- **Reports** — accountingReportsService, DayBookReport, P&L, balance sheet read from **journal_entries**, **journal_entry_lines**, **accounts** only.

---

## Exceptions / notes

- **worker_ledger_entries** — Updated when worker payments are posted (createEntry syncs to worker_ledger_entries). This is intentional; journal remains source of truth for money movement.
- **ledger_master** / **ledger_entries** — Used by ledgerService for supplier/user ledgers; no double-entry posting goes here from sales/purchases/expenses; they are subsidiary views.

---

## Conclusion

All identified posting flows use **accounts** + **journal_entries** + **journal_entry_lines**. No new posting to chart_accounts or account_transactions. Reporting uses canonical structures. Guardrails confirmed.
