-- Live truth table: target contacts, raw-style legs, RPC, party GL, branch NULL vs sample branch.
-- Usage: pipe to ssh dincouture-vps "docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1"
\set company '595c08c2-1e47-4581-89c9-1f78de51c613'

\echo '=== Pick first active branch id for company (for branch-scoped RPC column) ==='
SELECT id AS sample_branch_id FROM branches WHERE company_id = :'company'::uuid AND (is_active IS NULL OR is_active = true) ORDER BY name LIMIT 1;

\echo '=== Target contacts base ==='
WITH t AS (
  SELECT c.id, c.name, c.type, c.opening_balance, c.supplier_opening_balance, c.branch_id
  FROM contacts c
  WHERE c.company_id = :'company'::uuid
    AND (
      c.name ILIKE '%ABC%' OR c.name ILIKE '%Ali%' OR c.name ILIKE '%DIN COLLECTION%'
      OR c.name ILIKE '%DIN COUTURE%' OR c.name ILIKE '%KHURAM SILK%' OR c.name ILIKE '%SATTAR%'
      OR c.name ILIKE '%Salar%'
    )
)
SELECT * FROM t ORDER BY name;

\echo '=== Raw-style recv: opening + final sales due (branch NULL / company-wide doc filter) ==='
WITH t AS (
  SELECT c.id AS contact_id, c.name,
    (CASE WHEN c.type IN ('customer','both') THEN GREATEST(0, COALESCE(c.opening_balance,0)::numeric) ELSE 0 END)
    + COALESCE((SELECT SUM(GREATEST(0, COALESCE(s.due_amount, (COALESCE(s.total,0)-COALESCE(s.paid_amount,0)))::numeric))
      FROM sales s WHERE s.company_id = :'company'::uuid AND s.customer_id = c.id
        AND LOWER(TRIM(COALESCE(s.status::text,''))) = 'final'), 0) AS raw_recv_docs
  FROM contacts c
  WHERE c.company_id = :'company'::uuid
    AND (c.name ILIKE '%ABC%' OR c.name ILIKE '%Ali%' OR c.name ILIKE '%DIN COLLECTION%'
      OR c.name ILIKE '%DIN COUTURE%' OR c.name ILIKE '%KHURAM SILK%' OR c.name ILIKE '%SATTAR%' OR c.name ILIKE '%Salar%')
)
SELECT * FROM t ORDER BY name;

\echo '=== Raw-style pay: supplier opening + final/received purchase due ==='
WITH t AS (
  SELECT c.id AS contact_id, c.name,
    (CASE WHEN c.type IN ('supplier','both') THEN GREATEST(0, COALESCE(c.supplier_opening_balance, c.opening_balance, 0)::numeric) ELSE 0 END)
    + COALESCE((SELECT SUM(GREATEST(0, COALESCE(p.due_amount, (COALESCE(p.total,0)-COALESCE(p.paid_amount,0)))::numeric))
      FROM purchases p WHERE p.company_id = :'company'::uuid AND p.supplier_id = c.id
        AND LOWER(TRIM(COALESCE(p.status::text,''))) IN ('final','received')), 0) AS raw_pay_docs
  FROM contacts c
  WHERE c.company_id = :'company'::uuid
    AND (c.name ILIKE '%ABC%' OR c.name ILIKE '%Ali%' OR c.name ILIKE '%DIN COLLECTION%'
      OR c.name ILIKE '%DIN COUTURE%' OR c.name ILIKE '%KHURAM SILK%' OR c.name ILIKE '%SATTAR%' OR c.name ILIKE '%Salar%')
)
SELECT * FROM t ORDER BY name;

\echo '=== RPC NULL branch ==='
SELECT c.name, c.type, b.receivables, b.payables
FROM contacts c
JOIN LATERAL get_contact_balances_summary(:'company'::uuid, NULL::uuid) b ON b.contact_id = c.id
WHERE c.company_id = :'company'::uuid
  AND (c.name ILIKE '%ABC%' OR c.name ILIKE '%Ali%' OR c.name ILIKE '%DIN COLLECTION%'
    OR c.name ILIKE '%DIN COUTURE%' OR c.name ILIKE '%KHURAM SILK%' OR c.name ILIKE '%SATTAR%' OR c.name ILIKE '%Salar%')
ORDER BY c.name;

