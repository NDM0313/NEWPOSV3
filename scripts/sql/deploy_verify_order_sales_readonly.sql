SELECT invoice_no, status, total FROM sales
WHERE invoice_no IN ('SL-0005','SL-0006','SL-0012')
ORDER BY invoice_no;
