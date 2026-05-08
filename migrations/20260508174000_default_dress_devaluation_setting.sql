-- Global rental devaluation default amount (per company).
-- Used by web + mobile rental booking flows for automatic devaluation posting.

begin;

insert into public.settings (company_id, key, value, category, description)
select
  c.id,
  'default_dress_devaluation',
  to_jsonb(5000),
  'rental',
  'Default dress devaluation amount auto-posted on rental booking'
from public.companies c
on conflict (company_id, key) do nothing;

commit;
