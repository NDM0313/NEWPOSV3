# ✅ SCHEMA VERIFICATION - ALL REQUIRED TABLES

**Date**: January 2026  
**Status**: ✅ **VERIFIED & COMPLETE**

---

## 📋 REQUIRED TABLES CHECKLIST

User ne jo tables specify kiye hain, un sab ka verification:

### ✅ **Core Tables (19 Required):**

1. ✅ **companies** - Company information
   - Columns: id, name, logo_url, email, phone, address, city, state, country, postal_code, tax_number, currency, financial_year_start, is_active, created_at, updated_at
   - Foreign Keys: None (root table)
   - Constraints: PRIMARY KEY (id)

2. ✅ **branches** - Branch locations
   - Columns: id, company_id, name, code, email, phone, address, city, manager_id, is_active, created_at, updated_at
   - Foreign Keys: company_id → companies(id) CASCADE
   - Constraints: PRIMARY KEY (id), UNIQUE(company_id, code)

3. ✅ **users** - User accounts
   - Columns: id, company_id, email, full_name, phone, role, avatar_url, is_active, last_login, created_at, updated_at
   - Foreign Keys: id → auth.users(id) CASCADE, company_id → companies(id) CASCADE
   - Constraints: PRIMARY KEY (id), UNIQUE(email)

4. ✅ **roles** - User roles (NEW - Added)
   - Columns: id, company_id, name, description, permissions (JSONB), is_system, is_active, created_at, updated_at
   - Foreign Keys: company_id → companies(id) CASCADE
   - Constraints: PRIMARY KEY (id), UNIQUE(company_id, name)

5. ✅ **settings** - Settings storage (CRITICAL)
   - Columns: id, company_id, key, value (JSONB), category, description, updated_at
   - Foreign Keys: company_id → companies(id) CASCADE
   - Constraints: PRIMARY KEY (id), UNIQUE(company_id, key)
   - **Persistence:** ✅ JSONB value ensures proper persistence

6. ✅ **contacts** - Customers/Suppliers/Workers
   - Columns: id, company_id, type, name, email, phone, mobile, cnic, ntn, address, city, state, country, postal_code, opening_balance, current_balance, credit_limit, payment_terms, tax_number, notes, is_active, created_by, created_at, updated_at
   - Foreign Keys: company_id → companies(id) CASCADE, created_by → users(id)
   - Constraints: PRIMARY KEY (id)

7. ✅ **products** - Products
   - Columns: id, company_id, category_id, name, sku, barcode, description, unit, cost_price, retail_price, wholesale_price, rental_price_daily, rental_price_weekly, rental_price_monthly, current_stock, min_stock, max_stock, reorder_point, has_variations, image_url, gallery_urls, is_rentable, is_sellable, is_purchasable, track_stock, is_active, created_by, created_at, updated_at
   - Foreign Keys: company_id → companies(id) CASCADE, category_id → product_categories(id) SET NULL, created_by → users(id)
   - Constraints: PRIMARY KEY (id), UNIQUE(company_id, sku)

8. ✅ **product_variations** - Product variations
   - Columns: id, product_id, name, sku, barcode, attributes (JSONB), cost_price, retail_price, wholesale_price, current_stock, image_url, is_active, created_at, updated_at
   - Foreign Keys: product_id → products(id) CASCADE
   - Constraints: PRIMARY KEY (id), UNIQUE(product_id, sku)

9. ✅ **product_packings** - Product packings (NEW - Added)
   - Columns: id, product_id, packing_type, packing_name, quantity_per_pack, unit, total_quantity, details (JSONB), is_active, created_at, updated_at
   - Foreign Keys: product_id → products(id) CASCADE
   - Constraints: PRIMARY KEY (id)

10. ✅ **inventory_movements** - Stock movements (as `stock_movements`)
    - Columns: id, company_id, branch_id, product_id, variation_id, type, quantity, unit_cost, total_cost, balance_qty, reference_type, reference_id, notes, created_by, created_at
    - Foreign Keys: company_id → companies(id) CASCADE, branch_id → branches(id) CASCADE, product_id → products(id) CASCADE, variation_id → product_variations(id) SET NULL, created_by → users(id)
    - Constraints: PRIMARY KEY (id)

11. ✅ **purchases** - Purchase orders
    - Columns: id, company_id, branch_id, po_no, po_date, supplier_id, supplier_name, status, payment_status, subtotal, discount_percentage, discount_amount, tax_percentage, tax_amount, shipping_cost, total, paid_amount, due_amount, expected_delivery_date, received_date, notes, journal_entry_id, created_by, created_at, updated_at
    - Foreign Keys: company_id → companies(id) CASCADE, branch_id → branches(id) CASCADE, supplier_id → contacts(id) SET NULL, journal_entry_id → journal_entries(id), created_by → users(id)
    - Constraints: PRIMARY KEY (id), UNIQUE(company_id, po_no)

12. ✅ **purchase_items** - Purchase line items
    - Columns: id, purchase_id, product_id, variation_id, product_name, quantity, received_qty, unit, unit_price, discount, tax, total, packing_type, packing_quantity, packing_unit, packing_details (JSONB), notes, created_at
    - Foreign Keys: purchase_id → purchases(id) CASCADE, product_id → products(id) RESTRICT, variation_id → product_variations(id) SET NULL
    - Constraints: PRIMARY KEY (id)

