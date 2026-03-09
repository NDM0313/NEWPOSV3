# Test-only migrations

**Do not run these on production.**

These scripts are for the **Studio Architecture TEST** plan and **Studio Manufacturing Accounting** (see `docs/MASTER_PROMPT_STUDIO_SAFETY.md` and `docs/STUDIO_ACCOUNTING_ANALYSIS.md`). Apply only to a **test / staging** database.

## Studio Architecture (earlier)

- **fix_sale_stock_movements_test.sql** — Sale final → stock movements trigger (test DB only).
- **get_studio_kanban_board_test.sql** — RPC returning productions grouped by stage for Kanban board (test DB only).

## Studio Manufacturing Accounting

Apply in order (or use `node scripts/test-manufacturing-accounting.js`):

- **create_manufacturing_accounts.sql** — Ensures accounts: Raw Material (1200), WIP (1210), FG (1220), COGS (5100), Production Expense (5000), Worker Payable (2010), Sales Revenue (4000).
- **calculate_production_cost.sql** — Function `calculate_production_cost(production_id)`; sets `studio_productions.actual_cost`.
- **studio_finished_goods_inventory_and_journal.sql** — On Generate Invoice: PRODUCTION stock movement + Dr FG Cr Prod Exp journal.
- **sale_final_cogs_journal_test.sql** — On sale final: Dr COGS Cr FG journal (in addition to existing revenue posting).
- **manufacturing_risk_controls_test.sql** — Unique index on PRODUCTION movements; validation functions.

After validation and approval, promote selected migrations to production in a controlled release.
