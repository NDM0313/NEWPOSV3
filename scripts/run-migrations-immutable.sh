#!/usr/bin/env bash
# =============================================================================
# Immutable Migration Runner
# - Pre-run: pg_dump backup to backups/erp_backup_<timestamp>.dump
# - Ensures migration_history table exists; skips already-applied migrations.
# - Runs each migration in canonical order; records in migration_history.
# - At end runs validate-migration-state.sql; if FAIL → exit 1, restore from backup.
# Usage: DATABASE_URL='postgresql://...' ./scripts/run-migrations-immutable.sh
#        Or: source .env.local then run (script reads DATABASE_URL).
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MIGRATIONS_DIR="$ROOT/migrations"
BACKUPS_DIR="$ROOT/backups"
VALIDATE_SQL="$SCRIPT_DIR/validate-migration-state.sql"

# Load .env.local if present
if [[ -f "$ROOT/.env.local" ]]; then
  set -a
  source "$ROOT/.env.local" 2>/dev/null || true
  set +a
fi

DB_URL="${DATABASE_URL:-${DATABASE_ADMIN_URL:-${DATABASE_POOLER_URL:-}}}"
if [[ -z "$DB_URL" ]]; then
  echo "[IMMUTABLE] No DATABASE_URL/DATABASE_ADMIN_URL/DATABASE_POOLER_URL — abort." >&2
  exit 1
fi

# Canonical order (bootstrap first, then doc order 1–97). Filename = exact .sql name.
CANONICAL=(
  "migration_history_table.sql"
  "erp_production_mode_table.sql"
  "auth_user_id_and_user_auth_link.sql"
  "auth_user_id_functions.sql"
  "users_id_default_uuid.sql"
  "link_auth_users_to_public_users.sql"
  "ensure_quick_login_users_public.sql"
  "identity_model_auth_user_id.sql"
  "identity_model_enforce_fk_clean_orphans.sql"
  "fix_user_account_access_fk_to_auth_users.sql"
  "add_user_code_autogenerate.sql"
  "add_user_role_salesman_staff_cashier.sql"
  "global_identity_and_received_by.sql"
  "global_document_sequences_company.sql"
  "backfill_created_by_auth_user_id.sql"
  "add_system_flags_to_contacts.sql"
  "default_walkin_customer_mandatory.sql"
  "contacts_worker_and_contact_groups.sql"
  "contacts_global_customer_code_and_walkin.sql"
  "walkin_consolidation_single_per_company.sql"
  "walkin_strict_enforcement.sql"
  "walkin_post_consolidation_audit.sql"
  "contacts_rls_salesman_strict_isolation.sql"
  "add_accounts_subtype_column.sql"
  "ensure_ar_1100_and_fix_payment_journal.sql"
  "accounts_rls_allow_default_accounts.sql"
  "accounts_rls_allow_operator_inventory_payment.sql"
  "accounts_rls_allow_user_account_access.sql"
  "accounts_rls_allow_sale_accounting_codes.sql"
  "payments_rls_allow_insert.sql"
  "fix_payment_journal_ar_account_code.sql"
  "create_sales_revenue_account.sql"
  "branches_and_user_branches_rls.sql"
  "user_branches_admin_manage_rls.sql"
  "user_account_access_and_rbac_rls.sql"
  "sales_products_rls_role_based.sql"
  "sales_rls_enforce_branch_id.sql"
  "customers_sales_rls_controlled_access.sql"
  "stock_movements_rls_branch_based.sql"
  "activity_logs_table_if_not_exists.sql"
  "audit_logs_table_if_not_exists.sql"
  "fix_audit_logs_fk_and_document_sequences_rls.sql"
  "fix_users_rls_recursion.sql"
  "rpc_assign_user_branches_fk_fix.sql"
  "rpc_user_branches_validate_auth_user.sql"
  "rpc_user_branches_accounts_auth_id_only.sql"
  "rpc_set_user_branches_and_accounts.sql"
  "user_accountability_global.sql"
  "erp_permission_architecture_global.sql"
  "add_is_combo_product_to_products.sql"
  "add_journal_entries_columns.sql"
  "backfill_studio_productions_for_sales.sql"
  "backfill_worker_ledger_from_journal.sql"
  "create_product_combos_tables.sql"
  "enable_packing_setting.sql"
  "enterprise_defaults_and_rls_isolation.sql"
  "expense_categories_main_sub.sql"
  "expense_categories_type_and_paid_to.sql"
  "expenses_add_expense_no.sql"
  "fix_auto_post_sale_account_fallbacks.sql"
  "fix_current_balance_columns.sql"
  "fix_get_sale_studio_charges_batch.sql"
  "fix_inventory_balance_on_conflict.sql"
  "fix_stock_movements_company_id.sql"
  "fix_studio_document_number_std_prefix.sql"
  "inventory_balance_and_packing.sql"
  "inventory_balance_on_conflict_fix.sql"
  "inventory_masters_units_brands.sql"
  "invoice_template_system_phase_a.sql"
  "invoice_template_system_phase_b.sql"
  "invoice_template_system_phase_b_fix.sql"
  "ledger_master_and_entries.sql"
  "public_contact_registration_v2.sql"
  "record_customer_payment_rpc.sql"
  "rental_module_schema.sql"
  "rental_security_document_columns.sql"
  "sale_actions_logging.sql"
  "sales_is_studio_column.sql"
  "settings_mobile_barcode_scanner_policy.sql"
  "settings_mobile_printer_barcode_policy.sql"
  "settings_mobile_sync_policy.sql"
  "studio_assign_receive_workflow.sql"
  "studio_orders_tables_if_not_exists.sql"
  "studio_production_accounting_integrity.sql"
  "studio_production_module.sql"
  "studio_production_phase3_sale_not_null_and_expected_date.sql"
  "studio_production_sale_linked.sql"
  "studio_production_stages_add_expected_cost.sql"
  "studio_production_stages_no_auto_assign_guard.sql"
  "studio_sale_sync_and_accountability.sql"
  "studio_sales_integration_full.sql"
  "studio_sales_integration_verify.sql"
  "update_units_table_for_decimal_system.sql"
  "verify_accounts_rls_setup.sql"
  "verify_stock_movements_schema.sql"
  "worker_ledger_document_no.sql"
  "worker_ledger_entries_status.sql"
  "worker_ledger_payable_status.sql"
  "workers_sync_from_contacts.sql"
)

