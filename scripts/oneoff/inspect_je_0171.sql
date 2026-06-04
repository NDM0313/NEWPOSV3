SELECT je.id, je.entry_no, je.entry_date, je.created_at,
       je.reference_type, je.reference_id, je.payment_id, je.description,
       rp.id AS rental_payment_id, rp.payment_date, rp.reference AS rp_ref,
       r.booking_no
FROM journal_entries je
LEFT JOIN rental_payments rp ON rp.journal_entry_id = je.id
LEFT JOIN rentals r ON r.id = rp.rental_id OR r.id = je.reference_id
WHERE je.entry_no ILIKE 'JE-0171'
ORDER BY je.created_at;
