# Company Reset Playbook

Date: 2026-03-18  
Purpose: Safe company reset guide for self-hosted ERP/Supabase without breaking login/auth.

This playbook gives **two reset modes** for a single company:

1. **Mode A — Transaction Reset**  
   Deletes only business transactions for one company.
   Keeps company setup, users, accounts, products, contacts, and system configuration.

2. **Mode B — Full Business Zero Reset**  
   Deletes business transactions **plus** products and contacts for one company.
   Keeps login/auth/system/company structure so the business can start from zero safely.

---

## Very important safety rules

Never touch these during reset unless you are doing a full platform rebuild:

- `auth.users`
- `auth.*`
- `profiles`
- `users`
- `companies`
- `branches`
- `accounts`
- `account_groups`
- `account_types`
- `roles`
- `permissions`
- `settings`
- `company_settings`
- Kong/Auth/Supabase env

Reason: previous incidents showed that reset/deploy work can accidentally create login/auth issues if reset scope is too broad or config gets changed. Login fixes later required Kong/auth routing repairs. See login fix result for context. fileciteturn9file0

---

## How to use this file

Replace this placeholder everywhere:

```sql
YOUR_COMPANY_UUID_HERE
```

Example company id:

```text
c37b77cc-6eb9-4fc0-af7d-3e1eaaeaeaee
```

---

# STEP 0 — Preview before delete

Run this first so you know what will be deleted.

```sql
SELECT 'sales' AS table_name, count(*) AS rows FROM public.sales WHERE company_id = 'YOUR_COMPANY_UUID_HERE'
UNION ALL
SELECT 'sale_returns', count(*) FROM public.sale_returns WHERE company_id = 'YOUR_COMPANY_UUID_HERE'
UNION ALL
SELECT 'purchases', count(*) FROM public.purchases WHERE company_id = 'YOUR_COMPANY_UUID_HERE'
UNION ALL
SELECT 'purchase_returns', count(*) FROM public.purchase_returns WHERE company_id = 'YOUR_COMPANY_UUID_HERE'
UNION ALL
SELECT 'payments', count(*) FROM public.payments WHERE company_id = 'YOUR_COMPANY_UUID_HERE'
UNION ALL
SELECT 'expenses', count(*) FROM public.expenses WHERE company_id = 'YOUR_COMPANY_UUID_HERE'
UNION ALL
SELECT 'rentals', count(*) FROM public.rentals WHERE company_id = 'YOUR_COMPANY_UUID_HERE'
UNION ALL
SELECT 'studio_orders', count(*) FROM public.studio_orders WHERE company_id = 'YOUR_COMPANY_UUID_HERE'
UNION ALL
SELECT 'studio_productions', count(*) FROM public.studio_productions WHERE company_id = 'YOUR_COMPANY_UUID_HERE'
UNION ALL
SELECT 'shipments', count(*) FROM public.shipments WHERE company_id = 'YOUR_COMPANY_UUID_HERE'
UNION ALL
SELECT 'deposits', count(*) FROM public.deposits WHERE company_id = 'YOUR_COMPANY_UUID_HERE'
UNION ALL
SELECT 'journal_entries', count(*) FROM public.journal_entries WHERE company_id = 'YOUR_COMPANY_UUID_HERE'
UNION ALL
SELECT 'products', count(*) FROM public.products WHERE company_id = 'YOUR_COMPANY_UUID_HERE'
UNION ALL
SELECT 'contacts', count(*) FROM public.contacts WHERE company_id = 'YOUR_COMPANY_UUID_HERE';
```

---

# MODE A — Transaction Reset Only

## What this keeps

- company
- branches
- users / profiles / auth
- chart of accounts
- roles / permissions / settings
- products
- contacts

## What this deletes

- sales and sale-related rows
- purchases and purchase-related rows
- payments
- expenses
- rentals
- studio transactions
- shipment/deposit transaction rows
- inventory transaction rows
- journal entries
- activity/share/print logs

## SQL — Transaction Reset

