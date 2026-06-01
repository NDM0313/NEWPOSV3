-- Verify edit/cancel RPCs exist
SELECT proname FROM pg_proc
WHERE proname IN (
  'cancel_bespoke_work_order_stock',
  'reopen_bespoke_work_order',
  'update_bespoke_work_order'
)
ORDER BY proname;
