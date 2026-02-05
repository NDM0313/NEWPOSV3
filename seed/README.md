# Fresh Data Seed

**Use only in test/dev.** This seed deletes all existing data for the first company and inserts clean, fully linked data.

## How to run

**Option A – psql (recommended)**  
From the project root (where `seed/` lives), with your Postgres URL:

```powershell
$env:DATABASE_URL = "postgresql://postgres:YOUR_PASSWORD@db.wrwljqzckmnmuphwhslt.supabase.co:5432/postgres"
psql $env:DATABASE_URL -f seed/fresh_data_seed.sql
```

Or one line (replace `YOUR_PASSWORD`):

```powershell
psql "postgresql://postgres:YOUR_PASSWORD@db.wrwljqzckmnmuphwhslt.supabase.co:5432/postgres" -f seed/fresh_data_seed.sql
```

**Option B – App (Node script, uses `.env.local`)**  
From project root. Requires `DATABASE_POOLER_URL` or `DATABASE_URL` in `.env.local`:

```bash
npm run seed
```

To run seed and then Phase 5 validation in one go:

```bash
npm run seed:full
```

To only run Phase 5 validation (after seed was already run):

```bash
npm run validate-seed
```

**Option C – Supabase Dashboard**  
1. Open **Supabase Dashboard** → SQL Editor.  
2. Paste the contents of `fresh_data_seed.sql`.  
3. Run the script.

## What it does

- **Deletes** (in safe order): worker_ledger_entries, ledger_entries, ledger_master, studio_production_stages, studio_production_logs, studio_productions, sale_items, sales, purchase_items, payments, purchases, expenses, document_sequences, workers, contacts, products, product_categories, accounts, users for the first company.
- **Inserts**:
  - **2 users:** Admin, Salesman (user ledger will be used for salary/commission).
  - **Accounts:** Cash, Bank, AR, AP, Sales.
  - **4 products:** 2 regular (shirt, trouser), 2 studio (kurta, dupatta).
  - **6 customers,** **2 suppliers,** **6 workers** (2 dyeing, 2 stitching, 2 handwork).
  - **2 regular sales:** SL-0001 (paid), SL-0002 (partial) + payments PAY-0001, PAY-0002.
  - **2 studio sales:** STD-0001, STD-0002 (unpaid).
  - **2 studio productions** linked to STD-0001 and STD-0002, with stages (dyer, stitching, handwork) and workers assigned.
  - **Worker ledger entries** JOB-0001 … JOB-0006 (some paid with PAY-0003–PAY-0005, rest unpaid).
  - **2 purchases:** PUR-0001 (partial payment), PUR-0002 (paid) + supplier ledger.
  - **Expenses:** EXP-0001 (salary to Admin), EXP-0002 (commission to Salesman) + user ledger + PAY-0008, PAY-0009.
  - **Document sequences** set so next numbers are SL-0003, STD-0003, PUR-0003, EXP-0003, PAY-0010, JOB-0007, JV-0001.

## After seed

- **Customer Ledger:** SL/STD invoices and payments; balances correct.
- **Supplier Ledger:** PUR entries and payments; outstanding visible.
- **User Ledger:** Salary and commission (debit), payments (credit); no sales/purchases.
- **Worker Ledger:** JOB refs, paid/unpaid, stage names and STD link.
- **Studio Dashboard:** STD-0001 and STD-0002 show with productions and stages.

## Phases (docs)

- **Phase 1:** `docs/FRONTEND_DATA_REQUIREMENT_BLUEPRINT.md` – frontend data requirements per module.
- **Phases 2–5:** `docs/PHASE_2_TO_5_MASTER_AND_SEED_PLAN.md` – master data, transaction flows, seed order, validation checklist. The app runs Phase 4 (seed) via `npm run seed` and Phase 5 (validation) via `npm run validate-seed` or `npm run seed:full`.

## Prerequisites

- Migrations applied (including `ledger_master_and_entries`, `worker_ledger_entries_status`, `worker_ledger_document_no`, `expenses_add_expense_no`, `sales_is_studio_column`, etc.).
- At least one **company** (and ideally one **branch**) in the database. The seed uses the first company and first branch; if none exist, it creates a seed company and main branch.
