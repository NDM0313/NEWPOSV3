-- Branch fiscal year and location columns (Settings → Branches edit + Create Business parity)

ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS city VARCHAR(100);
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS state VARCHAR(100);
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS fiscal_year_start DATE;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS fiscal_year_end DATE;
