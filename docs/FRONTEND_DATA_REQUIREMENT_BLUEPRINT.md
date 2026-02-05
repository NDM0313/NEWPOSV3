# Frontend Data Requirement Blueprint

**Single source of truth for what each screen needs from the database.**  
No SQL seed in this phase — audit only.

---

## 1. Products + Variations

| Item | Detail |
|------|--------|
| **Screen name** | Products Page (`ProductsPage`) |
| **Data needed** | Product list with category, SKU, name, prices, stock, low-stock threshold; optional variations per product; branch/company filter. |
| **Tables** | `products`, `product_categories`, `product_variations` |
| **Mandatory relations** | `products.company_id` → company; `products.category_id` → `product_categories.id`; `product_variations.product_id` → `products.id`. Products must have `is_active = true` for listing. |

**Screens / flows:** Product list, View Product Details drawer (product + variations + stock), Add/Edit Product (category required), Adjust Price, Adjust Stock, Stock History (uses `stock_movements`).

---

## 2. Inventory

| Item | Detail |
|------|--------|
| **Screen name** | Inventory Dashboard / Stock Overview (`InventoryDashboard`, `InventoryDashboardNew`) |
| **Data needed** | Per-product: id, sku, name, category, current stock, boxes/pieces (if `inventory_balance` exists), min/reorder level, cost/selling price, stock value, status (Low/OK/Out), movement (Fast/Slow/Medium/Dead). Stock movements for analytics tab. |
| **Tables** | `products`, `product_categories`, `inventory_balance` (optional), `stock_movements` |
| **Mandatory relations** | `products.company_id`; `products.category_id` → `product_categories.id`; `inventory_balance.product_id` → `products.id`; `stock_movements.product_id` → `products.id`, `reference_type`/`reference_id` for traceability. |

**Note:** If `inventory_balance` is missing, overview falls back to `products.current_stock` and 0 boxes/pieces.

---

## 3. Regular Sale (SL)

| Item | Detail |
|------|--------|
| **Screen name** | Sales List, Add/Edit Sale (`SaleForm`), View Sale |
| **Data needed** | Sale header: invoice_no (SL-xxxx), customer_id, customer_name, dates, totals, paid/due, status, payment_status; items with product/variation, qty, price, discount, tax. |
| **Tables** | `sales`, `sales_items` (or `sale_items` fallback), `contacts`, `products`, `product_variations` |
| **Mandatory relations** | `sales.company_id`, `sales.branch_id`, `sales.customer_id` → `contacts.id` (type customer), `sales.created_by` → user; `sales_items.sale_id` → `sales.id`, `sales_items.product_id` → `products.id`, `sales_items.variation_id` → `product_variations.id` (optional). |

**Reference:** `invoice_no` = SL-xxxx from document_sequences. Customer ledger driven by sales + payments.

---

## 4. Studio Sale (STD)

| Item | Detail |
|------|--------|
| **Screen name** | Studio Sales List (`StudioSalesListNew`), Studio Sale Detail (`StudioSaleDetailNew`) |
| **Data needed** | Studio “sale” can be from `sales` (is_studio = true) with invoice_no STD-xxxx, or legacy `studio_orders`. Customer, items, totals, paid/due, production status. Link to productions and stages. |
| **Tables** | `sales` (is_studio), `sales_items`, `studio_productions`, `studio_production_stages`, `contacts`, `products` |
| **Mandatory relations** | `sales.company_id`, `sales.branch_id`, `sales.customer_id` → contacts; `studio_productions.sale_id` → `sales.id`; `studio_production_stages.production_id` → `studio_productions.id`. |

**Reference:** STD-xxxx from document_sequences. Customer ledger shows STD sales and payments.

---

## 5. Sale Items

| Item | Detail |
|------|--------|
| **Screen name** | Inline in Sale Form / View Sale / Studio Sale Detail |
| **Data needed** | Line items: product_id, variation_id, product_name, sku, quantity, unit_price, discount, tax, total; packing fields optional. |
| **Tables** | `sales_items` (primary) or `sale_items`, `products`, `product_variations` |
| **Mandatory relations** | `sales_items.sale_id` → `sales.id`; `sales_items.product_id` → `products.id`; `variation_id` optional → `product_variations.id`. |

