-- Flag studio productions that still need manual GL work after sale cancel (paid worker stages).
ALTER TABLE public.studio_productions
  ADD COLUMN IF NOT EXISTS cancel_gl_review_needed BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.studio_productions.cancel_gl_review_needed IS
  'Set when linked sale was cancelled but some stage costs were already paid — reverse with accountant / worker settlement manually.';
