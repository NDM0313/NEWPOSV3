SELECT column_name FROM information_schema.columns
WHERE table_name = 'accounts' AND column_name ILIKE '%opening%';

SELECT id, code, name, balance, opening_balance, contact_id, metadata
FROM accounts WHERE id = 'cbd6a16a-5521-43d5-ba33-01994d47c481';

SELECT * FROM account_opening_balances WHERE account_id = 'cbd6a16a-5521-43d5-ba33-01994d47c481' LIMIT 5;