13. ✅ **sales** - Sales/Invoices
    - Columns: id, company_id, branch_id, invoice_no, invoice_date, customer_id, customer_name, status, payment_status, subtotal, discount_percentage, discount_amount, tax_percentage, tax_amount, shipping_charges, total, paid_amount, due_amount, sale_type, delivery_date, notes, terms_conditions, journal_entry_id, created_by, created_at, updated_at
    - Foreign Keys: company_id → companies(id) CASCADE, branch_id → branches(id) CASCADE, customer_id → contacts(id) SET NULL, journal_entry_id → journal_entries(id), created_by → users(id)
    - Constraints: PRIMARY KEY (id), UNIQUE(company_id, invoice_no)

14. ✅ **sale_items** - Sale line items
    - Columns: id, sale_id, product_id, variation_id, product_name, quantity, unit, unit_price, discount_percentage, discount_amount, tax_percentage, tax_amount, total, packing_type, packing_quantity, packing_unit, packing_details (JSONB), notes, created_at
    - Foreign Keys: sale_id → sales(id) CASCADE, product_id → products(id) RESTRICT, variation_id → product_variations(id) SET NULL
    - Constraints: PRIMARY KEY (id)

15. ✅ **expenses** - Expenses
    - Columns: id, company_id, branch_id, expense_no, expense_date, category, description, amount, vendor_name, vendor_id, payment_method, payment_account_id, receipt_url, status, approved_by, approved_at, notes, journal_entry_id, created_by, created_at, updated_at
    - Foreign Keys: company_id → companies(id) CASCADE, branch_id → branches(id) CASCADE, vendor_id → contacts(id) SET NULL, payment_account_id → accounts(id), approved_by → users(id), journal_entry_id → journal_entries(id), created_by → users(id)
    - Constraints: PRIMARY KEY (id), UNIQUE(company_id, expense_no)

16. ✅ **payments** - Payments/Receipts
    - Columns: id, company_id, branch_id, payment_no, payment_date, payment_type, contact_id, contact_name, amount, payment_method, payment_account_id, reference_type, reference_id, notes, journal_entry_id, created_by, created_at, updated_at
    - Foreign Keys: company_id → companies(id) CASCADE, branch_id → branches(id) CASCADE, contact_id → contacts(id) SET NULL, payment_account_id → accounts(id) RESTRICT, journal_entry_id → journal_entries(id), created_by → users(id)
    - Constraints: PRIMARY KEY (id), UNIQUE(company_id, payment_no)

17. ✅ **accounts** - Chart of accounts
    - Columns: id, company_id, code, name, type, subtype, parent_id, opening_balance, current_balance, description, is_system, is_active, created_at, updated_at
    - Foreign Keys: company_id → companies(id) CASCADE, parent_id → accounts(id) SET NULL
    - Constraints: PRIMARY KEY (id), UNIQUE(company_id, code)

18. ✅ **ledger_entries** - Ledger entries (as `journal_entry_lines`)
    - Columns: id, journal_entry_id, account_id, account_name, debit, credit, description, created_at
    - Foreign Keys: journal_entry_id → journal_entries(id) CASCADE, account_id → accounts(id) RESTRICT
    - Constraints: PRIMARY KEY (id), CHECK (debit > 0 AND credit = 0) OR (debit = 0 AND credit > 0)

19. ✅ **journal_entries** - Journal entries
    - Columns: id, company_id, branch_id, entry_no, entry_date, description, reference_type, reference_id, total_debit, total_credit, is_posted, posted_at, is_manual, created_by, created_at, updated_at
    - Foreign Keys: company_id → companies(id) CASCADE, branch_id → branches(id) CASCADE, created_by → users(id)
    - Constraints: PRIMARY KEY (id), UNIQUE(company_id, entry_no), CHECK (total_debit = total_credit)

---

## ✅ VERIFICATION SUMMARY

### **All Required Tables:** ✅ **PRESENT**

- ✅ companies
- ✅ branches
- ✅ users
- ✅ **roles** (NEW - Added)
- ✅ settings
- ✅ contacts
- ✅ products
- ✅ product_variations
- ✅ **product_packings** (NEW - Added)
- ✅ stock_movements (inventory_movements)
- ✅ purchases
- ✅ purchase_items
- ✅ sales
- ✅ sale_items
- ✅ expenses
- ✅ payments
- ✅ accounts
- ✅ journal_entry_lines (ledger_entries)
- ✅ journal_entries

### **Additional Tables (Not Required but Included):**

- ✅ user_branches
- ✅ permissions
- ✅ product_categories
- ✅ rentals
- ✅ rental_items
- ✅ studio_orders
- ✅ studio_order_items
- ✅ workers
- ✅ job_cards
- ✅ modules_config
- ✅ document_sequences
- ✅ audit_logs

---

## 🔧 KEY FEATURES

### **1. Settings Persistence** ✅
- Settings table uses **JSONB** for flexible value storage
- **UNIQUE(company_id, key)** ensures no duplicates
- Proper foreign key to companies
- **updated_at** trigger for automatic timestamp updates

### **2. Packing Support** ✅
- **product_packings** table for product-level packing definitions
- **packing_type, packing_quantity, packing_unit, packing_details** columns in sale_items
- **packing_type, packing_quantity, packing_unit, packing_details** columns in purchase_items

### **3. Roles Management** ✅
- **roles** table for company-level role definitions
- **permissions** table links users to roles
- JSONB permissions for flexible module access

### **4. Foreign Keys** ✅
- All foreign keys properly defined
- CASCADE deletes where appropriate
- RESTRICT deletes for critical data
- SET NULL for optional references

### **5. Constraints** ✅
- PRIMARY KEY on all tables
- UNIQUE constraints where needed
- CHECK constraints for data validation
- NOT NULL on required columns

---

## ✅ STATUS: **COMPLETE & VERIFIED**

All required tables are present with proper structure, foreign keys, and constraints.

**Ready for database reset execution.**