```sql
BEGIN;

DO $$
DECLARE
    v_company uuid := 'YOUR_COMPANY_UUID_HERE';
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.companies WHERE id = v_company
    ) THEN
        RAISE EXCEPTION 'Company not found: %', v_company;
    END IF;

    -- Journal children first
    IF to_regclass('public.journal_entry_lines') IS NOT NULL
       AND to_regclass('public.journal_entries') IS NOT NULL THEN
        DELETE FROM public.journal_entry_lines
        WHERE journal_entry_id IN (
            SELECT id FROM public.journal_entries WHERE company_id = v_company
        );
    END IF;

    -- Sale children
    IF to_regclass('public.sale_items') IS NOT NULL AND to_regclass('public.sales') IS NOT NULL THEN
        DELETE FROM public.sale_items WHERE sale_id IN (SELECT id FROM public.sales WHERE company_id = v_company);
    END IF;

    IF to_regclass('public.sales_items') IS NOT NULL AND to_regclass('public.sales') IS NOT NULL THEN
        DELETE FROM public.sales_items WHERE sale_id IN (SELECT id FROM public.sales WHERE company_id = v_company);
    END IF;

    IF to_regclass('public.sale_charges') IS NOT NULL AND to_regclass('public.sales') IS NOT NULL THEN
        DELETE FROM public.sale_charges WHERE sale_id IN (SELECT id FROM public.sales WHERE company_id = v_company);
    END IF;

    IF to_regclass('public.share_logs') IS NOT NULL AND to_regclass('public.sales') IS NOT NULL THEN
        DELETE FROM public.share_logs WHERE sale_id IN (SELECT id FROM public.sales WHERE company_id = v_company);
    END IF;

    IF to_regclass('public.print_logs') IS NOT NULL AND to_regclass('public.sales') IS NOT NULL THEN
        DELETE FROM public.print_logs WHERE sale_id IN (SELECT id FROM public.sales WHERE company_id = v_company);
    END IF;

    -- Sale return children first
    IF to_regclass('public.sale_return_items') IS NOT NULL AND to_regclass('public.sale_returns') IS NOT NULL THEN
        DELETE FROM public.sale_return_items
        WHERE sale_return_id IN (SELECT id FROM public.sale_returns WHERE company_id = v_company);
    END IF;

    -- Purchase children
    IF to_regclass('public.purchase_items') IS NOT NULL AND to_regclass('public.purchases') IS NOT NULL THEN
        DELETE FROM public.purchase_items WHERE purchase_id IN (SELECT id FROM public.purchases WHERE company_id = v_company);
    END IF;

    IF to_regclass('public.purchases_items') IS NOT NULL AND to_regclass('public.purchases') IS NOT NULL THEN
        DELETE FROM public.purchases_items WHERE purchase_id IN (SELECT id FROM public.purchases WHERE company_id = v_company);
    END IF;

    IF to_regclass('public.purchase_return_items') IS NOT NULL AND to_regclass('public.purchase_returns') IS NOT NULL THEN
        DELETE FROM public.purchase_return_items
        WHERE purchase_return_id IN (SELECT id FROM public.purchase_returns WHERE company_id = v_company);
    END IF;

    -- Rental children
    IF to_regclass('public.rental_items') IS NOT NULL AND to_regclass('public.rentals') IS NOT NULL THEN
        DELETE FROM public.rental_items WHERE rental_id IN (SELECT id FROM public.rentals WHERE company_id = v_company);
    END IF;

    -- Studio children before sales
    IF to_regclass('public.studio_production_stages') IS NOT NULL AND to_regclass('public.studio_productions') IS NOT NULL THEN
        DELETE FROM public.studio_production_stages
        WHERE production_id IN (SELECT id FROM public.studio_productions WHERE company_id = v_company);
    END IF;

    IF to_regclass('public.studio_productions') IS NOT NULL THEN
        DELETE FROM public.studio_productions WHERE company_id = v_company;
    END IF;

    IF to_regclass('public.studio_orders') IS NOT NULL THEN
        DELETE FROM public.studio_orders WHERE company_id = v_company;
    END IF;

    -- Shipment/deposit/payment children
    IF to_regclass('public.shipment_items') IS NOT NULL AND to_regclass('public.shipments') IS NOT NULL THEN
        DELETE FROM public.shipment_items WHERE shipment_id IN (SELECT id FROM public.shipments WHERE company_id = v_company);
    END IF;

    IF to_regclass('public.deposit_transactions') IS NOT NULL AND to_regclass('public.deposits') IS NOT NULL THEN
        DELETE FROM public.deposit_transactions WHERE deposit_id IN (SELECT id FROM public.deposits WHERE company_id = v_company);
    END IF;

    IF to_regclass('public.payment_allocations') IS NOT NULL AND to_regclass('public.payments') IS NOT NULL THEN
        DELETE FROM public.payment_allocations WHERE payment_id IN (SELECT id FROM public.payments WHERE company_id = v_company);
    END IF;

    -- Returns before parent sales/purchases
    IF to_regclass('public.sale_returns') IS NOT NULL THEN
        DELETE FROM public.sale_returns WHERE company_id = v_company;
    END IF;

    IF to_regclass('public.purchase_returns') IS NOT NULL THEN
        DELETE FROM public.purchase_returns WHERE company_id = v_company;
    END IF;

    -- Main transactional tables
    IF to_regclass('public.payments') IS NOT NULL THEN
        DELETE FROM public.payments WHERE company_id = v_company;
    END IF;

    IF to_regclass('public.expenses') IS NOT NULL THEN
        DELETE FROM public.expenses WHERE company_id = v_company;
    END IF;

    IF to_regclass('public.sales') IS NOT NULL THEN
        DELETE FROM public.sales WHERE company_id = v_company;
    END IF;

    IF to_regclass('public.purchases') IS NOT NULL THEN
        DELETE FROM public.purchases WHERE company_id = v_company;
    END IF;

    IF to_regclass('public.rentals') IS NOT NULL THEN
        DELETE FROM public.rentals WHERE company_id = v_company;
    END IF;

    IF to_regclass('public.shipments') IS NOT NULL THEN
        DELETE FROM public.shipments WHERE company_id = v_company;
    END IF;

    IF to_regclass('public.deposits') IS NOT NULL THEN
        DELETE FROM public.deposits WHERE company_id = v_company;
    END IF;

    IF to_regclass('public.inventory_movements') IS NOT NULL THEN
        DELETE FROM public.inventory_movements WHERE company_id = v_company;
    END IF;

    IF to_regclass('public.stock_movements') IS NOT NULL THEN
        DELETE FROM public.stock_movements WHERE company_id = v_company;
    END IF;

    IF to_regclass('public.stock_adjustments') IS NOT NULL THEN
        DELETE FROM public.stock_adjustments WHERE company_id = v_company;
    END IF;

    IF to_regclass('public.inventory_adjustments') IS NOT NULL THEN
        DELETE FROM public.inventory_adjustments WHERE company_id = v_company;
    END IF;

    IF to_regclass('public.inventory_counts') IS NOT NULL THEN
        DELETE FROM public.inventory_counts WHERE company_id = v_company;
    END IF;

    IF to_regclass('public.activity_logs') IS NOT NULL THEN
        DELETE FROM public.activity_logs WHERE company_id = v_company;
    END IF;

    IF to_regclass('public.journal_entries') IS NOT NULL THEN
        DELETE FROM public.journal_entries WHERE company_id = v_company;
    END IF;

    RAISE NOTICE 'Transaction reset completed for company: %', v_company;
END $$;

COMMIT;
```

