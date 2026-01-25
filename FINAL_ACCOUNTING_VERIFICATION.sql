-- Final verification of all accounting fixes

-- 1. Check reference number uniqueness
SELECT 
  '1. Reference Uniqueness' as check_name,
  COUNT(*) as total_payments,
  COUNT(DISTINCT reference_number) as unique_references,
  CASE WHEN COUNT(*) = COUNT(DISTINCT reference_number) THEN 'PASS' ELSE 'FAIL' END as status
FROM payments
WHERE reference_type = 'sale';

-- 2. Check payment journal entry coverage
SELECT 
  '2. Payment Journal Coverage' as check_name,
  COUNT(*) as total_payments,
  COUNT(DISTINCT je.payment_id) as payments_with_journal,
  CASE WHEN COUNT(*) = COUNT(DISTINCT je.payment_id) THEN 'PASS' ELSE 'FAIL' END as status
FROM payments p
LEFT JOIN journal_entries je ON je.payment_id = p.id
WHERE p.reference_type = 'sale';

-- 3. Check account balances match journal entries
SELECT 
  '3. Account Balance Accuracy' as check_name,
  a.code,
  a.name,
  a.balance as stored_balance,
  COALESCE((SELECT SUM(jel.debit - jel.credit) 
    FROM journal_entry_lines jel 
    JOIN journal_entries je ON je.id = jel.journal_entry_id 
    WHERE jel.account_id = a.id AND je.company_id = a.company_id), 0) as calculated_balance,
  CASE WHEN ABS(a.balance - COALESCE((SELECT SUM(jel.debit - jel.credit) 
    FROM journal_entry_lines jel 
    JOIN journal_entries je ON je.id = jel.journal_entry_id 
    WHERE jel.account_id = a.id AND je.company_id = a.company_id), 0)) < 0.01 
    THEN 'PASS' ELSE 'FAIL' END as status
FROM accounts a
WHERE a.code IN ('1000', '1010', '2000', '4100', '5100', '5200')
  AND a.company_id = '5aac3c47-af92-44f4-aa7d-4ca5bd4c135b'
ORDER BY a.code;

-- 4. Check discount/expense entries
SELECT 
  '4. Discount/Expense Coverage' as check_name,
  COUNT(*) as sales_with_discount_or_expense,
  (SELECT COUNT(*) FROM journal_entries je WHERE je.description LIKE '%discount%') as discount_entries,
  (SELECT COUNT(*) FROM journal_entries je WHERE je.description LIKE '%expense%') as expense_entries,
  CASE WHEN (SELECT COUNT(*) FROM sales WHERE discount_amount > 0) <= 
    (SELECT COUNT(*) FROM journal_entries je WHERE je.description LIKE '%discount%')
    AND (SELECT COUNT(*) FROM sales WHERE expenses > 0) <= 
    (SELECT COUNT(*) FROM journal_entries je WHERE je.description LIKE '%expense%')
    THEN 'PASS' ELSE 'FAIL' END as status
FROM sales
WHERE discount_amount > 0 OR expenses > 0;

-- 5. Check multi-payment support (same invoice, different methods)
SELECT 
  '5. Multi-Payment Support' as check_name,
  s.invoice_no,
  COUNT(DISTINCT p.id) as payment_count,
  COUNT(DISTINCT p.payment_method) as method_count,
  STRING_AGG(DISTINCT p.reference_number::TEXT, ', ' ORDER BY p.reference_number::TEXT) as references
FROM sales s
JOIN payments p ON p.reference_id = s.id
WHERE p.reference_type = 'sale'
GROUP BY s.invoice_no
HAVING COUNT(DISTINCT p.id) > 1
ORDER BY payment_count DESC
LIMIT 5;
