# ERP Dependency Graph

Read-only representation of major dependency chains. Arrows mean “depends on” (data or flow). Same backend (Supabase) and shared tables; no code changes.

---

## 1. Core data flow

```
Companies
    └── Branches
    └── Users ── user_branches ── Branches
    └── Settings / modules_config / feature_flags

Contacts (customers, suppliers, workers)
    └── used by: Sales, Purchases, Studio (workers), Ledger

Products ── product_variations
    └── product_categories, brands, units
    └── used by: Sales, Purchases, Inventory, Rentals
```

---

## 2. Sales chain

```
Sales
  ├── Contacts (customer_id)
  ├── Products / product_variations (sale_items)
  ├── Branches (branch_id)
  ├── Stock (availability / reserve) ── stock_movements
  ├── Payments (payments.reference_type = 'sale', reference_id = sale.id)
  ├── Accounting (journal_entries.reference_type = 'sale')
  └── Document numbering (erp_document_sequences / document_sequences)

Sale returns / refunds / credit notes
  └── Sales (parent sale)
  └── Accounting (reversal or credit journal entries)
```

---

## 3. Purchases chain

```
Purchases
  ├── Contacts (supplier_id)
  ├── Products / product_variations (purchase_items)
  ├── Branches (branch_id)
  ├── Stock (stock_movements on receive)
  ├── Payments (reference_type = 'purchase')
  └── Accounting (journal_entries.reference_type = 'purchase')

Purchase returns
  └── Purchases
  └── Accounting (if posted)
```

---

## 4. Inventory chain

```
Inventory
  ├── Products
  ├── product_variations
  ├── stock_movements (source of truth)
  ├── inventory_balance (derived/cache)
  └── Branches (branch-scoped stock)

Stock adjustments
  └── Can post journal_entries (reference_type = 'stock_adjustment')
  └── Accounting
```

---

## 5. Accounting chain (center)

```
Accounting
  ├── accounts (chart of accounts)
  ├── journal_entries (headers: company_id, branch_id, reference_type, reference_id)
  └── journal_entry_lines (account_id, debit, credit)

Consumed by (post to Accounting):
  ├── Sales (trigger + saleAccountingService)
  ├── Purchases (context/service)
  ├── Payments (triggers + AccountingContext.createEntry)
  ├── Expenses (AccountingContext / RPC)
  ├── Refunds / sale returns (refundService, SaleReturnForm)
  ├── Studio (stage costs, customer invoice, worker payments)
  ├── Rentals (advances, rental income)
  └── Shipment (shipmentAccountingService)
```

---

## 6. Studio production chain

```
Studio
  ├── Sales (studio_productions.sale_id)
  ├── Contacts (workers)
  ├── studio_productions
  ├── studio_production_stages (worker, cost, status)
  ├── workers, worker_ledger_entries, worker_payments
  └── Accounting (createEntry for stage costs, invoice, worker payment)
```

---

## 7. Rentals chain

```
Rentals
  ├── Contacts (customer)
  ├── Products (rentable items)
  ├── rental_items, rental_payments
  └── Accounting (advance, rental income via createEntry)
```

---

## 8. Reports chain

```
Reports
  ├── Accounting (journal_entries, journal_entry_lines, accounts)
  ├── Sales (sales, sale_items) + Purchases (purchases, purchase_items)
  ├── Inventory (stock_movements)
  └── Contacts (for customer/supplier reports)
```

---

## 9. Mobile chain

```
Mobile app
  ├── Auth (Supabase Auth)
  ├── Branches (getBranches, getUserBranchIds)
  ├── Permissions (getRolePermissions, getModuleConfigs) ── role_permissions, modules_config
  └── Same APIs as web: contacts, products, sales, purchases, rentals, studio, accounts, expenses, inventory, reports, settings, packing, shipments, documentNumber
```

---

## 10. High-level summary

```
Sales          → Contacts, Products, Stock, Payments, Accounting, Branches
Purchases      → Contacts, Products, Stock, Accounting, Branches
Inventory      → Products, Variations, stock_movements, Branches
Accounting     → accounts, journal_entries, journal_entry_lines (all posting flows converge here)
Studio         → Sales, Contacts (workers), Accounting
Rentals        → Contacts, Products, Accounting
Reports        → Accounting, Sales, Purchases, Inventory, Contacts
Payments       → Accounting, Sales/Purchases/Rentals (reference)
Expenses       → Accounting, accounts
Mobile         → Auth, Branches, Permissions, same core APIs
Settings/Users → Companies, Branches, role_permissions, modules_config
```

---

*End of dependency graph. No code changed.*
