# 📋 FRONTEND DATA REQUIREMENTS AUDIT
**Date:** 2026-01-20  
**Purpose:** Extract ALL form fields from frontend to design database schema

---

## 🎯 CORE PRINCIPLE
**Frontend = Source of Truth**  
Database schema will be designed based on what frontend forms actually send.

---

## 1️⃣ CREATE BUSINESS FORM

### Fields (from `CreateBusinessForm.tsx`):
- ✅ `businessName` (string, required)
- ✅ `ownerName` (string, required)
- ✅ `email` (string, required, email format)
- ✅ `password` (string, required, min 6 chars)
- ✅ `confirmPassword` (string, required, client-side validation only)

### Database Requirements:
- `companies` table: name, email
- `users` table: email, full_name (from ownerName), password (via Supabase Auth)
- `branches` table: default branch created

---

## 2️⃣ PRODUCT FORM

### Fields (from `EnhancedProductForm.tsx` schema):
**Basic Info:**
- ✅ `name` (string, required)
- ✅ `sku` (string, required)
- ✅ `barcodeType` (string, optional)
- ✅ `brand` (string, optional)
- ✅ `category` (string, optional) → maps to `category_id` (UUID)
- ✅ `subCategory` (string, optional)
- ✅ `unit` (string, optional)

**Pricing:**
- ✅ `purchasePrice` (number, optional) → `cost_price`
- ✅ `margin` (number, optional, client-side calculation)
- ✅ `sellingPrice` (number, required) → `retail_price`
- ✅ `wholesalePrice` (number, optional) → `wholesale_price`
- ✅ `taxType` (string, optional)
- ✅ `rentalPrice` (number, optional) → `rental_price_daily`
- ✅ `securityDeposit` (number, optional)
- ✅ `rentalDuration` (number, optional, default: 3)

**Inventory:**
- ✅ `stockManagement` (boolean, default: true) → `track_stock`
- ✅ `initialStock` (number, optional) → `current_stock`
- ✅ `alertQty` (number, optional) → `min_stock`
- ✅ `maxStock` (number, optional, default: 1000) → `max_stock`

**Details:**
- ✅ `description` (string, optional)
- ✅ `notes` (string, optional)
- ✅ `supplier` (string, optional)
- ✅ `supplierCode` (string, optional)

**Variations:**
- ✅ `variantAttributes` (array of {name, values[]})
- ✅ `generatedVariations` (array of {combination, sku, price, stock, barcode})

**Images:**
- ✅ `images` (File[], optional)

### Database Requirements:
**`products` table:**
- `id` (UUID, PK)
- `company_id` (UUID, FK → companies)
- `category_id` (UUID, FK → product_categories, nullable)
- `name` (VARCHAR, NOT NULL)
- `sku` (VARCHAR, NOT NULL)
- `barcode` (VARCHAR, nullable)
- `description` (TEXT, nullable)
- `cost_price` (DECIMAL, default: 0)
- `retail_price` (DECIMAL, NOT NULL)
- `wholesale_price` (DECIMAL, default: retail_price)
- `rental_price_daily` (DECIMAL, nullable)
- `current_stock` (DECIMAL, default: 0)
- `min_stock` (DECIMAL, default: 0)
- `max_stock` (DECIMAL, default: 1000)
- `has_variations` (BOOLEAN, default: false)
- `is_rentable` (BOOLEAN, default: false)
- `is_sellable` (BOOLEAN, default: true)
- `track_stock` (BOOLEAN, default: true)
- `is_active` (BOOLEAN, default: true)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

**`product_variations` table:**
- `id` (UUID, PK)
- `product_id` (UUID, FK → products)
- `sku` (VARCHAR, NOT NULL)
- `barcode` (VARCHAR, nullable)
- `attributes` (JSONB) → {size: "M", color: "Red"}
- `price` (DECIMAL, nullable, uses product price if null)
- `stock` (DECIMAL, default: 0)
- `is_active` (BOOLEAN, default: true)
- `created_at` (TIMESTAMPTZ)

