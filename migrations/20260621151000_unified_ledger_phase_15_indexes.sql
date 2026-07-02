-- Single Core Ledger — Phase 1.5 index verification (additive, IF NOT EXISTS)

CREATE INDEX IF NOT EXISTS idx_journal_entries_company_branch_active
  ON public.journal_entries (company_id, branch_id)
  WHERE COALESCE(is_void, FALSE) = FALSE;

CREATE INDEX IF NOT EXISTS idx_journal_entries_company_ref_type
  ON public.journal_entries (company_id, reference_type)
  WHERE COALESCE(is_void, FALSE) = FALSE;

CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_account_id
  ON public.journal_entry_lines (account_id);

CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_journal_entry_id
  ON public.journal_entry_lines (journal_entry_id);

CREATE INDEX IF NOT EXISTS idx_payments_company_contact_voided
  ON public.payments (company_id, contact_id)
  WHERE voided_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_accounts_company_linked_contact
  ON public.accounts (company_id, linked_contact_id)
  WHERE linked_contact_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sales_company_status
  ON public.sales (company_id, status);

CREATE INDEX IF NOT EXISTS idx_purchases_company_status
  ON public.purchases (company_id, status);

COMMENT ON INDEX public.idx_journal_entries_company_branch_active IS
  'Phase 1.5 unified ledger branch-scoped journal scans.';