---

# MODE B — Full Business Zero Reset

## What this keeps

- company
- branches
- users / profiles / auth
- chart of accounts
- roles / permissions
- settings

## What this deletes

Everything from **Mode A** plus:
- products
- product variants / product prices
- contacts (customers / suppliers / workers)

## SQL — Full Business Zero Reset

Run **Mode A first**, then run this second block.

```sql
BEGIN;

DO $$
DECLARE
    v_company uuid := 'YOUR_COMPANY_UUID_HERE';
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.companies WHERE id = v_company
    ) THEN
        RAISE EXCEPTION 'Company not found: %', v_company;
    END IF;

    IF to_regclass('public.product_variants') IS NOT NULL THEN
        DELETE FROM public.product_variants WHERE company_id = v_company;
    END IF;

    IF to_regclass('public.product_prices') IS NOT NULL THEN
        DELETE FROM public.product_prices WHERE company_id = v_company;
    END IF;

    IF to_regclass('public.products') IS NOT NULL THEN
        DELETE FROM public.products WHERE company_id = v_company;
    END IF;

    IF to_regclass('public.contacts') IS NOT NULL THEN
        DELETE FROM public.contacts WHERE company_id = v_company;
    END IF;

    RAISE NOTICE 'Full business zero reset completed for company: %', v_company;
END $$;

COMMIT;
```