**`product_categories` table:**
- `id` (UUID, PK)
- `company_id` (UUID, FK → companies)
- `name` (VARCHAR, NOT NULL)
- `parent_id` (UUID, FK → product_categories, nullable) → for subCategory
- `is_active` (BOOLEAN, default: true)
- `created_at` (TIMESTAMPTZ)

---

## 3️⃣ CONTACT FORM

### Fields (from `GlobalDrawer.tsx` ContactFormContent):
**Basic Info:**
- ✅ `type` ('customer' | 'supplier' | 'worker', required)
- ✅ `business-name` (string, required) → `name`
- ✅ `mobile` (string, optional) → `phone`
- ✅ `email` (string, optional)
- ✅ `address` (string, optional)
- ✅ `city` (string, optional)
- ✅ `country` (string, optional) → 'Pakistan' | 'India' | 'Bangladesh'
- ✅ `tax-id` (string, optional) → `tax_number`

**Financial:**
- ✅ `opening-balance` (number, optional, default: 0) → `opening_balance`
- ✅ `credit-limit` (number, optional, default: 0) → `credit_limit`
- ✅ `pay-term` (number, optional, default: 0) → `payment_terms`

**Other:**
- ✅ `notes` (string, optional)
- ✅ `workerType` (string, optional) → for type='worker'

### Database Requirements:
**`contacts` table:**
- `id` (UUID, PK)
- `company_id` (UUID, FK → companies, NOT NULL)
- `branch_id` (UUID, FK → branches, nullable)
- `type` (ENUM: 'customer' | 'supplier' | 'both' | 'worker', NOT NULL)
- `name` (VARCHAR, NOT NULL)
- `email` (VARCHAR, nullable)
- `phone` (VARCHAR, nullable)
- `mobile` (VARCHAR, nullable)
- `address` (TEXT, nullable)
- `city` (VARCHAR, nullable)
- `state` (VARCHAR, nullable)
- `country` (VARCHAR, nullable)
- `postal_code` (VARCHAR, nullable)
- `tax_number` (VARCHAR, nullable)
- `opening_balance` (DECIMAL, default: 0)
- `credit_limit` (DECIMAL, default: 0)
- `payment_terms` (INTEGER, default: 0)
- `notes` (TEXT, nullable)
- `is_active` (BOOLEAN, default: true)
- `created_by` (UUID, FK → users, nullable)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

---

## 4️⃣ SALE FORM

### Fields (from `SaleForm.tsx`):
**Header:**
- ✅ `customerId` (string/UUID, required)
- ✅ `customerName` (string, required)
- ✅ `saleDate` (Date, required) → `date`
- ✅ `saleStatus` ('quotation' | 'invoice', required) → `type`
- ✅ `branchId` (string/UUID, required) → `location`

**Items (SaleItem[]):**
- ✅ `productId` (number/UUID, required)
- ✅ `name` (string, required) → `product_name`
- ✅ `sku` (string, required)
- ✅ `price` (number, required) → `unit_price`
- ✅ `qty` (number, required) → `quantity`
- ✅ `size` (string, optional) → variation
- ✅ `color` (string, optional) → variation
- ✅ `variation_id` (UUID, optional) → from product_variations
- ✅ `thaans` (number, optional) → packing
- ✅ `meters` (number, optional) → packing
- ✅ `packingDetails` (PackingDetails, optional) → `packing_type`, `packing_quantity`, `packing_unit`, `packing_details` (JSONB)

**Financial:**
- ✅ `subtotal` (number, calculated)
- ✅ `discountAmount` (number, default: 0) → `discount_amount`
- ✅ `expensesTotal` (number, default: 0) → `expenses`
- ✅ `finalShippingCharges` (number, default: 0) → part of `expenses`
- ✅ `totalAmount` (number, calculated) → `total`
- ✅ `totalPaid` (number, default: 0) → `paid`
- ✅ `balanceDue` (number, calculated) → `due`

**Payment:**
- ✅ `partialPayments` (PartialPayment[], optional)
  - `method` ('cash' | 'bank' | 'other')
  - `amount` (number)
  - `reference` (string, optional)
  - `notes` (string, optional)
  - `attachments` (PaymentAttachment[], optional)

