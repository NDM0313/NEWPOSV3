SELECT je.entry_no,
       je.reference_type,
       jel.debit,
       jel.credit,
       sm.quantity,
       sm.unit_cost,
       sm.total_cost,
       p.cost_price
FROM journal_entries je
JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
LEFT JOIN stock_movements sm ON sm.id = je.reference_id
LEFT JOIN products p ON p.id = sm.product_id
WHERE je.entry_no IN ('JE-0232', 'JE-0233')
  AND COALESCE(je.is_void, false) = false;
