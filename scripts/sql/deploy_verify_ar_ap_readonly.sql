-- Post-deploy read-only safety check (AR/AP Phase 1+2 deploy)
SELECT invoice_no, status FROM sales WHERE invoice_no IN ('SL-0005','SL-0006','SL-0012') ORDER BY invoice_no;
SELECT COUNT(*) AS rcv_active_jes FROM journal_entries je
  JOIN payments p ON p.id = je.payment_id OR (je.reference_type = 'payment' AND je.reference_id = p.id)
  WHERE p.reference_number IN ('RCV-0017','RCV-0018','RCV-0019') AND COALESCE(je.is_void, false) = false;
