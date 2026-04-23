SELECT n.nspname, p.proname, r.rolname AS owner
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
JOIN pg_roles r ON r.oid = p.proowner
WHERE p.proname IN (
  'generate_document_number',
  'record_payment_with_accounting',
  'finalize_sale_return'
);
