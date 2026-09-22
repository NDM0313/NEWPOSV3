-- One-time cleanup: mistaken duplicate expenses from mobile/web "edit" creating new rows.
-- REVIEW all SELECT output before running APPLY sections on production.
--
-- Usage on VPS:
--   ssh dincouture-vps "cd /root/NEWPOSV3 && docker exec -i \$(docker ps --format '{{.Names}}' | grep -E 'db|postgres' | head -1) psql -U supabase_admin -d postgres" < scripts/cleanup-duplicate-expenses.sql

-- =============================================================================
-- 1) DIAGNOSTIC — recent expenses with sequential expense_no (edit-save duplicates)
-- =============================================================================
SELECT
  expense_no,
  id,
  company_id,
  amount,
  description,
  expense_date,
  status,
  receipt_url,
  created_at
FROM expenses
WHERE expense_no ~ '^EXP-00(2[0-9]|3[0-9])$'
ORDER BY company_id, expense_no;

-- Clusters: same company + amount + description + expense_date, created within 30 minutes
SELECT
  company_id,
  amount,
  LEFT(description, 80) AS description_prefix,
  expense_date,
  COUNT(*) AS row_count,
  array_agg(expense_no ORDER BY expense_no) AS expense_nos,
  array_agg(id ORDER BY expense_no) AS expense_ids,
  MIN(created_at) AS first_created,
  MAX(created_at) AS last_created
FROM expenses
WHERE status IN ('paid', 'approved', 'pending')
GROUP BY company_id, amount, LEFT(description, 80), expense_date
HAVING COUNT(*) > 1
   AND MAX(created_at) - MIN(created_at) < interval '30 minutes'
ORDER BY last_created DESC
LIMIT 50;

-- =============================================================================
-- 2) APPLY — void posted/paid duplicates (keep lowest expense_no per cluster)
-- Uncomment and set company_id after reviewing SELECT above.
-- =============================================================================
/*
DO $$
DECLARE
  dup RECORD;
  keep_id uuid;
BEGIN
  FOR dup IN
    SELECT company_id, amount, LEFT(description, 80) AS desc_prefix, expense_date
    FROM expenses
    WHERE status IN ('paid', 'approved')
    GROUP BY company_id, amount, LEFT(description, 80), expense_date
    HAVING COUNT(*) > 1
       AND MAX(created_at) - MIN(created_at) < interval '30 minutes'
  LOOP
    SELECT id INTO keep_id
    FROM expenses
    WHERE company_id = dup.company_id
      AND amount = dup.amount
      AND LEFT(description, 80) = dup.desc_prefix
      AND expense_date = dup.expense_date
      AND status IN ('paid', 'approved')
    ORDER BY expense_no ASC
    LIMIT 1;

    UPDATE journal_entries
    SET is_void = true, void_reason = 'duplicate_expense_cleanup', voided_at = now()
    WHERE reference_type = 'expense'
      AND reference_id IN (
        SELECT id FROM expenses
        WHERE company_id = dup.company_id
          AND amount = dup.amount
          AND LEFT(description, 80) = dup.desc_prefix
          AND expense_date = dup.expense_date
          AND id <> keep_id
          AND status IN ('paid', 'approved')
      );

    UPDATE payments
    SET voided_at = now(), voided_reason = 'duplicate_expense_cleanup'
    WHERE reference_type = 'expense'
      AND reference_id IN (
        SELECT id FROM expenses
        WHERE company_id = dup.company_id
          AND amount = dup.amount
          AND LEFT(description, 80) = dup.desc_prefix
          AND expense_date = dup.expense_date
          AND id <> keep_id
          AND status IN ('paid', 'approved')
      )
      AND voided_at IS NULL;

    UPDATE expenses
    SET status = 'rejected', cancel_reason = 'Duplicate from mistaken edit-save (cleanup script)', updated_at = now()
    WHERE company_id = dup.company_id
      AND amount = dup.amount
      AND LEFT(description, 80) = dup.desc_prefix
      AND expense_date = dup.expense_date
      AND id <> keep_id
      AND status IN ('paid', 'approved');
  END LOOP;
END $$;
*/

-- =============================================================================
-- 3) APPLY — hard-delete pending (unposted) duplicates only (no GL)
-- =============================================================================
/*
DELETE FROM expenses e
USING (
  SELECT company_id, amount, LEFT(description, 80) AS desc_prefix, expense_date,
         MIN(expense_no) AS keep_no
  FROM expenses
  WHERE status = 'pending'
  GROUP BY company_id, amount, LEFT(description, 80), expense_date
  HAVING COUNT(*) > 1
) d
WHERE e.company_id = d.company_id
  AND e.amount = d.amount
  AND LEFT(e.description, 80) = d.desc_prefix
  AND e.expense_date = d.expense_date
  AND e.status = 'pending'
  AND e.expense_no <> d.keep_no;
*/