---

## 6. Studio Production

| Item | Detail |
|------|--------|
| **Screen name** | Studio Production List, Add Production (`StudioProductionAddPage`), Production Detail (`StudioProductionDetailPage`) |
| **Data needed** | Production: production_no, sale_id, product_id, variation_id, quantity, unit, estimated/actual cost, status (draft/in_progress/completed/cancelled), dates, assigned_worker; product and worker names for display. |
| **Tables** | `studio_productions`, `sales`, `products`, `product_variations`, `workers` |
| **Mandatory relations** | `studio_productions.company_id`, `studio_productions.branch_id`, `studio_productions.sale_id` → `sales.id`, `studio_productions.product_id` → `products.id`, `studio_productions.assigned_worker_id` → `workers.id` (optional). |

**Reference:** Production is always linked to a sale (STD). Completion creates stock_movements and can create worker_ledger_entries via stages.

---

## 7. Studio Stages (Dyeing / Stitching / Handwork)

| Item | Detail |
|------|--------|
| **Screen name** | Inside Production Detail, Studio Workflow (`StudioWorkflowPage`) |
| **Data needed** | Stage: stage_type (dyer / stitching / handwork), assigned_worker_id, cost, status (pending / in_progress / completed), dates, notes; worker name; production_no and sale ref for display. |
| **Tables** | `studio_production_stages`, `studio_productions`, `workers`, `sales` |
| **Mandatory relations** | `studio_production_stages.production_id` → `studio_productions.id`; `studio_production_stages.assigned_worker_id` → `workers.id` (optional). When stage completed, worker_ledger_entries created with reference_id = stage id, document_no = JOB-xxxx. |

**Reference:** Stage completion creates JOB-xxxx and worker ledger entry (unpaid until payment).

---

## 8. Workers + Categories

| Item | Detail |
|------|--------|
| **Screen name** | Contacts (filter Worker), Worker Detail (`WorkerDetailPage`), Studio dropdowns for assign worker |
| **Data needed** | Worker: id, name, phone, worker_type (e.g. dyer, stitching, handwork), payment_type, rate, current_balance, is_active. Categories via contact_groups or worker_type. |
| **Tables** | `workers`, `contacts` (if workers synced from contacts), `contact_groups` (optional) |
| **Mandatory relations** | `workers.company_id`. For Worker Detail and ledger: `worker_ledger_entries.worker_id` → `workers.id`; stages reference `workers.id` for assigned_worker_id. |

**Note:** Workers are production-only; not users. Ledger = worker_ledger_entries (JOB + PAY).

---

## 9. Worker Jobs + Ledger

| Item | Detail |
|------|--------|
| **Screen name** | Worker Detail ledger tab, Ledger Hub (Worker Ledger), Accounting Dashboard → Ledger → Worker |
| **Data needed** | Ledger rows: date, reference (JOB-xxxx / PAY-xxxx), description (stage type, production/sale ref), debit/credit, running balance; unpaid vs paid. |
| **Tables** | `worker_ledger_entries`, `studio_production_stages` (for stage_type, production_no, sale_id), `workers` |
| **Mandatory relations** | `worker_ledger_entries.company_id`, `worker_ledger_entries.worker_id` → `workers.id`; `worker_ledger_entries.reference_id` → `studio_production_stages.id` for job rows; document_no = JOB-xxxx; payment_reference = PAY-xxxx when paid. |

**Reference:** Every job entry has document_no (JOB-xxxx). Payment entry has payment_reference (PAY-xxxx).

---

## 10. Purchases + Supplier Ledger

