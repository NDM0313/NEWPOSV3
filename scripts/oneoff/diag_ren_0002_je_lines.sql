SELECT jel.journal_entry_id, jel.debit, jel.credit, a.code, a.name, a.type
FROM rental_payments rp
JOIN journal_entry_lines jel ON jel.journal_entry_id = rp.journal_entry_id
JOIN accounts a ON a.id = jel.account_id
WHERE rp.id = '1865ea77-54bf-4f8d-a909-592863dd753c';
