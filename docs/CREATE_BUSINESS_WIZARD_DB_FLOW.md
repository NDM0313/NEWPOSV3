# Create Business Wizard — Database Generation Flow

## Overview

On final submit, the system must perform all operations inside **one DB transaction**. On failure, rollback everything.

---

## Current Flow (create_business_transaction)

The existing `create_business_transaction` RPC does:

1. Create `companies` row
2. Create `branches` row (default "Main Branch", "HQ")
3. Create `users` row (public.users)
4. Create `user_branches` link (if table exists)
5. Create `units` row (Piece)
6. Create `accounts` rows: 1000 (Cash), 1010 (Bank), 1020 (Mobile Wallet), 1100 (AR), 2000 (AP), 5000 (Operating Expense)

---

## Extended Flow (Wizard — To Implement)

### New RPC: `create_business_wizard_transaction`

**Parameters (extended):**

- `p_business_name`, `p_owner_name`, `p_email`, `p_password`, `p_user_id` (existing)
- `p_currency` (default PKR)
- `p_fiscal_year_start` (date)
- `p_branch_name` (default "Main Branch")
- `p_branch_code` (default "HQ")
- `p_business_type` (retail/rental/etc.)
- `p_phone`, `p_address`, `p_country`, `p_timezone`
- `p_accounting_method` (accrual/cash)
- `p_tax_mode` (inclusive/exclusive)
- `p_default_tax_rate`
- `p_costing_method` (FIFO/Weighted Average)
- `p_allow_negative_stock`
- `p_modules` (JSONB array: ['sales','purchases',...])
- `p_logo_url` (optional)

### Transaction Steps (in order)

1. **companies** — INSERT with name, email, phone, address, country, currency, financial_year_start, logo_url, etc.
2. **branches** — INSERT with custom name, code
3. **users** — INSERT
4. **user_branches** — INSERT
5. **units** — INSERT Piece + any additional from base_units
6. **accounts** — INSERT Cash, Bank, Mobile Wallet, AR, AP, Operating Expense, Worker Payable, Cost of Production
7. **settings** — INSERT key-value for company settings (modules, tax, inventory, etc.)
8. **numbering_rules** or **document_sequences** — INSERT prefixes and next numbers
9. **roles** — INSERT Super Admin role
10. **module_config** (if exists) — INSERT enabled modules

---

## Tables Touched

| Table | Operation | Notes |
|-------|-----------|-------|
| `companies` | INSERT | Core company record |
| `branches` | INSERT | First branch |
| `users` | INSERT | Owner as admin |
| `user_branches` | INSERT | Link user to branch |
| `units` | INSERT | Piece + optional units |
| `accounts` | INSERT | Default chart of accounts |
| `settings` | INSERT | Company settings (key-value) |
| `numbering_rules` | INSERT | Or document_sequences |
| `roles` | INSERT | Super Admin |
| `module_config` | INSERT | If table exists |
| `storage.objects` | INSERT | Logo upload (optional, separate) |

---

## Validation Rules (Enforced in RPC)

- Currency is mandatory
- Financial year start mandatory
- At least one module required
- At least one branch required (created in same tx)
- Business name unique per company owner (check before insert)

---

## Future Extensions

- **GST modules:** Add tax config table inserts
- **Multi-currency:** Add currency table, exchange rates
- **Payroll:** Add payroll_config, salary structure
- **Subscription plans:** Add plan_id to companies

---

## Frontend Integration

The wizard collects all data and calls `businessService.createBusiness()` with extended params. The `businessService` must be updated to:

1. Accept the new fields
2. Call `create_business_wizard_transaction` RPC (when implemented)
3. Or: call existing `create_business_transaction` + follow-up API calls for settings, numbering, modules (non-transactional fallback)

**Recommended:** Implement `create_business_wizard_transaction` for atomicity.
