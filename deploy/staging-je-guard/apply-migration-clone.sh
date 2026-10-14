#!/usr/bin/env bash
set -euo pipefail
CLONE_DB=ledger_stage_20260919_prodcheck
DB=$(docker exec supabase-db psql -U postgres -d "$CLONE_DB" -t -A -c "SELECT current_database();")
echo "APPLY_TARGET=$DB"
[[ "$DB" == "ledger_stage_20260919_prodcheck" ]]
[[ "$DB" != "postgres" ]]

docker exec -i supabase-db psql -U postgres -d "$CLONE_DB" -v ON_ERROR_STOP=1 < /tmp/guard_migration.sql \
  > /tmp/guard_migrate_out.txt 2>&1 || { echo MIGRATE_FAIL; tail -50 /tmp/guard_migrate_out.txt; exit 1; }

grep -E "COMMIT|NOTICE:|ERROR:" /tmp/guard_migrate_out.txt | head -50 || true

docker exec -i supabase-db psql -U postgres -d "$CLONE_DB" -v ON_ERROR_STOP=1 <<'SQL'
SELECT
  has_function_privilege('authenticated','public.resolve_journal_posting_account_id(uuid,uuid)','execute') AS auth_resolve,
  has_function_privilege('authenticated','public._journal_account_guard_resolve_public_core(uuid,uuid)','execute') AS auth_public_core,
  has_function_privilege('authenticated','public._journal_account_guard_resolve_core(uuid,uuid,boolean)','execute') AS auth_core,
  has_function_privilege('authenticated','public._journal_account_guard_resolve_internal(uuid,uuid,uuid)','execute') AS auth_internal,
  has_function_privilege('authenticated','public.repair_restore_journal_entry_line_account(uuid,uuid,uuid,uuid,numeric,numeric,uuid)','execute') AS auth_repair,
  has_function_privilege('anon','public.resolve_journal_posting_account_id(uuid,uuid)','execute') AS anon_resolve,
  has_function_privilege('service_role','public.repair_restore_journal_entry_line_account(uuid,uuid,uuid,uuid,numeric,numeric,uuid)','execute') AS svc_repair,
  has_function_privilege('service_role','public._repair_restore_journal_entry_line_account_internal(uuid,uuid,uuid,uuid,numeric,numeric,uuid)','execute') AS svc_repair_internal,
  has_table_privilege('authenticated','public._journal_account_repair_tickets','insert') AS auth_tickets_ins;
SELECT tgname FROM pg_trigger t
JOIN pg_class c ON c.oid=t.tgrelid
JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname='journal_entry_lines' AND NOT tgisinternal
ORDER BY 1;
SQL
echo "MIGRATE_ACL_OK"
