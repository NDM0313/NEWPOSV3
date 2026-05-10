-- Fix identity mismatch for company resolution and add secure backup export RPC.
-- This enables transactional backup export even when RLS policies rely on get_user_company_id().

create or replace function public.get_user_company_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select u.company_id
  from public.users u
  where u.auth_user_id = auth.uid() or u.id = auth.uid()
  order by case when u.auth_user_id = auth.uid() then 0 else 1 end
  limit 1
$$;

create or replace function public.export_company_backup_rpc(
  p_company_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_request_role text := lower(trim(coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(auth.jwt()->>'role', ''),
    ''
  )));
  v_user_role text := '';

  v_branches jsonb := '[]'::jsonb;
  v_accounts jsonb := '[]'::jsonb;
  v_contacts jsonb := '[]'::jsonb;
  v_products jsonb := '[]'::jsonb;
  v_product_variations jsonb := '[]'::jsonb;
  v_sales jsonb := '[]'::jsonb;
  v_sales_items jsonb := '[]'::jsonb;
  v_purchases jsonb := '[]'::jsonb;
  v_purchase_items jsonb := '[]'::jsonb;
  v_rentals jsonb := '[]'::jsonb;
  v_rental_items jsonb := '[]'::jsonb;
  v_rental_payments jsonb := '[]'::jsonb;
  v_expenses jsonb := '[]'::jsonb;
  v_payments jsonb := '[]'::jsonb;
  v_journal_entries jsonb := '[]'::jsonb;
  v_journal_entry_lines jsonb := '[]'::jsonb;
  v_ledger_entries jsonb := '[]'::jsonb;

  v_workers jsonb := '[]'::jsonb;
  v_studio_sales jsonb := '[]'::jsonb;
  v_studio_orders jsonb := '[]'::jsonb;
  v_studio_order_items jsonb := '[]'::jsonb;
  v_job_cards jsonb := '[]'::jsonb;
  v_studio_tasks jsonb := '[]'::jsonb;
  v_worker_payments jsonb := '[]'::jsonb;
  v_worker_ledger_entries jsonb := '[]'::jsonb;
  v_studio_production_logs jsonb := '[]'::jsonb;
  v_studio_productions jsonb := '[]'::jsonb;
  v_studio_production_stages jsonb := '[]'::jsonb;
  v_studio_po_v2 jsonb := '[]'::jsonb;
  v_studio_ps_v2 jsonb := '[]'::jsonb;
  v_studio_sa_v2 jsonb := '[]'::jsonb;
  v_studio_sr_v2 jsonb := '[]'::jsonb;
  v_studio_po_v3 jsonb := '[]'::jsonb;
  v_studio_ps_v3 jsonb := '[]'::jsonb;
  v_studio_cb_v3 jsonb := '[]'::jsonb;

  v_company_name text := null;
  v_company_has_business_name boolean := false;
