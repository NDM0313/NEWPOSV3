-- Keep journal_entries.total_debit / total_credit aligned with journal_entry_lines.
-- App historically inserted lines without updating the header; reports and some UIs read the header.

CREATE OR REPLACE FUNCTION public.refresh_journal_entry_totals_from_lines()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  target_id UUID;
  v_debit NUMERIC(15, 2);
  v_credit NUMERIC(15, 2);
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_id := OLD.journal_entry_id;
  ELSE
    target_id := NEW.journal_entry_id;
  END IF;

  SELECT
    COALESCE(SUM(debit), 0)::NUMERIC(15, 2),
    COALESCE(SUM(credit), 0)::NUMERIC(15, 2)
  INTO v_debit, v_credit
  FROM public.journal_entry_lines
  WHERE journal_entry_id = target_id;

  UPDATE public.journal_entries
  SET
    total_debit = v_debit,
    total_credit = v_credit,
    updated_at = COALESCE(updated_at, now())
  WHERE id = target_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_journal_entry_lines_refresh_totals ON public.journal_entry_lines;

CREATE TRIGGER trg_journal_entry_lines_refresh_totals
AFTER INSERT OR UPDATE OR DELETE ON public.journal_entry_lines
FOR EACH ROW
EXECUTE FUNCTION public.refresh_journal_entry_totals_from_lines();

-- One-time backfill for existing rows where header totals disagree with lines.
UPDATE public.journal_entries je
SET
  total_debit = COALESCE(x.d, 0),
  total_credit = COALESCE(x.c, 0),
  updated_at = COALESCE(je.updated_at, now())
FROM (
  SELECT
    jel.journal_entry_id AS id,
    COALESCE(SUM(jel.debit), 0)::NUMERIC(15, 2) AS d,
    COALESCE(SUM(jel.credit), 0)::NUMERIC(15, 2) AS c
  FROM public.journal_entry_lines jel
  GROUP BY jel.journal_entry_id
) x
WHERE je.id = x.id
  AND (
    COALESCE(je.total_debit, 0) <> COALESCE(x.d, 0)
    OR COALESCE(je.total_credit, 0) <> COALESCE(x.c, 0)
  );