**Status:**
- ✅ `paymentStatus` ('paid' | 'partial' | 'unpaid', calculated)
- ✅ `paymentMethod` (string, default: 'cash')
- ✅ `shippingStatus` ('pending' | 'delivered' | 'processing' | 'cancelled', optional)
- ✅ `notes` (string, optional) → `studioNotes` or `refNumber`

### Database Requirements:
**`sales` table:**
- `id` (UUID, PK)
- `company_id` (UUID, FK → companies, NOT NULL)
- `branch_id` (UUID, FK → branches, NOT NULL)
- `invoice_no` (VARCHAR, auto-generated)
- `invoice_date` (DATE, NOT NULL) → from `date`
- `customer_id` (UUID, FK → contacts, nullable)
- `customer_name` (VARCHAR, NOT NULL)
- `contact_number` (VARCHAR, nullable)
- `type` (ENUM: 'invoice' | 'quotation', NOT NULL)
- `status` (ENUM: 'draft' | 'quotation' | 'order' | 'final', default: 'final')
- `payment_status` (ENUM: 'paid' | 'partial' | 'unpaid', NOT NULL)
- `payment_method` (VARCHAR, nullable)
- `shipping_status` (ENUM: 'pending' | 'delivered' | 'processing' | 'cancelled', nullable)
- `subtotal` (DECIMAL, NOT NULL)
- `discount_amount` (DECIMAL, default: 0)
- `tax_amount` (DECIMAL, default: 0)
- `expenses` (DECIMAL, default: 0) → includes shipping
- `total` (DECIMAL, NOT NULL)
- `paid_amount` (DECIMAL, default: 0)
- `due_amount` (DECIMAL, default: 0)
- `return_due` (DECIMAL, default: 0)
- `notes` (TEXT, nullable)
- `created_by` (UUID, FK → users, nullable)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

**`sale_items` table:**
- `id` (UUID, PK)
- `sale_id` (UUID, FK → sales, NOT NULL)
- `product_id` (UUID, FK → products, NOT NULL)
- `variation_id` (UUID, FK → product_variations, nullable)
- `product_name` (VARCHAR, NOT NULL)
- `sku` (VARCHAR, NOT NULL)
- `quantity` (DECIMAL, NOT NULL)
- `unit` (VARCHAR, default: 'piece')
- `unit_price` (DECIMAL, NOT NULL)
- `discount_percentage` (DECIMAL, default: 0)
- `discount_amount` (DECIMAL, default: 0)
- `tax_percentage` (DECIMAL, default: 0)
- `tax_amount` (DECIMAL, default: 0)
- `total` (DECIMAL, NOT NULL)
- `packing_type` (VARCHAR, nullable)
- `packing_quantity` (DECIMAL, nullable)
- `packing_unit` (VARCHAR, nullable)
- `packing_details` (JSONB, nullable)
- `notes` (TEXT, nullable)
- `created_at` (TIMESTAMPTZ)

**`payments` table:**
- `id` (UUID, PK)
- `company_id` (UUID, FK → companies, NOT NULL)
- `branch_id` (UUID, FK → branches, nullable)
- `payment_type` (ENUM: 'received' | 'paid', NOT NULL)
- `reference_type` (ENUM: 'sale' | 'purchase' | 'expense', NOT NULL)
- `reference_id` (UUID, NOT NULL) → sale_id, purchase_id, or expense_id
- `amount` (DECIMAL, NOT NULL)
- `payment_method` (ENUM: 'cash' | 'bank' | 'card' | 'other', NOT NULL)
- `payment_date` (DATE, NOT NULL)
- `payment_account_id` (UUID, FK → accounts, nullable)
- `reference_number` (VARCHAR, nullable)
- `notes` (TEXT, nullable)
- `attachments` (JSONB, nullable) → array of {url, name, type}
- `created_by` (UUID, FK → users, nullable)
- `created_at` (TIMESTAMPTZ)

---

## 5️⃣ PURCHASE FORM

