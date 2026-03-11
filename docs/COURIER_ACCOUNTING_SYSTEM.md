# Courier Accounting System

This document describes the ERP shipping and courier-ledger accounting implementation.

## Overview

The system integrates shipment costs and customer shipping charges with double-entry bookkeeping. Each courier has a **dedicated payable sub-ledger** (account 2031, 2032, …) under the **Courier Payable Control** account (2030). Shipment creation and courier payments generate journal entries automatically.

---

## 1. Shipping Accounting Flow

### A. Customer shipping charge

When a shipment has **charged_to_customer** > 0:

| Debit | Credit | Amount |
|-------|--------|--------|
| Accounts Receivable (2000) | — | charged_to_customer |
| — | Shipping Income (4100) | charged_to_customer |

- **Reference:** `journal_entries.reference_type = 'shipment'`, `reference_id = sale_shipments.id`
- **Effect:** Increases AR (customer owes) and records shipping revenue.

### B. Courier expense (per-courier ledger)

When a shipment has **actual_cost** > 0:

| Debit | Credit | Amount |
|-------|--------|--------|
| Shipping Expense (5100) | — | actual_cost |
| — | Courier Payable (2031 / 2032 / …) | actual_cost |

- The **credit** is posted to the **courier-specific** account (e.g. TCS Payable 2031, Leopard Payable 2032), not the control account 2030.
- The courier account is created on first use via `get_or_create_courier_payable_account(company_id, contact_id, contact_name)`.

### C. Courier payment

When the business pays a courier (Accounting → Payables → Pay Courier):

| Debit | Credit | Amount |
|-------|--------|--------|
| Courier Payable (specific courier account) | — | amount |
| — | Cash (1000) or Bank (1010) | amount |

- **Reference:** `reference_type = 'courier_payment'`, `reference_id = contacts.id` (courier contact).
- **Effect:** Reduces courier payable and reduces cash/bank.

---

## 2. Courier Payable Structure (Chart of Accounts)

- **2030** — Courier Payable (Control)  
  - Parent account; no direct posting. Used for grouping.

- **2031, 2032, 2033, …** — Per-courier sub-ledgers  
  - One account per courier contact (e.g. TCS Payable, Leopard Payable).  
  - `accounts.contact_id` links the account to `contacts.id`.  
  - Created automatically when the first shipment or payment references that courier.

---

## 3. Shipment Ledger Design

### Tables

- **sale_shipments**  
  - `sale_id`, `company_id`, `branch_id`, `courier_id` (FK to contacts), `courier_name`, `charged_to_customer`, `actual_cost`, `shipment_status`, etc.

- **shipment_history**  
  - One row per status/update: `shipment_id`, `status`, `tracking_number`, `courier_name`, `charged_to_customer`, `actual_cost`, `notes`, `created_by`, `created_at`.  
  - Used for audit and “Shipment History” in the UI.

### Views

- **courier_ledger**  
  - Date-wise ledger for courier payable accounts: `company_id`, `date`, `courier_name`, `courier_id`, `shipment_id`, `description`, `debit`, `credit`, **balance** (running).  
  - Source: `journal_entry_lines` + `journal_entries` + `accounts` (filter: accounts with `contact_id` and code 203x).

- **courier_summary**  
  - Per-courier totals: `company_id`, `courier_id`, `courier_name`, `total_shipments`, `total_expense`, `total_paid`, **balance_due**.  
  - Used for Courier Summary report and Pay Courier modal.

- **shipment_ledger**  
  - Per-shipment view: `shipment_id`, `courier_id`, `courier_name`, `date`, `shipping_income`, `shipping_expense`, `courier_payable`, `journal_entry_id`, `entry_no`.  
  - Joins `sale_shipments` with journal entries where `reference_type = 'shipment'`.

---

## 4. Journal Entry Examples

### Example 1: Shipment created (customer charged 300, TCS cost 280)

- Dr Accounts Receivable (2000) 300  
- Cr Shipping Income (4100) 300  
- Dr Shipping Expense (5100) 280  
- Cr TCS Payable (2031) 280  

Single journal entry, `reference_type = 'shipment'`, `reference_id = shipment.id`.

### Example 2: Pay TCS 1,000

- Dr TCS Payable (2031) 1,000  
- Cr Cash (1000) 1,000  

`reference_type = 'courier_payment'`, `reference_id = TCS contact_id`.

---

## 5. Courier Payment Workflow

1. User opens **Accounting → Payables** and clicks **Pay Courier**.
2. Modal loads couriers with **balance_due > 0** from `courier_summary`.
3. User selects courier, amount, payment method (Cash/Bank), optional notes.
4. On submit, `shipmentAccountingService.recordCourierPayment()`:
   - Resolves or creates the courier’s payable account (203x).
   - Resolves Cash or Bank account from payment method.
   - Creates one journal entry: Dr Courier Payable, Cr Cash/Bank.
5. Payable balance for that courier decreases by the payment amount.

---

## 6. Database Objects Used

| Object | Type | Purpose |
|--------|------|--------|
| `accounts` | table | Chart of accounts; 2030 + 2031, 2032, … with `contact_id` |
| `journal_entries` | table | Header: company, date, reference_type, reference_id |
| `journal_entry_lines` | table | Lines: account_id, debit, credit, description |
| `sale_shipments` | table | Shipment header; links to sale and courier contact |
| `shipment_history` | table | Log of shipment status/field changes |
| `get_or_create_courier_payable_account` | function | Returns account id for courier (2031, 2032, …) |
| `courier_ledger` | view | Date-wise ledger for courier payable accounts |
| `courier_summary` | view | Per-courier totals and balance_due |
| `shipment_ledger` | view | Per-shipment shipping income/expense/payable |

---

## 7. Chart of Accounts (Relevant Codes)

| Code | Name | Type | Use |
|------|------|------|-----|
| 1000 | Cash | Asset | Courier payment (credit) |
| 1010 | Bank | Asset | Courier payment (credit) |
| 2000 | Accounts Receivable | Asset | Customer shipping charge (debit) |
| 2030 | Courier Payable (Control) | Liability | Parent only |
| 2031+ | TCS Payable, Leopard Payable, … | Liability | Courier sub-ledgers |
| 4100 | Shipping Income | Revenue | Customer shipping charge (credit) |
| 5100 | Shipping Expense | Expense | Courier cost (debit) |

---

## 8. Reversals

- **Shipment deleted:** A reversal journal entry is created that debits the same courier payable account and credits Shipping Expense (and reverses AR/Shipping Income if applicable). The correct courier account is found via `getCourierPayableAccountIdForShipment(shipmentId)` from the original shipment entry.

---

## 9. Frontend Entry Points

- **Accounting → Payables:** “Pay Courier” button opens Pay Courier modal.
- **Accounting → Courier Reports:** Courier Summary, Courier Ledger (with courier filter and pagination), Shipment Ledger.
- **Sale / Studio Sale Detail:** Shipment section; creating/updating shipment creates journal entries and writes to `shipment_history`. Shipment History panel can be shown per shipment.

---

## 10. Migrations

- **shipping_accounting_full_integration.sql** — Base shipment columns, accounts (2030, 4100, 5100, etc.), `shipment_history` table, `shipment_ledger` view, indexes.
- **courier_ledger_accounting.sql** — `accounts.contact_id` / `parent_id`, 2030 renamed to Control, `get_or_create_courier_payable_account`, `courier_ledger` and `courier_summary` views, indexes.
- **shipping_accounting_performance_indexes.sql** — Extra indexes for company + reference_type and shipment_history date range.
