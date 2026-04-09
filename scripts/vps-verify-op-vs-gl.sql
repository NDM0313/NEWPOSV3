\set company '595c08c2-1e47-4581-89c9-1f78de51c613'

\echo '=== schema_migrations contact_balances related ==='
SELECT name FROM schema_migrations
WHERE name LIKE '%contact_balance%' OR name LIKE '%party_gl%'
ORDER BY name;

\echo '=== Operational vs party GL (branch NULL) ==='
SELECT c.name, c.type,
  op.receivables AS op_recv, op.payables AS op_pay,
  gl.gl_ar_receivable AS gl_ar, gl.gl_ap_payable AS gl_ap
FROM contacts c
LEFT JOIN LATERAL get_contact_balances_summary(:'company'::uuid, NULL::uuid) op ON op.contact_id = c.id
LEFT JOIN LATERAL get_contact_party_gl_balances(:'company'::uuid, NULL::uuid) gl ON gl.contact_id = c.id
WHERE c.company_id = :'company'::uuid
  AND (
    c.name ILIKE '%ABC%' OR c.name ILIKE '%Ali%' OR c.name ILIKE '%DIN COLLECTION%'
    OR c.name ILIKE '%DIN COUTURE%' OR c.name ILIKE '%KHURAM SILK%' OR c.name ILIKE '%SATTAR%'
    OR c.name ILIKE '%Salar%'
  )
ORDER BY c.name;

\echo '=== Sum cards check (supplier+customer+both rules match ContactsPage filters) ==='
WITH t AS (
  SELECT * FROM get_contact_balances_summary(:'company'::uuid, NULL::uuid)
)
SELECT
  (SELECT COALESCE(SUM(receivables),0) FROM t JOIN contacts c ON c.id = t.contact_id
   WHERE c.company_id = :'company'::uuid AND c.type IN ('customer','both')) AS sum_recv_customers,
  (SELECT COALESCE(SUM(payables),0) FROM t JOIN contacts c ON c.id = t.contact_id
   WHERE c.company_id = :'company'::uuid AND c.type IN ('supplier','both')) AS sum_pay_suppliers;