### Fields (from `PurchaseForm.tsx`):
**Header:**
- ✅ `supplierId` (string/UUID, required)
- ✅ `supplierName` (string, required)
- ✅ `purchaseDate` (Date, required) → `date`
- ✅ `purchaseStatus` ('draft' | 'ordered' | 'received' | 'final', required) → `status`
- ✅ `refNumber` (string, optional) → `notes`
- ✅ `branchId` (string/UUID, required) → `location`

**Items (PurchaseItem[]):**
- ✅ `productId` (number/UUID, required)
- ✅ `name` (string, required) → `product_name`
- ✅ `sku` (string, required)
- ✅ `price` (number, required) → `unit_price`
- ✅ `qty` (number, required) → `quantity`
- ✅ `size` (string, optional) → variation
- ✅ `color` (string, optional) → variation
- ✅ `variation_id` (UUID, optional)
- ✅ `thaans` (number, optional) → packing
- ✅ `meters` (number, optional) → packing
- ✅ `packingDetails` (PackingDetails, optional)

**Financial:**
- ✅ `subtotal` (number, calculated)
- ✅ `discountAmount` (number, default: 0) → `discount_amount`
- ✅ `expensesTotal` (number, default: 0) → `shipping_cost`
- ✅ `totalAmount` (number, calculated) → `total`
- ✅ `totalPaid` (number, default: 0) → `paid`
- ✅ `balanceDue` (number, calculated) → `due`

**Payment:**
- ✅ `partialPayments` (PartialPayment[], optional)
  - Same structure as Sale payments

**Status:**
- ✅ `paymentStatus` ('paid' | 'partial' | 'unpaid', calculated)
- ✅ `paymentMethod` (string, default: 'cash')

### Database Requirements:
**`purchases` table:**
- `id` (UUID, PK)
- `company_id` (UUID, FK → companies, NOT NULL)
- `branch_id` (UUID, FK → branches, NOT NULL)
- `po_no` (VARCHAR, auto-generated)
- `po_date` (DATE, NOT NULL) → from `date`
- `supplier_id` (UUID, FK → contacts, nullable)
- `supplier_name` (VARCHAR, NOT NULL)
- `contact_number` (VARCHAR, nullable)
- `status` (ENUM: 'draft' | 'ordered' | 'received' | 'final', NOT NULL)
- `payment_status` (ENUM: 'paid' | 'partial' | 'unpaid', NOT NULL)
- `payment_method` (VARCHAR, nullable)
- `subtotal` (DECIMAL, NOT NULL)
- `discount_amount` (DECIMAL, default: 0)
- `tax_amount` (DECIMAL, default: 0)
- `shipping_cost` (DECIMAL, default: 0)
- `total` (DECIMAL, NOT NULL)
- `paid_amount` (DECIMAL, default: 0)
- `due_amount` (DECIMAL, default: 0)
- `notes` (TEXT, nullable)
- `created_by` (UUID, FK → users, nullable)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

**`purchase_items` table:**
- `id` (UUID, PK)
- `purchase_id` (UUID, FK → purchases, NOT NULL)
- `product_id` (UUID, FK → products, NOT NULL)
- `variation_id` (UUID, FK → product_variations, nullable)
- `product_name` (VARCHAR, NOT NULL)
- `sku` (VARCHAR, NOT NULL)
- `quantity` (DECIMAL, NOT NULL)
- `unit` (VARCHAR, default: 'piece')
- `unit_price` (DECIMAL, NOT NULL)
- `discount_percentage` (DECIMAL, default: 0)
- `discount_amount` (DECIMAL, default: 0)
- `tax_percentage` (DECIMAL, default: 0)
- `tax_amount` (DECIMAL, default: 0)
- `total` (DECIMAL, NOT NULL)
- `packing_type` (VARCHAR, nullable)
- `packing_quantity` (DECIMAL, nullable)
- `packing_unit` (VARCHAR, nullable)
- `packing_details` (JSONB, nullable)
- `notes` (TEXT, nullable)
- `created_at` (TIMESTAMPTZ)

---

## 6️⃣ SETTINGS FORM