begin
  if p_company_id is null then
    return jsonb_build_object('success', false, 'error', 'company_id is required');
  end if;

  -- Allow service_role for server/drill jobs. Otherwise enforce owner/admin of same company.
  if v_request_role <> 'service_role' then
    if v_user_id is null then
      return jsonb_build_object('success', false, 'error', 'Not authenticated');
    end if;

    select lower(coalesce(u.role::text, ''))
    into v_user_role
    from public.users u
    where (u.id = v_user_id or u.auth_user_id = v_user_id)
      and u.company_id = p_company_id
    limit 1;

    if v_user_role not in ('owner', 'admin', 'super admin', 'superadmin', 'super_admin') then
      return jsonb_build_object('success', false, 'error', 'Only owner/admin can export company backup');
    end if;
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'companies'
      and column_name = 'business_name'
  ) into v_company_has_business_name;

  if v_company_has_business_name then
    execute $q$
      select coalesce(c.business_name, c.name), coalesce(jsonb_agg(to_jsonb(b) order by b.created_at), '[]'::jsonb)
      from public.companies c
      left join public.branches b on b.company_id = c.id
      where c.id = $1
      group by c.business_name, c.name
    $q$
    into v_company_name, v_branches
    using p_company_id;
  else
    execute $q$
      select c.name, coalesce(jsonb_agg(to_jsonb(b) order by b.created_at), '[]'::jsonb)
      from public.companies c
      left join public.branches b on b.company_id = c.id
      where c.id = $1
      group by c.name
    $q$
    into v_company_name, v_branches
    using p_company_id;
  end if;

  select coalesce(jsonb_agg(to_jsonb(a) order by a.code), '[]'::jsonb)
  into v_accounts
  from public.accounts a
  where a.company_id = p_company_id;

  select coalesce(jsonb_agg(to_jsonb(c) order by c.created_at), '[]'::jsonb)
  into v_contacts
  from public.contacts c
  where c.company_id = p_company_id;

  select coalesce(jsonb_agg(to_jsonb(p) order by p.created_at), '[]'::jsonb)
  into v_products
  from public.products p
  where p.company_id = p_company_id;

  select coalesce(jsonb_agg(to_jsonb(v) order by v.created_at), '[]'::jsonb)
  into v_product_variations
  from public.product_variations v
  join public.products p on p.id = v.product_id
  where p.company_id = p_company_id;

  select coalesce(jsonb_agg(to_jsonb(s) order by s.created_at), '[]'::jsonb)
  into v_sales
  from public.sales s
  where s.company_id = p_company_id;

  select coalesce(jsonb_agg(to_jsonb(si) order by si.created_at), '[]'::jsonb)
  into v_sales_items
  from public.sales_items si
  join public.sales s on s.id = si.sale_id
  where s.company_id = p_company_id;

  select coalesce(jsonb_agg(to_jsonb(pu) order by pu.created_at), '[]'::jsonb)
  into v_purchases
  from public.purchases pu
  where pu.company_id = p_company_id;

  select coalesce(jsonb_agg(to_jsonb(pi) order by pi.created_at), '[]'::jsonb)
  into v_purchase_items
  from public.purchase_items pi
  join public.purchases pu on pu.id = pi.purchase_id
  where pu.company_id = p_company_id;

  select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at), '[]'::jsonb)
  into v_rentals
  from public.rentals r
  where r.company_id = p_company_id;

  select coalesce(jsonb_agg(to_jsonb(ri) order by ri.created_at), '[]'::jsonb)
  into v_rental_items
  from public.rental_items ri
  join public.rentals r on r.id = ri.rental_id
  where r.company_id = p_company_id;

  select coalesce(jsonb_agg(to_jsonb(rp) order by rp.created_at), '[]'::jsonb)
  into v_rental_payments
  from public.rental_payments rp
  join public.rentals r on r.id = rp.rental_id
  where r.company_id = p_company_id;

  select coalesce(jsonb_agg(to_jsonb(e) order by e.created_at), '[]'::jsonb)
  into v_expenses
  from public.expenses e
  where e.company_id = p_company_id;

  select coalesce(jsonb_agg(to_jsonb(pay) order by pay.created_at), '[]'::jsonb)
  into v_payments
  from public.payments pay
  where pay.company_id = p_company_id;

  select coalesce(jsonb_agg(to_jsonb(je) order by je.created_at), '[]'::jsonb)
  into v_journal_entries
  from public.journal_entries je
  where je.company_id = p_company_id;

  select coalesce(jsonb_agg(to_jsonb(jel) order by jel.created_at), '[]'::jsonb)
  into v_journal_entry_lines
  from public.journal_entry_lines jel
  join public.journal_entries je on je.id = jel.journal_entry_id
  where je.company_id = p_company_id;

  select coalesce(jsonb_agg(to_jsonb(le) order by le.created_at), '[]'::jsonb)
  into v_ledger_entries
  from public.ledger_entries le
  where le.company_id = p_company_id;

  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'workers') then
    select coalesce(jsonb_agg(to_jsonb(w) order by w.created_at), '[]'::jsonb)
    into v_workers
    from public.workers w
    where w.company_id = p_company_id;
  end if;

  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'studio_sales') then
    select coalesce(jsonb_agg(to_jsonb(ss) order by ss.created_at), '[]'::jsonb)
    into v_studio_sales
    from public.studio_sales ss
    where ss.branch_id in (select id from public.branches where company_id = p_company_id)
       or ss.customer_id in (select id from public.contacts where company_id = p_company_id);
  end if;

  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'studio_orders') then
    select coalesce(jsonb_agg(to_jsonb(o) order by o.created_at), '[]'::jsonb)
    into v_studio_orders
    from public.studio_orders o
    where o.company_id = p_company_id
       or (o.sale_id is not null and o.sale_id in (select id from public.sales where company_id = p_company_id));
  end if;

  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'studio_orders')
     and exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'studio_order_items') then
    select coalesce(jsonb_agg(to_jsonb(i) order by i.created_at), '[]'::jsonb)
    into v_studio_order_items
    from public.studio_order_items i
    join public.studio_orders o on o.id = i.studio_order_id
    where o.company_id = p_company_id
       or (o.sale_id is not null and o.sale_id in (select id from public.sales where company_id = p_company_id));
  end if;

  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'studio_orders')
     and exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'job_cards') then
    select coalesce(jsonb_agg(to_jsonb(j) order by j.created_at), '[]'::jsonb)
    into v_job_cards
    from public.job_cards j
    join public.studio_orders o on o.id = j.studio_order_id
    where o.company_id = p_company_id
       or (o.sale_id is not null and o.sale_id in (select id from public.sales where company_id = p_company_id));
  end if;

  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'studio_orders')
     and exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'studio_tasks') then
    select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at), '[]'::jsonb)
    into v_studio_tasks
    from public.studio_tasks t
    join public.studio_orders o on o.id = t.studio_order_id
    where o.company_id = p_company_id
       or (o.sale_id is not null and o.sale_id in (select id from public.sales where company_id = p_company_id));
  end if;

  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'studio_orders')
     and exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'studio_tasks')
     and exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'worker_payments') then
    select coalesce(jsonb_agg(to_jsonb(wp) order by wp.created_at), '[]'::jsonb)
    into v_worker_payments
    from public.worker_payments wp
    join public.studio_tasks t on t.id = wp.studio_task_id
    join public.studio_orders o on o.id = t.studio_order_id
    where o.company_id = p_company_id
       or (o.sale_id is not null and o.sale_id in (select id from public.sales where company_id = p_company_id));
  end if;

  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'worker_ledger_entries') then
    select coalesce(jsonb_agg(to_jsonb(wl) order by wl.created_at), '[]'::jsonb)
    into v_worker_ledger_entries
    from public.worker_ledger_entries wl
    where wl.company_id = p_company_id;
  end if;

  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'studio_production_logs') then
    select coalesce(jsonb_agg(to_jsonb(sl) order by sl.performed_at), '[]'::jsonb)
    into v_studio_production_logs
    from public.studio_production_logs sl
    join public.studio_productions p on p.id = sl.production_id
    where p.company_id = p_company_id;
  end if;

  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'studio_productions') then
    select coalesce(jsonb_agg(to_jsonb(p) order by p.created_at), '[]'::jsonb)
    into v_studio_productions
    from public.studio_productions p
    where p.company_id = p_company_id;
  end if;

  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'studio_production_stages') then
    select coalesce(jsonb_agg(to_jsonb(s) order by s.created_at), '[]'::jsonb)
    into v_studio_production_stages
    from public.studio_production_stages s
    join public.studio_productions p on p.id = s.production_id
    where p.company_id = p_company_id;
  end if;

  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'studio_production_orders_v2') then
    select coalesce(jsonb_agg(to_jsonb(o) order by o.created_at), '[]'::jsonb)
    into v_studio_po_v2
    from public.studio_production_orders_v2 o
    where o.company_id = p_company_id;
  end if;

  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'studio_production_stages_v2') then
    select coalesce(jsonb_agg(to_jsonb(s) order by s.created_at), '[]'::jsonb)
    into v_studio_ps_v2
    from public.studio_production_stages_v2 s
    join public.studio_production_orders_v2 o on o.id = s.order_id
    where o.company_id = p_company_id;
  end if;

  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'studio_stage_assignments_v2') then
    select coalesce(jsonb_agg(to_jsonb(a) order by a.created_at), '[]'::jsonb)
    into v_studio_sa_v2
    from public.studio_stage_assignments_v2 a
    join public.studio_production_stages_v2 s on s.id = a.stage_id
    join public.studio_production_orders_v2 o on o.id = s.order_id
    where o.company_id = p_company_id;
  end if;

  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'studio_stage_receipts_v2') then
    select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at), '[]'::jsonb)
    into v_studio_sr_v2
    from public.studio_stage_receipts_v2 r
    join public.studio_production_stages_v2 s on s.id = r.stage_id
    join public.studio_production_orders_v2 o on o.id = s.order_id
    where o.company_id = p_company_id;
  end if;

  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'studio_production_orders_v3') then
    select coalesce(jsonb_agg(to_jsonb(o) order by o.created_at), '[]'::jsonb)
    into v_studio_po_v3
    from public.studio_production_orders_v3 o
    where o.company_id = p_company_id;
  end if;

  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'studio_production_stages_v3') then
    select coalesce(jsonb_agg(to_jsonb(s) order by s.created_at), '[]'::jsonb)
    into v_studio_ps_v3
    from public.studio_production_stages_v3 s
    join public.studio_production_orders_v3 o on o.id = s.order_id
    where o.company_id = p_company_id;
  end if;

  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'studio_production_cost_breakdown_v3') then
    select coalesce(jsonb_agg(to_jsonb(c) order by c.id), '[]'::jsonb)
    into v_studio_cb_v3
    from public.studio_production_cost_breakdown_v3 c
    join public.studio_production_orders_v3 o on o.id = c.production_id
    where o.company_id = p_company_id;
  end if;

  return jsonb_build_object(
    'success', true,
    'backup', jsonb_build_object(
      'meta', jsonb_build_object(
        'schema_version', 1,
        'exported_at', now(),
        'company_id', p_company_id,
        'company_name', v_company_name
      ),
      'data', jsonb_build_object(
        'branches', v_branches,
        'accounts', v_accounts,
        'contacts', v_contacts,
        'products', v_products,
        'product_variations', v_product_variations,
        'sales', v_sales,
        'sales_items', v_sales_items,
        'purchases', v_purchases,
        'purchase_items', v_purchase_items,
        'rentals', v_rentals,
        'rental_items', v_rental_items,
        'rental_payments', v_rental_payments,
        'expenses', v_expenses,
        'payments', v_payments,
        'journal_entries', v_journal_entries,
        'journal_entry_lines', v_journal_entry_lines,
        'ledger_entries', v_ledger_entries,
        'workers', v_workers,
        'studio_sales', v_studio_sales,
        'studio_orders', v_studio_orders,
        'studio_order_items', v_studio_order_items,
        'job_cards', v_job_cards,
        'studio_tasks', v_studio_tasks,
        'worker_payments', v_worker_payments,
        'worker_ledger_entries', v_worker_ledger_entries,
        'studio_production_logs', v_studio_production_logs,
        'studio_productions', v_studio_productions,
        'studio_production_stages', v_studio_production_stages,
        'studio_production_orders_v2', v_studio_po_v2,
        'studio_production_stages_v2', v_studio_ps_v2,
        'studio_stage_assignments_v2', v_studio_sa_v2,
        'studio_stage_receipts_v2', v_studio_sr_v2,
        'studio_production_orders_v3', v_studio_po_v3,
        'studio_production_stages_v3', v_studio_ps_v3,
        'studio_production_cost_breakdown_v3', v_studio_cb_v3
      )
    ),
    'counts', jsonb_build_object(
      'sales', jsonb_array_length(v_sales),
      'purchases', jsonb_array_length(v_purchases),
      'rentals', jsonb_array_length(v_rentals),
      'expenses', jsonb_array_length(v_expenses),
      'journal_entries', jsonb_array_length(v_journal_entries),
      'ledger_entries', jsonb_array_length(v_ledger_entries),
      'workers', jsonb_array_length(v_workers),
      'studio_sales', jsonb_array_length(v_studio_sales),
      'studio_productions', jsonb_array_length(v_studio_productions),
      'studio_production_orders_v3', jsonb_array_length(v_studio_po_v3)
    )
  );
exception when others then
  return jsonb_build_object('success', false, 'error', sqlerrm);
end;
$$;

grant execute on function public.export_company_backup_rpc(uuid) to authenticated;
grant execute on function public.export_company_backup_rpc(uuid) to service_role;