\echo '=== Party GL NULL branch ==='
SELECT c.name, c.type, g.gl_ar_receivable, g.gl_ap_payable
FROM contacts c
JOIN LATERAL get_contact_party_gl_balances(:'company'::uuid, NULL::uuid) g ON g.contact_id = c.id
WHERE c.company_id = :'company'::uuid
  AND (c.name ILIKE '%ABC%' OR c.name ILIKE '%Ali%' OR c.name ILIKE '%DIN COLLECTION%'
    OR c.name ILIKE '%DIN COUTURE%' OR c.name ILIKE '%KHURAM SILK%' OR c.name ILIKE '%SATTAR%' OR c.name ILIKE '%Salar%')
ORDER BY c.name;

\echo '=== RPC + GL with sample branch (first branch row above) ==='
SELECT c.name, r.receivables AS rpc_recv, r.payables AS rpc_pay, g.gl_ar_receivable, g.gl_ap_payable
FROM contacts c
CROSS JOIN LATERAL (SELECT id FROM branches WHERE company_id = :'company'::uuid AND (is_active IS NULL OR is_active = true) ORDER BY name LIMIT 1) br
JOIN LATERAL get_contact_balances_summary(:'company'::uuid, br.id) r ON r.contact_id = c.id
JOIN LATERAL get_contact_party_gl_balances(:'company'::uuid, br.id) g ON g.contact_id = c.id
WHERE c.company_id = :'company'::uuid
  AND (c.name ILIKE '%ABC%' OR c.name ILIKE '%Ali%' OR c.name ILIKE '%DIN COLLECTION%'
    OR c.name ILIKE '%DIN COUTURE%' OR c.name ILIKE '%KHURAM SILK%' OR c.name ILIKE '%SATTAR%' OR c.name ILIKE '%Salar%')
ORDER BY c.name;

\echo '=== Manual receipts: allocated vs unallocated (received, manual_receipt+on_account) ==='
SELECT p.contact_id, c.name, p.reference_type::text, p.amount::numeric AS amount,
  COALESCE((SELECT SUM(pa.allocated_amount)::numeric FROM payment_allocations pa WHERE pa.payment_id = p.id), 0) AS allocated,
  GREATEST(0, p.amount::numeric - COALESCE((SELECT SUM(pa.allocated_amount)::numeric FROM payment_allocations pa WHERE pa.payment_id = p.id), 0)) AS unalloc_portion
FROM payments p
JOIN contacts c ON c.id = p.contact_id AND c.company_id = :'company'::uuid
WHERE p.company_id = :'company'::uuid AND p.voided_at IS NULL
  AND LOWER(TRIM(COALESCE(p.payment_type::text,''))) = 'received'
  AND LOWER(TRIM(COALESCE(p.reference_type::text,''))) IN ('manual_receipt','on_account')
  AND c.name ILIKE ANY (ARRAY['%ABC%','%Ali%','%DIN COLLECTION%','%DIN COUTURE%','%KHURAM SILK%','%SATTAR%','%Salar%'])
ORDER BY c.name, p.payment_date;

\echo '=== Manual payments: allocated vs unallocated (paid, manual_payment+on_account) ==='
SELECT p.contact_id, c.name, p.reference_type::text, p.amount::numeric AS amount,
  COALESCE((SELECT SUM(pa.allocated_amount)::numeric FROM payment_allocations pa WHERE pa.payment_id = p.id), 0) AS allocated,
  GREATEST(0, p.amount::numeric - COALESCE((SELECT SUM(pa.allocated_amount)::numeric FROM payment_allocations pa WHERE pa.payment_id = p.id), 0)) AS unalloc_portion
FROM payments p
JOIN contacts c ON c.id = p.contact_id AND c.company_id = :'company'::uuid
WHERE p.company_id = :'company'::uuid AND p.voided_at IS NULL
  AND LOWER(TRIM(COALESCE(p.payment_type::text,''))) = 'paid'
  AND LOWER(TRIM(COALESCE(p.reference_type::text,''))) IN ('manual_payment','on_account')
  AND c.name ILIKE ANY (ARRAY['%ABC%','%Ali%','%DIN COLLECTION%','%DIN COUTURE%','%KHURAM SILK%','%SATTAR%','%Salar%'])
ORDER BY c.name, p.payment_date;
