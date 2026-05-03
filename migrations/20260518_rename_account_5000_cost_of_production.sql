-- Rename chart account 5000 from legacy "Operating Expense" label to "Cost of Production".
-- Code 5000 is used for studio/worker direct production cost (Dr 5000 on stage completion), not rent/utilities opex.
-- Trial Balance, GL, and journal line displays that join accounts.name will show the new label immediately.
-- Historical journal_entry_lines.description text is not rewritten (optional manual cleanup only).

UPDATE public.accounts
SET name = 'Cost of Production'
WHERE code = '5000'
  AND lower(trim(COALESCE(name, ''))) IN ('operating expense', 'operating expenses');
