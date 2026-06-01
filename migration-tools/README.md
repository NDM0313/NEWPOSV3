# migration-tools — Phase 13 Hybrid Import

Temporary scripts to parse legacy `62547.sql` and emit JSON matching modern ERP client models.

## Quick start

```bash
# 1. Put dump at repo root OR pass path explicitly
node migration-tools/extractAccounts.js

# Or with explicit path (Windows Downloads example)
node migration-tools/extractAccounts.js "C:/Users/ndm31/Downloads/62547.sql"

# 2. Optional config
node migration-tools/extractAccounts.js --config migration-tools/config/mapping.json
```

Outputs land in `migration-tools/output/`:

- `accounts.json` — modern `AccountRow`-compatible rows + migration metadata
- `account_id_map.json` — legacy id → UUID lookup
- `ledgers.json` — Track A full ledger (`entries` = `JournalEntryRow` + lines; `meta.stats`)

### Ledger extract (Track A)

```bash
node migration-tools/extractAccounts.js
node migration-tools/extractLedger.js "C:/Users/ndm31/Downloads/62547.sql"
```

### Track B — Sales & Purchases (FY cut-off)

```bash
node migration-tools/extractSales.js "C:/Users/ndm31/Downloads/62547.sql"
node migration-tools/extractPurchases.js "C:/Users/ndm31/Downloads/62547.sql"
```

Cut-off: `transaction_date >= 2025-10-01`. Verified on Jul 2025 dump: **0 sales**, **0 purchases** extracted; **965** sales + **240** purchases skipped (no post-cutoff data in file).

### Track C — Contacts & Products (master data)

```bash
node migration-tools/extractContacts.js "C:/Users/ndm31/Downloads/62547.sql"
node migration-tools/extractProducts.js "C:/Users/ndm31/Downloads/62547.sql"
```

No date filter. Verified: **510 contacts**, **701 parent products**, **746 variants**.

## Config

Copy `config/mapping.example.json` to `config/mapping.json` and set:

- `legacyBusinessId`: `2` (DIN COUTURE)
- `targetCompanyId`: staging company UUID (dev-only)
- `financialYearCutoff`: `2025-10-01` (for future sales/purchase scripts)

See [`docs/migration_phase13_strategy_log.md`](../docs/migration_phase13_strategy_log.md) for full Roman Urdu roadmap.

## Go-Live import (Step 7)

After extraction JSON is in `output/`, load into a **new live company** (not the test placeholder UUID).

### One-click (Windows PowerShell)

```powershell
# From repo root:
.\migration-tools\run-import.ps1

# Or from migration-tools/:
cd migration-tools
.\run-import.ps1
```

Runs dry-run, then live `--confirm`. Partial rerun: `.\run-import.ps1 -ConfirmOnly -Phase ledgers`

### Env (`migration-tools/.env.migration`)

Copy [`.env.migration.example`](.env.migration.example). Required for live import:

| Variable | Notes |
|----------|--------|
| `TARGET_COMPANY_ID` | Live company UUID |
| `SUPABASE_URL` or `VITE_SUPABASE_URL` | e.g. `https://supabase.dincouture.pk` |
| `SUPABASE_SERVICE_ROLE_KEY` | **Required** for `--confirm` — not the anon key |

Get service role from VPS:

```bash
ssh dincouture-vps "grep '^SERVICE_ROLE_KEY=' /root/supabase/docker/.env"
```

Paste as `SUPABASE_SERVICE_ROLE_KEY=...` in `.env.migration`.

### Manual commands

From **repo root**:

```powershell
node migration-tools/importToSupabase.js --dry-run --target-company-id 597a5292-14c8-4cd8-96bd-c61b5a0d8c92
node migration-tools/importToSupabase.js --confirm --target-company-id 597a5292-14c8-4cd8-96bd-c61b5a0d8c92
```

From **`migration-tools/`** folder use `node importToSupabase.js` (no `migration-tools/` prefix).

| Flag | Purpose |
|------|---------|
| `--dry-run` | Validate env + JSON counts; no Supabase writes |
| `--confirm` | Required for live import |
| `--phase all\|contacts\|accounts\|products\|ledgers` | Partial rerun |
| `--batch-size 100` | Rows per upsert chunk (default 100) |

Insert order: contacts → accounts → products + variations → journal entries + lines.  
Report: `output/import_report.json`. See [`docs/migration_phase13_strategy_log.md`](../docs/migration_phase13_strategy_log.md) Step 7 (Roman Urdu).

## Rollback imported data

Undo Phase 13 load for **one company** only ([`rollbackImport.js`](rollbackImport.js)). Uses service role from `.env.migration`.

**Never deleted:** `companies`, `branches`, `users`, `user_branches`, `roles`, `permissions`, `role_permissions`, `settings` (only default account FKs cleared), `modules_config`.

```powershell
cd migration-tools

# Preview row counts
node rollbackImport.js --dry-run --journals-only
node rollbackImport.js --dry-run --all

# Delete journals + accounts (COA) only
node rollbackImport.js --confirm --journals-only

# Delete all imported master + GL (keeps walk-in customer)
node rollbackImport.js --confirm --all

# Interactive menu (1 = journals+accounts, 2 = all)
node rollbackImport.js --confirm
```

| Flag | Purpose |
|------|---------|
| `--dry-run` | Count rows only; no deletes |
| `--confirm` | Required for live delete |
| `--journals-only` | `journal_entry_lines` → `journal_entries` → `accounts` |
| `--all` | Above + `product_variations` → `products` + `contacts` (except `walking_customer`) |

Live delete prompts for exact company name confirmation unless `--yes` (used by `run-rollback.ps1 -Yes`).

### One-click rollback + re-import

```powershell
cd migration-tools
.\deploy-all.ps1              # rollback --all then import --all (non-interactive)
.\deploy-all.ps1 -DryRunOnly   # preview counts only
.\run-rollback.ps1 -ConfirmOnly -All -Yes
.\run-import.ps1 -ConfirmOnly
```

## Scripts

| Script | Track | Status |
|--------|-------|--------|
| `extractAccounts.js` | CoA | Ready |
| `extractLedger.js` | Full ledger (no date cut-off) | Ready |
| `extractSales.js` | FY sales | Ready |
| `extractPurchases.js` | FY purchases | Ready |
| `extractContacts.js` | Master contacts | Ready |
| `extractProducts.js` | Parent-variant catalog | Ready |
| `importToSupabase.js` | Go-Live load | Ready |
| `rollbackImport.js` | Company-scoped import undo | Ready |
| `run-rollback.ps1` / `deploy-all.ps1` | Automated rollback + full deploy | Ready |
| `validateReconciliation.js` | QA | Planned |
