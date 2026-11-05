#!/usr/bin/env bash
set -euo pipefail
CLONE_DB=ledger_stage_20260919_prodcheck
CONTAINER=supabase-db

docker exec -i "$CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 <<SQL
GRANT CONNECT ON DATABASE ${CLONE_DB} TO authenticator;
GRANT CONNECT ON DATABASE ${CLONE_DB} TO anon;
GRANT CONNECT ON DATABASE ${CLONE_DB} TO authenticated;
GRANT CONNECT ON DATABASE ${CLONE_DB} TO service_role;
GRANT CONNECT ON DATABASE ${CLONE_DB} TO supabase_auth_admin;
SQL

docker exec -i "$CONTAINER" psql -U postgres -d "$CLONE_DB" -v ON_ERROR_STOP=1 <<'SQL'
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role, authenticator;
GRANT USAGE, CREATE ON SCHEMA auth TO supabase_auth_admin;
GRANT ALL ON SCHEMA auth TO supabase_auth_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA auth TO supabase_auth_admin;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA auth TO supabase_auth_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated, service_role, anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role, anon;
SELECT current_database() AS db,
       has_database_privilege('authenticator', current_database(), 'CONNECT') AS authn_connect,
       has_database_privilege('supabase_auth_admin', current_database(), 'CONNECT') AS auth_admin_connect;
SQL
echo "CLONE_GRANTS_OK"
