-- ============================================
-- AUTH ORPHAN CLEANUP (after public schema wipe)
-- ============================================
-- Lists auth.users rows with no matching public.users profile.
-- Public wipe (deploy/wipe-public-schema-data.sql) does NOT touch auth.*.
--
-- PREVIEW (default): lists orphans only.
-- To delete non-system orphans, run with psql variable:
--   psql ... -v delete_orphans=true -f deploy/wipe-auth-orphans.sql
--
-- NEVER deletes reserved system emails used by deploy quick-login.
-- ============================================

\echo '=== Auth users with no public.users link (orphans) ==='
SELECT au.id, au.email, au.created_at
FROM auth.users au
LEFT JOIN public.users pu ON pu.auth_user_id = au.id OR pu.id = au.id
WHERE pu.id IS NULL
  AND LOWER(au.email) NOT IN (
    'admin@dincouture.pk',
    'info@dincouture.pk',
    'demo@dincollection.com'
  )
ORDER BY au.created_at;

\if :{?delete_orphans}
\echo '=== DELETE mode: removing non-system orphan auth users ==='
DELETE FROM auth.identities
WHERE user_id IN (
  SELECT au.id
  FROM auth.users au
  LEFT JOIN public.users pu ON pu.auth_user_id = au.id OR pu.id = au.id
  WHERE pu.id IS NULL
    AND LOWER(au.email) NOT IN (
      'admin@dincouture.pk',
      'info@dincouture.pk',
      'demo@dincollection.com'
    )
);

DELETE FROM auth.users
WHERE id IN (
  SELECT au.id
  FROM auth.users au
  LEFT JOIN public.users pu ON pu.auth_user_id = au.id OR pu.id = au.id
  WHERE pu.id IS NULL
    AND LOWER(au.email) NOT IN (
      'admin@dincouture.pk',
      'info@dincouture.pk',
      'demo@dincollection.com'
    )
);

\echo '=== Remaining orphans (system accounts may still show) ==='
SELECT au.email, au.created_at
FROM auth.users au
LEFT JOIN public.users pu ON pu.auth_user_id = au.id OR pu.id = au.id
WHERE pu.id IS NULL
ORDER BY au.created_at;
\else
\echo 'Preview only. To delete orphans: psql ... -v delete_orphans=true -f deploy/wipe-auth-orphans.sql'
\endif
