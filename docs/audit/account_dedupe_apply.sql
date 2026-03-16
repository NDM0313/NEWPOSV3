-- Account name dedupe: one canonical account per (company_id, normalized name).
-- Canonical: prefer standard code (1100 AR, 1010 Bank); else oldest id. Repoint journal_entry_lines; mark duplicate inactive.
-- Company: eb71d817-b87e-4195-964b-7b5321b480f5. Idempotent (duplicate already inactive is skipped).

-- Accounts receivable: canonical = prefer code 1100
DO $$
DECLARE
  v_company_id UUID := 'eb71d817-b87e-4195-964b-7b5321b480f5';
  v_canonical_id UUID;
  v_dup_id UUID;
BEGIN
  SELECT id INTO v_canonical_id
  FROM accounts
  WHERE company_id = v_company_id AND LOWER(TRIM(name)) = 'accounts receivable' AND is_active = true
  ORDER BY (code = '1100') DESC NULLS LAST, created_at ASC
  LIMIT 1;
  IF v_canonical_id IS NOT NULL THEN
    FOR v_dup_id IN
      SELECT id FROM accounts
      WHERE company_id = v_company_id AND LOWER(TRIM(name)) = 'accounts receivable' AND id != v_canonical_id AND is_active = true
    LOOP
      UPDATE journal_entry_lines SET account_id = v_canonical_id WHERE account_id = v_dup_id;
      UPDATE accounts SET is_active = false WHERE id = v_dup_id;
    END LOOP;
  END IF;
END $$;

-- Bank: canonical = prefer code 1010
DO $$
DECLARE
  v_company_id UUID := 'eb71d817-b87e-4195-964b-7b5321b480f5';
  v_canonical_id UUID;
  v_dup_id UUID;
BEGIN
  SELECT id INTO v_canonical_id
  FROM accounts
  WHERE company_id = v_company_id AND LOWER(TRIM(name)) = 'bank' AND is_active = true
  ORDER BY (code = '1010') DESC NULLS LAST, created_at ASC
  LIMIT 1;
  IF v_canonical_id IS NOT NULL THEN
    FOR v_dup_id IN
      SELECT id FROM accounts
      WHERE company_id = v_company_id AND LOWER(TRIM(name)) = 'bank' AND id != v_canonical_id AND is_active = true
    LOOP
      UPDATE journal_entry_lines SET account_id = v_canonical_id WHERE account_id = v_dup_id;
      UPDATE accounts SET is_active = false WHERE id = v_dup_id;
    END LOOP;
  END IF;
END $$;