---

# STEP 3 — Verification after reset

```sql
SELECT 'sales' AS table_name, count(*) AS rows FROM public.sales WHERE company_id = 'YOUR_COMPANY_UUID_HERE'
UNION ALL
SELECT 'sale_returns', count(*) FROM public.sale_returns WHERE company_id = 'YOUR_COMPANY_UUID_HERE'
UNION ALL
SELECT 'purchases', count(*) FROM public.purchases WHERE company_id = 'YOUR_COMPANY_UUID_HERE'
UNION ALL
SELECT 'purchase_returns', count(*) FROM public.purchase_returns WHERE company_id = 'YOUR_COMPANY_UUID_HERE'
UNION ALL
SELECT 'payments', count(*) FROM public.payments WHERE company_id = 'YOUR_COMPANY_UUID_HERE'
UNION ALL
SELECT 'expenses', count(*) FROM public.expenses WHERE company_id = 'YOUR_COMPANY_UUID_HERE'
UNION ALL
SELECT 'rentals', count(*) FROM public.rentals WHERE company_id = 'YOUR_COMPANY_UUID_HERE'
UNION ALL
SELECT 'studio_orders', count(*) FROM public.studio_orders WHERE company_id = 'YOUR_COMPANY_UUID_HERE'
UNION ALL
SELECT 'studio_productions', count(*) FROM public.studio_productions WHERE company_id = 'YOUR_COMPANY_UUID_HERE'
UNION ALL
SELECT 'shipments', count(*) FROM public.shipments WHERE company_id = 'YOUR_COMPANY_UUID_HERE'
UNION ALL
SELECT 'deposits', count(*) FROM public.deposits WHERE company_id = 'YOUR_COMPANY_UUID_HERE'
UNION ALL
SELECT 'journal_entries', count(*) FROM public.journal_entries WHERE company_id = 'YOUR_COMPANY_UUID_HERE'
UNION ALL
SELECT 'products', count(*) FROM public.products WHERE company_id = 'YOUR_COMPANY_UUID_HERE'
UNION ALL
SELECT 'contacts', count(*) FROM public.contacts WHERE company_id = 'YOUR_COMPANY_UUID_HERE';
```

Expected:
- Mode A: transactions should become `0`, products/contacts should remain.
- Mode B: transactions should become `0`, products/contacts should also become `0`.

---

# Optional: discover what references `sales`

If delete order ever fails again, run this:

```sql
SELECT
    tc.table_name AS child_table,
    kcu.column_name AS child_column,
    ccu.table_name AS parent_table,
    ccu.column_name AS parent_column,
    tc.constraint_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
 AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
 AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND ccu.table_name = 'sales'
ORDER BY tc.table_name, kcu.column_name;
```

Use the result to delete child tables before parent sales.

---

# Recommended safe workflow

1. Run preview counts  
2. Run Mode A or Mode A + Mode B  
3. Run verification counts  
4. Full app refresh / reload  
5. Test one fresh sale, one payment, one purchase  
6. Never edit auth/Kong/Supabase config as part of data reset unless separately required

---

# Short Roman Urdu notes

- Agar sirf transactions saaf karni hain to **Mode A** use karo.
- Agar bilkul zero se start karna hai aur products/contacts bhi hatane hain to **Mode A + Mode B** use karo.
- Login/auth ko kabhi touch mat karo reset ke time.
- Agar delete order par FK error aaye to pehle child table identify karo, phir usko delete karo.