| Item | Detail |
|------|--------|
| **Screen name** | Purchases List (`PurchasesPage`), Add/Edit Purchase, View Purchase, Supplier Ledger (Ledger Hub / Accounting) |
| **Data needed** | Purchase: po_no (PUR-xxxx), supplier_id, supplier_name, dates, totals, paid/due, status; items with product, qty, price. Supplier ledger: ledger_master + ledger_entries (source = purchase | payment), reference_no = PUR-xxxx or payment ref. |
| **Tables** | `purchases`, `purchase_items`, `contacts` (supplier), `products`, `branches`, `users`; for ledger: `ledger_master`, `ledger_entries` |
| **Mandatory relations** | `purchases.company_id`, `purchases.branch_id`, `purchases.supplier_id` → `contacts.id` (type supplier); `purchase_items.purchase_id` → `purchases.id`, `purchase_items.product_id` → `products.id`. Ledger: `ledger_master.entity_id` = supplier_id, ledger_type = 'supplier'; entries reference purchase (PUR) or payment. |

**Reference:** PUR-xxxx for purchase; PAY-xxxx for supplier payment. No orphan ledger entries.

---

## 11. Expenses + User Ledger

| Item | Detail |
|------|--------|
| **Screen name** | Expenses List (`ExpensesList`), Add/Edit Expense, User Ledger (Ledger Hub / Accounting) |
| **Data needed** | Expense: expense_no (EXP-xxxx), category (salary/commission/bonus/advance/other), amount, payment_method, payment_account_id, paid-to user (for salary etc.), dates, status. User ledger: ledger_master + ledger_entries (source = expense | payment | salary | commission | bonus). |
| **Tables** | `expenses`, `accounts`, `users`; for ledger: `ledger_master`, `ledger_entries` |
| **Mandatory relations** | `expenses.company_id`, `expenses.branch_id`, `expenses.created_by` → user. User ledger: `ledger_master.entity_id` = user id, ledger_type = 'user'; entries from expense (debit) and payment (credit). Expense with category salary/commission/bonus and paidToUserId creates user ledger debit. |

**Reference:** EXP-xxxx for expense; PAY-xxxx for user (staff) payment. User ≠ Worker; salary/expense ledger only for users.

---

## 12. Payments (Customer / Supplier / Worker)

| Item | Detail |
|------|--------|
| **Screen name** | Payment dialogs from Sale (customer), Purchase (supplier), Worker (Pay Now), Rental; Unified Payment Dialog |
| **Data needed** | Payment: amount, method, account_id, reference_number (PAY-xxxx), reference_id (sale/purchase/rental/worker), date. Posted to journal + ledger (customer/supplier/user) or worker_ledger_entries (mark paid). |
| **Tables** | `payments`, `accounts`, `journal_entries`, `journal_entry_lines`; for customer/supplier/user: `ledger_entries`; for worker: `worker_ledger_entries` |
| **Mandatory relations** | `payments` has reference_id (sale_id/purchase_id/rental_id) and optional link to entity; PAY-xxxx from document_sequences. Customer: sale + payment → ledger_entries (via accounting). Supplier: purchase + payment → ledger_master (supplier) + ledger_entries. Worker: payment → worker_ledger_entries.status = paid, payment_reference = PAY-xxxx. User: expense + payment → ledger_master (user) + ledger_entries. |

**Reference:** Every payment has a reference_number (PAY-xxxx). No standalone payment without linked sale/purchase/expense/worker/rental.

---

## 13. Accounting Overview

| Item | Detail |
|------|--------|
| **Screen name** | Accounting Dashboard (`AccountingDashboard`), Chart of Accounts, Account Ledger, Ledger Hub, Manual Entry, Reports |
| **Data needed** | Accounts list (type, name, code, balance); journal entries and lines; links to sales, purchases, payments; ledger views (customer/supplier/user/worker) with same shape as Customer Ledger API / ledgerDataAdapters. |
| **Tables** | `accounts`, `journal_entries`, `journal_entry_lines`, `sales`, `purchases`, `payments`, `ledger_master`, `ledger_entries`, `worker_ledger_entries`; for ledger drill-down: `studio_production_stages` (worker refs) |
| **Mandatory relations** | `journal_entry_lines.account_id` → `accounts.id`, `journal_entry_lines.journal_entry_id` → `journal_entries.id`; `journal_entries.reference_type`/`reference_id` or `payment_id` for traceability; accounts belong to company. All ledger data comes from modules (no manual ledger-only inserts for sale/purchase/expense/payment/job). |

