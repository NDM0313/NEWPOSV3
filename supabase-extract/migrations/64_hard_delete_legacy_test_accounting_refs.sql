-- Hard cleanup: remove legacy test_* accounting references from journal headers.
-- Canonical reference types are used by runtime and test tools.

DO $$
BEGIN
  IF to_regclass('public.journal_entries') IS NOT NULL THEN
    DELETE FROM journal_entries
    WHERE reference_type IN (
      'test_manual',
      'test_transfer',
      'test_supplier_payment',
      'test_worker_payment',
      'test_expense',
      'test_customer_receipt'
    );
  END IF;
END
$$;
