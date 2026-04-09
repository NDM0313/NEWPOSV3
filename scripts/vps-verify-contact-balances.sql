-- Run on VPS: docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 < scripts/vps-verify-contact-balances.sql
\set company '595c08c2-1e47-4581-89c9-1f78de51c613'

\echo '=== signatures ==='
SELECT p.oid::regprocedure::text AS sig
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname = 'get_contact_balances_summary' AND n.nspname = 'public';

\echo '=== body checks (substring) ==='
SELECT
  length(pg_get_functiondef(p.oid)) AS def_len,
  (pg_get_functiondef(p.oid) LIKE '%payment_allocations%') AS has_payment_allocations,
  (pg_get_functiondef(p.oid) LIKE '%allocated_amount%') AS has_allocated_amount,
  (pg_get_functiondef(p.oid) ~ 'p\\.amount::numeric\\s*-\\s*COALESCE') AS has_amount_minus_allocated,
  (pg_get_functiondef(p.oid) LIKE '%voided_at%') AS has_voided_at,
  (pg_get_functiondef(p.oid) LIKE '%OR s.branch_id IS NULL%') AS has_branch_null_sales
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname = 'get_contact_balances_summary'
  AND n.nspname = 'public'
  AND pg_get_function_identity_arguments(p.oid) = 'p_company_id uuid, p_branch_id uuid';

\echo '=== contacts matching names ==='
SELECT id, name, type, opening_balance, supplier_opening_balance
FROM contacts
WHERE company_id = :'company'::uuid
  AND (
    name ILIKE '%ABC%' OR name ILIKE '%Ali%' OR name ILIKE '%DIN COLLECTION%'
    OR name ILIKE '%DIN COUTURE%' OR name ILIKE '%KHURAM SILK%' OR name ILIKE '%SATTAR%'
    OR name ILIKE '%Salar%'
  )
ORDER BY name;

\echo '=== RPC branch NULL (subset) ==='
SELECT c.name, c.type, b.receivables, b.payables
FROM contacts c
JOIN LATERAL get_contact_balances_summary(:'company'::uuid, NULL::uuid) b ON b.contact_id = c.id
WHERE c.company_id = :'company'::uuid
  AND (
    c.name ILIKE '%ABC%' OR c.name ILIKE '%Ali%' OR c.name ILIKE '%DIN COLLECTION%'
    OR c.name ILIKE '%DIN COUTURE%' OR c.name ILIKE '%KHURAM SILK%' OR c.name ILIKE '%SATTAR%'
    OR c.name ILIKE '%Salar%'
  )
ORDER BY c.name;
