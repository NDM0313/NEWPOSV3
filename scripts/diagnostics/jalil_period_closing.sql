-- Period closing at various end dates (RPC party GL)
SELECT end_d,
  (SELECT round((r->>'running_balance')::numeric, 2)
   FROM json_array_elements(
     (get_customer_ar_gl_ledger_for_contact(
       '30bd8592-3384-4f34-899a-f3907e336485'::uuid,
       'fe7ec33d-fd6d-4aa6-8d21-416e383b4c93'::uuid,
       NULL::uuid,
       '2000-01-01'::date,
       end_d
     )->'rows')
   ) AS r
   ORDER BY (r->>'entry_date') DESC, (r->>'entry_no') DESC
   LIMIT 1) AS closing_balance
FROM (VALUES
  ('2025-12-19'::date),
  ('2025-12-31'::date),
  ('2026-01-14'::date),
  ('2026-02-16'::date),
  ('2026-04-27'::date),
  ('2099-12-31'::date)
) AS t(end_d);
