SELECT jsonb_pretty(
  preview_company_transaction_reset('595c08c2-1e47-4581-89c9-1f78de51c613'::uuid)
    -> 'transactional'
) AS transactional_preview;
