-- Party subledger: link AR/AP child accounts to contacts (control 1100 / 2000 remain roll-up parents).
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS linked_contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_accounts_company_linked_contact
  ON public.accounts(company_id, linked_contact_id)
  WHERE linked_contact_id IS NOT NULL;

COMMENT ON COLUMN public.accounts.linked_contact_id IS 'When set with parent_id under 1100/2000, this account is the party subledger for that contact.';