### Fields (from `SettingsPageNew.tsx`):
**Company Info:**
- ✅ `businessName` (string) → `name` in companies
- ✅ `taxId` (string) → `tax_number`
- ✅ `businessAddress` (string) → `address`
- ✅ `businessPhone` (string) → `phone`
- ✅ `businessEmail` (string) → `email`
- ✅ `businessWebsite` (string) → `website`
- ✅ `businessLogo` (string/File) → `logo_url`

**POS Settings:**
- ✅ Various POS configuration fields (stored in `settings` table as JSONB)

**Sales/Purchase/Inventory/Rental/Accounting Settings:**
- ✅ Various module-specific settings (stored in `settings` table as JSONB)

**Numbering Rules:**
- ✅ Document numbering patterns (stored in `settings` table as JSONB)

**Module Toggles:**
- ✅ Module enable/disable flags (stored in `modules_config` table)

### Database Requirements:
**`settings` table:**
- `id` (UUID, PK)
- `company_id` (UUID, FK → companies, NOT NULL)
- `key` (VARCHAR, NOT NULL) → e.g., 'company_info', 'pos_settings', 'sales_settings'
- `value` (JSONB, NOT NULL) → actual settings data
- `category` (VARCHAR, nullable) → 'general', 'accounting', 'sales', etc.
- `description` (TEXT, nullable)
- `updated_at` (TIMESTAMPTZ)

**`modules_config` table:**
- `id` (UUID, PK)
- `company_id` (UUID, FK → companies, NOT NULL)
- `module_name` (VARCHAR, NOT NULL) → 'sales', 'purchases', 'rentals', etc.
- `is_enabled` (BOOLEAN, default: true)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)
- UNIQUE(company_id, module_name)

**`companies` table (additional fields):**
- `logo_url` (TEXT, nullable)
- `website` (VARCHAR, nullable)
- `tax_number` (VARCHAR, nullable)

---

## 7️⃣ EXPENSE FORM

### Fields (from ExpenseContext):
- ✅ `category` (string, required)
- ✅ `amount` (number, required)
- ✅ `expense_date` (DATE, required)
- ✅ `description` (string, optional)
- ✅ `payment_method` (string, optional)
- ✅ `account_id` (UUID, optional)
- ✅ `status` ('pending' | 'approved' | 'rejected' | 'paid', default: 'pending')
- ✅ `approved_by` (UUID, optional)
- ✅ `notes` (string, optional)

### Database Requirements:
**`expenses` table:**
- `id` (UUID, PK)
- `company_id` (UUID, FK → companies, NOT NULL)
- `branch_id` (UUID, FK → branches, nullable)
- `category` (VARCHAR, NOT NULL)
- `amount` (DECIMAL, NOT NULL)
- `expense_date` (DATE, NOT NULL)
- `description` (TEXT, nullable)
- `payment_method` (VARCHAR, nullable)
- `account_id` (UUID, FK → accounts, nullable)
- `status` (ENUM: 'pending' | 'approved' | 'rejected' | 'paid', default: 'pending')
- `approved_by` (UUID, FK → users, nullable)
- `notes` (TEXT, nullable)
- `created_by` (UUID, FK → users, nullable)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

---

## 📊 SUMMARY: REQUIRED TABLES

1. ✅ `companies` - Business info
2. ✅ `branches` - Branch locations
3. ✅ `users` - User accounts
4. ✅ `roles` - User roles
5. ✅ `settings` - JSONB-based settings
6. ✅ `modules_config` - Module toggles
7. ✅ `contacts` - Customers/Suppliers/Workers
8. ✅ `products` - Product master
9. ✅ `product_categories` - Product categories
10. ✅ `product_variations` - Product variations
11. ✅ `sales` - Sales/Invoices
12. ✅ `sale_items` - Sale line items
13. ✅ `purchases` - Purchase orders
14. ✅ `purchase_items` - Purchase line items
15. ✅ `expenses` - Expenses
16. ✅ `payments` - Payments (for sales/purchases/expenses)
17. ✅ `accounts` - Chart of accounts
18. ✅ `ledger_entries` - Accounting ledger
19. ✅ `journal_entries` - Journal entries

---

**Next Step:** Design complete database schema based on these requirements.
