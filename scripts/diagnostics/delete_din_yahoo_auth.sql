-- Delete orphan din@yahoo.com auth user (clean slate for Create Business wizard)
DELETE FROM auth.identities
WHERE user_id IN (SELECT id FROM auth.users WHERE LOWER(email) = 'din@yahoo.com');

DELETE FROM auth.users WHERE LOWER(email) = 'din@yahoo.com';

SELECT CASE WHEN count(*) = 0 THEN 'din@yahoo.com removed OK' ELSE 'STILL EXISTS' END AS status
FROM auth.users WHERE LOWER(email) = 'din@yahoo.com';
