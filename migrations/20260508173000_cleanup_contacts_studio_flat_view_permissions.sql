-- Remove legacy flat "view" permissions for contacts/studio.
-- Scope-only policy: use view_own / view_branch / view_company.

begin;

delete from public.role_permissions
where module in ('contacts', 'studio')
  and action = 'view';

commit;
