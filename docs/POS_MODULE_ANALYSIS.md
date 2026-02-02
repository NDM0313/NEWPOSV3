# POS Module – Frontend, Backend & Database

## Overview

POS (Point of Sale) is fully wired to the database: **sell** (create sale), **payment** (record in `payments`), **received** (payment status & accounting), and **stock** (inventory decrement).

---

## Frontend

| File | Role |
|------|------|
| `src/app/components/pos/POS.tsx` | Main POS UI: products grid, cart, customer select, discount, Cash/Card checkout |
| `src/app/context/SalesContext.tsx` | `createSale`, `recordPayment`, `refreshSales` – used by POS |
| `src/app/context/SupabaseContext.tsx` | `companyId`, `branchId`, `user` – required for checkout |
| `src/app/App.tsx` | Renders `<POS />` when `currentView === 'pos'` (and POS module enabled in Settings) |

**POS flow:**
1. Load products (`productService.getAllProducts`) and customers (`contactService.getAllContacts`) from DB.
2. User adds items to cart, sets customer (or Walk-in), discount, then Cash or Card.
3. **Stock check:** Before checkout, each cart item must have `qty ≤ product.stock`; otherwise checkout is blocked.
4. **Checkout:** `createSale(saleData)` with `paymentMethod: 'Cash' | 'Card'`, `status: 'final'`, `paymentStatus: 'paid'`.
5. Success toast shows **real invoice number** from DB (`newSale.invoiceNo`).
6. **Today’s stats** (Total Sales Today, transaction count) are loaded from DB via `saleService.getSalesReport(companyId, today, today)` and refreshed after each sale.

---

## Backend (Services)

| Service | Usage in POS |
|---------|----------------|
| `saleService` | `createSale`, `getSaleById`, `getSalesReport`, `recordPayment`, `getSalePayments` |
| `productService` | Products list, stock check, stock decrement (via SalesContext after sale) |
| `contactService` | Customers list for POS customer dropdown |
| `useDocumentNumbering` (SalesContext) | Invoice number from Settings → Numbering (e.g. INV-0001) |

**SalesContext `createSale` (used by POS):**
1. Generates `invoice_no` via document numbering.
2. Inserts `sales` row and `sales_items` rows via `saleService.createSale`.
3. If `paid > 0`: gets payment account by method (Cash/Card), then `saleService.recordPayment` → inserts into `payments`; then `accounting.recordSalePayment` for ledger.
4. Decrements product stock for each item.
5. Returns the created sale (with `invoiceNo`) so POS can show it in the toast and refresh today’s stats.

---

## Database

| Table | Purpose |
|-------|---------|
| `sales` | One row per invoice: `invoice_no`, `customer_id`, `invoice_date`, `subtotal`, `discount_amount`, `tax_amount`, `total`, `paid_amount`, `due_amount`, `payment_status`, `payment_method`, `status` ('final'), etc. |
| `sales_items` | Line items: `sale_id`, `product_id`, `quantity`, `unit_price`, `total`, etc. |
| `payments` | One row per payment: `reference_type: 'sale'`, `reference_id` = sale id, `amount`, `payment_method` ('cash'/'card'), `payment_account_id`, `payment_date`. Triggers update `sales.paid_amount` / `due_amount` / `payment_status`. |
| `products` | `current_stock` decremented when POS sale is final. |
| `journal_entries` / `journal_entry_lines` | Created by accounting when payment is recorded (customer ledger, cash/bank). |

**Document number:** Invoice number is **not** generated in POS; it comes from **Settings → Numbering** (e.g. Sale prefix + next number). After create, the next number is incremented in settings.

---

## What Works End-to-End

- **Sell:** POS checkout → `createSale` → `sales` + `sales_items` inserted, stock decremented.
- **Payment:** Cash/Card choice → `payment_method` stored on sale; `recordPayment` inserts into `payments`; triggers update sale totals; accounting records payment (received).
- **Received:** Payment is stored as `payment_type: 'received'`, linked to sale; customer ledger and cash/bank updated via accounting.
- **Invoice number:** From DB/document numbering; shown in success toast and used in Sales list / View Sale.
- **Today’s stats:** From DB (`getSalesReport` for today); updated after each POS sale.
- **Stock:** Validated before checkout; decremented after successful sale.

---

## Settings

- **POS module:** Enable in **Settings → Modules** (`posModuleEnabled`) to show POS in nav and allow access.
- **Document numbering:** **Settings → Numbering** – set Sale/Invoice prefix and next number so POS invoices get correct `invoice_no`.
