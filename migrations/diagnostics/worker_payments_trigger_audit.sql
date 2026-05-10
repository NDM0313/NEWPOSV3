-- Optional audit: find DB objects referencing legacy worker_payments (relation missing on some tenants).
-- Run in SQL Editor on the database that reported: relation "public.worker_payments" does not exist

SELECT tgname AS trigger_name, pg_get_triggerdef(t.oid) AS definition
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('payments', 'journal_entries', 'worker_ledger_entries')
  AND NOT t.tgisinternal
  AND pg_get_triggerdef(t.oid) ILIKE '%worker_payments%';

SELECT p.proname, pg_get_functiondef(p.oid)
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND pg_get_functiondef(p.oid) ILIKE '%worker_payments%';