# Ensure migration_history table exists (run bootstrap migration if needed)
ensure_history_table() {
  local exists
  exists=$(psql "$DB_URL" -t -A -c "SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='migration_history' LIMIT 1;" 2>/dev/null || echo "")
  if [[ -z "${exists:-}" ]] || [[ "$exists" != "1" ]]; then
    echo "[IMMUTABLE] Creating migration_history table..."
    psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$MIGRATIONS_DIR/migration_history_table.sql"
    psql "$DB_URL" -v ON_ERROR_STOP=1 -c "INSERT INTO public.migration_history (filename) VALUES ('migration_history_table.sql') ON CONFLICT (filename) DO NOTHING;"
  fi
}

# 1. Check: already applied?
# 2. If not: run migration, then INSERT
run_one() {
  local filename="$1"
  local path="$MIGRATIONS_DIR/$filename"
  local applied
  applied=$(psql "$DB_URL" -t -A -c "SELECT 1 FROM public.migration_history WHERE filename = '$filename' LIMIT 1;" 2>/dev/null || echo "")
  if [[ -n "${applied:-}" ]] && [[ "$applied" == "1" ]]; then
    echo "[SKIP] $filename"
    return 0
  fi
  if [[ ! -f "$path" ]]; then
    echo "[WARN] Missing file: $path — skipping."
    return 0
  fi
  echo "[RUN] $filename"
  psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$path"
  psql "$DB_URL" -v ON_ERROR_STOP=1 -c "INSERT INTO public.migration_history (filename) VALUES ('$filename');"
}

# Pre-run: full DB backup (custom format, timestamped)
pre_run_backup() {
  mkdir -p "$BACKUPS_DIR"
  local dumpfile="$BACKUPS_DIR/erp_backup_$(date +%Y%m%d_%H%M%S).dump"
  echo "[IMMUTABLE] Pre-run backup: $dumpfile"
  pg_dump "$DB_URL" --format=custom --file="$dumpfile"
  echo "[IMMUTABLE] Backup done."
}

# Hard validation after run; if FAIL → abort (backup is kept)
validate_and_abort_on_fail() {
  local out
  out=$(psql "$DB_URL" -t -A -f "$VALIDATE_SQL" 2>&1)
  if echo "$out" | grep -q 'FAIL'; then
    echo "[IMMUTABLE] Validation FAILED. Abort deployment." >&2
    echo "$out" >&2
    echo "" >&2
    echo "Migration failed. Restore from last backup." >&2
    echo "  e.g. pg_restore --clean --if-exists -d \"\$DATABASE_URL\" $BACKUPS_DIR/<filename>.dump" >&2
    exit 1
  fi
  echo "[IMMUTABLE] Validation PASS."
}

# --- main ---
ensure_history_table
pre_run_backup

for f in "${CANONICAL[@]}"; do
  run_one "$f"
done

validate_and_abort_on_fail
echo "[IMMUTABLE] Done."