**Reference:** Transactions tab shows entries with source (Sale, Purchase, Expense, Rental, Studio, Manual). Ledger Hub uses same adapters as Supplier/User/Worker ledgers.

---

## 14. Rental (if enabled)

| Item | Detail |
|------|--------|
| **Screen name** | Rentals Page (`RentalsPage`), New Rental Booking (`NewRentalBooking`), Rental Dashboard, Rental Drawer |
| **Data needed** | Rental: rental_no (RNT-xxxx), customer_id, customer_name, start/expected return/actual return dates, status (draft/rented/returned/overdue/cancelled), total/paid/due; rental_items (product_id, qty, rate, total); rental_payments. |
| **Tables** | `rentals`, `rental_items`, `rental_payments`, `contacts`, `products`, `stock_movements` (rental_out / rental_in) |
| **Mandatory relations** | `rentals.company_id`, `rentals.branch_id`, `rentals.customer_id` → contacts; `rental_items.rental_id` → `rentals.id`, `rental_items.product_id` → `products.id`; `rental_payments.rental_id` → `rentals.id`. When module enabled: settings.modules_config (rentals) and document_sequences for rental prefix. |

**Reference:** RNT-xxxx from document_sequences. Payments via Unified Payment Dialog (context = rental). Accounting can record rental booking/delivery/return.

---

## Summary Table (Quick Reference)

| Module | Screen(s) | Core tables | Mandatory relations |
|--------|-----------|-------------|---------------------|
| Products + Variations | Products Page | products, product_categories, product_variations | company_id, category_id, variations.product_id |
| Inventory | Inventory Dashboard | products, product_categories, inventory_balance?, stock_movements | product_id, category_id, reference_type/id |
| Regular Sale (SL) | Sales List, Sale Form | sales, sales_items, contacts, products | company_id, branch_id, customer_id, sale_id, product_id |
| Studio Sale (STD) | Studio Sales List, Sale Detail | sales, sales_items, studio_productions, stages, contacts | sale_id → sales, production.sale_id, stage.production_id |
| Sale Items | Inline in Sale/Studio | sales_items, products, product_variations | sale_id, product_id |
| Studio Production | Production List/Add/Detail | studio_productions, sales, products, workers | sale_id, product_id |
| Studio Stages | Production Detail, Workflow | studio_production_stages, studio_productions, workers | production_id, assigned_worker_id |
| Workers + Categories | Contacts, Worker Detail | workers, contacts?, contact_groups? | company_id, worker_id in ledger/stages |
| Worker Jobs + Ledger | Worker Detail, Ledger Hub | worker_ledger_entries, studio_production_stages, workers | worker_id, reference_id (stage), document_no JOB, payment_reference PAY |
| Purchases + Supplier Ledger | Purchases Page, Ledger | purchases, purchase_items, contacts, ledger_master, ledger_entries | supplier_id, purchase_id, ledger_type=supplier, entity_id=supplier |
| Expenses + User Ledger | Expenses List, Ledger | expenses, ledger_master, ledger_entries, users | company_id, created_by; user ledger entity_id=user, ledger_type=user |
| Payments | Payment dialogs | payments, journal_entries/lines, ledger_entries, worker_ledger_entries | reference_number PAY, reference_id to sale/purchase/expense/worker/rental |
| Accounting Overview | Accounting Dashboard | accounts, journal_entries, journal_entry_lines, + all ledger tables | account_id, journal_entry_id; all refs from modules |
| Rental | Rentals Page, Booking | rentals, rental_items, rental_payments, contacts, products | company_id, branch_id, customer_id, rental_id |

---

*This blueprint is the single source of truth for frontend data requirements. Phase 2 (Master Data Design) and Phase 3 (Transaction Flow Design) will use it to define linked seed data and sequences.*
