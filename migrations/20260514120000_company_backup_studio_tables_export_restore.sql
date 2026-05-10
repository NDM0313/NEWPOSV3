-- Forward migration: Studio / Production backup-export + restore (full RPC definitions).
-- Applies extended export_company_backup_rpc (studio_sales, studio_orders, tasks, worker_payments, V1/V2/V3 production, workers, logs)
-- and restore_company_backup_rpc with FK-safe delete/insert order + PK cleanup for stable UUIDs and production_no.
-- Safe to run in Supabase SQL Editor after prior backup RPC migrations.

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

create or replace function public.restore_company_backup_rpc(
  p_company_id uuid,
  p_backup jsonb,
  p_confirmation text default null
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
  v_prev_replication_role text := null;

  v_meta_company_id uuid;
  v_data jsonb := coalesce(p_backup -> 'data', '{}'::jsonb);

  v_current_sales_ids uuid[];
  v_current_purchase_ids uuid[];
  v_current_rental_ids uuid[];
  v_current_product_ids uuid[];
  v_current_journal_ids uuid[];
  v_current_sale_return_ids uuid[];
  v_current_purchase_return_ids uuid[];
  v_rows bigint := 0;

  v_restored jsonb := '{}'::jsonb;
begin
  if p_company_id is null then
    return jsonb_build_object('success', false, 'error', 'company_id is required');
  end if;

  if coalesce(nullif(trim(p_confirmation), ''), '') <> 'RESTORE' then
    return jsonb_build_object('success', false, 'error', 'Confirmation phrase must be RESTORE');
  end if;

  begin
    v_meta_company_id := nullif(p_backup #>> '{meta,company_id}', '')::uuid;
  exception when others then
    return jsonb_build_object('success', false, 'error', 'Invalid backup meta.company_id');
  end;

  if v_meta_company_id is distinct from p_company_id then
    return jsonb_build_object('success', false, 'error', 'Backup company_id does not match active company');
  end if;

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
      return jsonb_build_object('success', false, 'error', 'Only owner/admin can restore company backup');
    end if;
  end if;

  v_prev_replication_role := current_setting('session_replication_role', true);
  perform set_config('session_replication_role', 'replica', true);

  select coalesce(array_agg(id), '{}'::uuid[]) into v_current_sales_ids from public.sales where company_id = p_company_id;
  select coalesce(array_agg(id), '{}'::uuid[]) into v_current_purchase_ids from public.purchases where company_id = p_company_id;
  select coalesce(array_agg(id), '{}'::uuid[]) into v_current_rental_ids from public.rentals where company_id = p_company_id;
  select coalesce(array_agg(id), '{}'::uuid[]) into v_current_product_ids from public.products where company_id = p_company_id;
  select coalesce(array_agg(id), '{}'::uuid[]) into v_current_journal_ids from public.journal_entries where company_id = p_company_id;
  select coalesce(array_agg(id), '{}'::uuid[]) into v_current_sale_return_ids from public.sale_returns where company_id = p_company_id;
  select coalesce(array_agg(id), '{}'::uuid[]) into v_current_purchase_return_ids from public.purchase_returns where company_id = p_company_id;

  -- Child rows first.
  delete from public.journal_entry_lines where journal_entry_id = any(v_current_journal_ids);
  delete from public.rental_payments where rental_id = any(v_current_rental_ids);
  delete from public.rental_items where rental_id = any(v_current_rental_ids);
  delete from public.purchase_return_items where purchase_return_id = any(v_current_purchase_return_ids);
  delete from public.sale_return_items where sale_return_id = any(v_current_sale_return_ids);
  delete from public.purchase_items where purchase_id = any(v_current_purchase_ids);
  delete from public.sales_items where sale_id = any(v_current_sales_ids);
  delete from public.product_variations where product_id = any(v_current_product_ids);
  delete from public.stock_movements where company_id = p_company_id;

  -- Studio sales / orders / tasks / worker payments (before sales delete — FK to sales)
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'worker_payments')
     and exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'studio_tasks')
     and exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'studio_orders') then
    delete from public.worker_payments wp
    where wp.studio_task_id in (
      select t.id from public.studio_tasks t
      inner join public.studio_orders o on o.id = t.studio_order_id
      where o.company_id = p_company_id
         or (o.sale_id is not null and o.sale_id = any(v_current_sales_ids))
    );
  end if;

  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'studio_tasks')
     and exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'studio_orders') then
    delete from public.studio_tasks t using public.studio_orders o
    where t.studio_order_id = o.id
      and (o.company_id = p_company_id or (o.sale_id is not null and o.sale_id = any(v_current_sales_ids)));
  end if;

  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'studio_order_items')
     and exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'studio_orders') then
    delete from public.studio_order_items i using public.studio_orders o
    where i.studio_order_id = o.id
      and (o.company_id = p_company_id or (o.sale_id is not null and o.sale_id = any(v_current_sales_ids)));
  end if;

  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'job_cards')
     and exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'studio_orders') then
    delete from public.job_cards j using public.studio_orders o
    where j.studio_order_id = o.id
      and (o.company_id = p_company_id or (o.sale_id is not null and o.sale_id = any(v_current_sales_ids)));
  end if;

  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'studio_orders') then
    delete from public.studio_orders o
    where o.company_id = p_company_id
       or (o.sale_id is not null and o.sale_id = any(v_current_sales_ids));
  end if;

  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'studio_sales') then
    delete from public.studio_sales ss
    where ss.branch_id in (select id from public.branches where company_id = p_company_id)
       or ss.customer_id in (select id from public.contacts where company_id = p_company_id);
  end if;

  -- Studio production V3 / V2 (FK to sales)
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'studio_production_cost_breakdown_v3') then
    delete from public.studio_production_cost_breakdown_v3 c
    where c.production_id in (
      select id from public.studio_production_orders_v3 where company_id = p_company_id
    );
  end if;

  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'studio_production_stages_v3') then
    delete from public.studio_production_stages_v3 s
    where s.order_id in (
      select id from public.studio_production_orders_v3 where company_id = p_company_id
    );
  end if;

  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'studio_production_orders_v3') then
    delete from public.studio_production_orders_v3 where company_id = p_company_id;
  end if;

  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'studio_stage_receipts_v2') then
    delete from public.studio_stage_receipts_v2 r
    where r.stage_id in (
      select st.id from public.studio_production_stages_v2 st
      inner join public.studio_production_orders_v2 o on o.id = st.order_id
      where o.company_id = p_company_id
    );
  end if;

  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'studio_stage_assignments_v2') then
    delete from public.studio_stage_assignments_v2 a
    where a.stage_id in (
      select st.id from public.studio_production_stages_v2 st
      inner join public.studio_production_orders_v2 o on o.id = st.order_id
      where o.company_id = p_company_id
    );
  end if;

  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'studio_production_stages_v2') then
    delete from public.studio_production_stages_v2 st
    where st.order_id in (
      select id from public.studio_production_orders_v2 where company_id = p_company_id
    );
  end if;

  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'studio_production_orders_v2') then
    delete from public.studio_production_orders_v2 where company_id = p_company_id;
  end if;

  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'worker_ledger_entries') then
    delete from public.worker_ledger_entries where company_id = p_company_id;
  end if;

  -- Legacy studio productions (V1): logs → stages → productions
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'studio_production_logs') then
    delete from public.studio_production_logs sl
    where sl.production_id in (
      select id from public.studio_productions where company_id = p_company_id
    );
  end if;

  if exists (
    select 1 from information_schema.tables where table_schema = 'public' and table_name = 'studio_production_stages'
  ) then
    delete from public.studio_production_stages
    where production_id in (
      select id from public.studio_productions where company_id = p_company_id
    );
  end if;

  if exists (
    select 1 from information_schema.tables where table_schema = 'public' and table_name = 'studio_productions'
  ) then
    delete from public.studio_productions where company_id = p_company_id;
  end if;

  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'workers') then
    delete from public.workers where company_id = p_company_id;
  end if;

  -- Parent rows.
  delete from public.ledger_entries where company_id = p_company_id;
  delete from public.journal_entries where company_id = p_company_id;
  delete from public.payments where company_id = p_company_id;
  delete from public.expenses where company_id = p_company_id;
  delete from public.purchase_returns where company_id = p_company_id;
  delete from public.sale_returns where company_id = p_company_id;
  delete from public.rentals where company_id = p_company_id;
  delete from public.purchases where company_id = p_company_id;
  delete from public.sales where company_id = p_company_id;
  delete from public.products where company_id = p_company_id;
  delete from public.contacts
  where company_id = p_company_id
    and not (is_system_generated = true and lower(coalesce(system_type, '')) = 'walking_customer');
  delete from public.branches where company_id = p_company_id;

  -- Insert parent -> child from backup payload.
  insert into public.branches
  select * from jsonb_populate_recordset(null::public.branches, coalesce(v_data -> 'branches', '[]'::jsonb));
  get diagnostics v_rows = row_count;
  v_restored := v_restored || jsonb_build_object('branches', v_rows);

  insert into public.contacts
  select *
  from jsonb_populate_recordset(null::public.contacts, coalesce(v_data -> 'contacts', '[]'::jsonb))
  where not (is_system_generated = true and lower(coalesce(system_type, '')) = 'walking_customer');
  get diagnostics v_rows = row_count;
  v_restored := v_restored || jsonb_build_object('contacts', v_rows);

  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'workers') then
    insert into public.workers
    select * from jsonb_populate_recordset(null::public.workers, coalesce(v_data -> 'workers', '[]'::jsonb));
    get diagnostics v_rows = row_count;
    v_restored := v_restored || jsonb_build_object('workers', v_rows);
  end if;

  insert into public.accounts
  select * from jsonb_populate_recordset(null::public.accounts, coalesce(v_data -> 'accounts', '[]'::jsonb))
  on conflict (company_id, code) do update
    set
      name = excluded.name,
      type = excluded.type,
      subtype = excluded.subtype,
      parent_id = excluded.parent_id,
      is_active = excluded.is_active,
      updated_at = excluded.updated_at;
  get diagnostics v_rows = row_count;
  v_restored := v_restored || jsonb_build_object('accounts', v_rows);

  insert into public.products
  select * from jsonb_populate_recordset(null::public.products, coalesce(v_data -> 'products', '[]'::jsonb));
  get diagnostics v_rows = row_count;
  v_restored := v_restored || jsonb_build_object('products', v_rows);

  insert into public.product_variations
  select * from jsonb_populate_recordset(null::public.product_variations, coalesce(v_data -> 'product_variations', '[]'::jsonb));
  get diagnostics v_rows = row_count;
  v_restored := v_restored || jsonb_build_object('product_variations', v_rows);

  insert into public.sales
  select * from jsonb_populate_recordset(null::public.sales, coalesce(v_data -> 'sales', '[]'::jsonb));
  get diagnostics v_rows = row_count;
  v_restored := v_restored || jsonb_build_object('sales', v_rows);

  -- Studio standalone invoices (branch/customer FKs only)
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'studio_sales') then
    delete from public.studio_sales ss
    where ss.id in (
      select distinct (elem->>'id')::uuid
      from jsonb_array_elements(coalesce(v_data -> 'studio_sales', '[]'::jsonb)) elem
      where nullif(trim(elem->>'id'), '') is not null
    );
    delete from public.studio_sales ss
    where ss.branch_id in (select id from public.branches where company_id = p_company_id)
       or ss.customer_id in (select id from public.contacts where company_id = p_company_id);
    insert into public.studio_sales
    select * from jsonb_populate_recordset(null::public.studio_sales, coalesce(v_data -> 'studio_sales', '[]'::jsonb));
    get diagnostics v_rows = row_count;
    v_restored := v_restored || jsonb_build_object('studio_sales', v_rows);
  end if;

  -- Studio orders linked to sales (integration + legacy company-scoped rows)
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'studio_orders') then
    delete from public.studio_orders o
    where o.id in (
      select distinct (elem->>'id')::uuid
      from jsonb_array_elements(coalesce(v_data -> 'studio_orders', '[]'::jsonb)) elem
      where nullif(trim(elem->>'id'), '') is not null
    );
    delete from public.studio_orders o
    where o.company_id = p_company_id
       or o.sale_id in (select id from public.sales where company_id = p_company_id);
    insert into public.studio_orders
    select * from jsonb_populate_recordset(null::public.studio_orders, coalesce(v_data -> 'studio_orders', '[]'::jsonb));
    get diagnostics v_rows = row_count;
    v_restored := v_restored || jsonb_build_object('studio_orders', v_rows);
  end if;

  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'studio_orders')
     and exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'studio_order_items') then
    delete from public.studio_order_items i
    where i.id in (
      select distinct (elem->>'id')::uuid
      from jsonb_array_elements(coalesce(v_data -> 'studio_order_items', '[]'::jsonb)) elem
      where nullif(trim(elem->>'id'), '') is not null
    );
    delete from public.studio_order_items i
    where i.studio_order_id in (
      select id from public.studio_orders
      where company_id = p_company_id
         or sale_id in (select id from public.sales where company_id = p_company_id)
    );
    insert into public.studio_order_items
    select * from jsonb_populate_recordset(null::public.studio_order_items, coalesce(v_data -> 'studio_order_items', '[]'::jsonb));
    get diagnostics v_rows = row_count;
    v_restored := v_restored || jsonb_build_object('studio_order_items', v_rows);
  end if;

  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'studio_orders')
     and exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'job_cards') then
    delete from public.job_cards j
    where j.id in (
      select distinct (elem->>'id')::uuid
      from jsonb_array_elements(coalesce(v_data -> 'job_cards', '[]'::jsonb)) elem
      where nullif(trim(elem->>'id'), '') is not null
    );
    delete from public.job_cards j
    where j.studio_order_id in (
      select id from public.studio_orders
      where company_id = p_company_id
         or sale_id in (select id from public.sales where company_id = p_company_id)
    );
    insert into public.job_cards
    select * from jsonb_populate_recordset(null::public.job_cards, coalesce(v_data -> 'job_cards', '[]'::jsonb));
    get diagnostics v_rows = row_count;
    v_restored := v_restored || jsonb_build_object('job_cards', v_rows);
  end if;

  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'studio_orders')
     and exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'studio_tasks') then
    delete from public.studio_tasks t
    where t.id in (
      select distinct (elem->>'id')::uuid
      from jsonb_array_elements(coalesce(v_data -> 'studio_tasks', '[]'::jsonb)) elem
      where nullif(trim(elem->>'id'), '') is not null
    );
    delete from public.studio_tasks t
    where t.studio_order_id in (
      select id from public.studio_orders
      where company_id = p_company_id
         or sale_id in (select id from public.sales where company_id = p_company_id)
    );
    insert into public.studio_tasks
    select * from jsonb_populate_recordset(null::public.studio_tasks, coalesce(v_data -> 'studio_tasks', '[]'::jsonb));
    get diagnostics v_rows = row_count;
    v_restored := v_restored || jsonb_build_object('studio_tasks', v_rows);
  end if;

  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'studio_orders')
     and exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'studio_tasks')
     and exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'worker_payments') then
    delete from public.worker_payments wp
    where wp.id in (
      select distinct (elem->>'id')::uuid
      from jsonb_array_elements(coalesce(v_data -> 'worker_payments', '[]'::jsonb)) elem
      where nullif(trim(elem->>'id'), '') is not null
    );
    delete from public.worker_payments wp
    where wp.studio_task_id in (
      select id from public.studio_tasks
      where studio_order_id in (
        select id from public.studio_orders
        where company_id = p_company_id
           or sale_id in (select id from public.sales where company_id = p_company_id)
      )
    );
    insert into public.worker_payments
    select * from jsonb_populate_recordset(null::public.worker_payments, coalesce(v_data -> 'worker_payments', '[]'::jsonb));
    get diagnostics v_rows = row_count;
    v_restored := v_restored || jsonb_build_object('worker_payments', v_rows);
  end if;

  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'worker_ledger_entries') then
    delete from public.worker_ledger_entries wl
    where wl.id in (
      select distinct (elem->>'id')::uuid
      from jsonb_array_elements(coalesce(v_data -> 'worker_ledger_entries', '[]'::jsonb)) elem
      where nullif(trim(elem->>'id'), '') is not null
    );
    delete from public.worker_ledger_entries where company_id = p_company_id;
    insert into public.worker_ledger_entries
    select * from jsonb_populate_recordset(null::public.worker_ledger_entries, coalesce(v_data -> 'worker_ledger_entries', '[]'::jsonb));
    get diagnostics v_rows = row_count;
    v_restored := v_restored || jsonb_build_object('worker_ledger_entries', v_rows);
  end if;

  insert into public.sale_returns
  select * from jsonb_populate_recordset(null::public.sale_returns, coalesce(v_data -> 'sale_returns', '[]'::jsonb));
  get diagnostics v_rows = row_count;
  v_restored := v_restored || jsonb_build_object('sale_returns', v_rows);

  insert into public.purchases
  select * from jsonb_populate_recordset(null::public.purchases, coalesce(v_data -> 'purchases', '[]'::jsonb));
  get diagnostics v_rows = row_count;
  v_restored := v_restored || jsonb_build_object('purchases', v_rows);

  insert into public.purchase_returns
  select * from jsonb_populate_recordset(null::public.purchase_returns, coalesce(v_data -> 'purchase_returns', '[]'::jsonb));
  get diagnostics v_rows = row_count;
  v_restored := v_restored || jsonb_build_object('purchase_returns', v_rows);

  insert into public.rentals
  select * from jsonb_populate_recordset(null::public.rentals, coalesce(v_data -> 'rentals', '[]'::jsonb));
  get diagnostics v_rows = row_count;
  v_restored := v_restored || jsonb_build_object('rentals', v_rows);

  insert into public.expenses
  select * from jsonb_populate_recordset(null::public.expenses, coalesce(v_data -> 'expenses', '[]'::jsonb));
  get diagnostics v_rows = row_count;
  v_restored := v_restored || jsonb_build_object('expenses', v_rows);

  insert into public.payments
  select * from jsonb_populate_recordset(null::public.payments, coalesce(v_data -> 'payments', '[]'::jsonb));
  get diagnostics v_rows = row_count;
  v_restored := v_restored || jsonb_build_object('payments', v_rows);

  insert into public.journal_entries
  select * from jsonb_populate_recordset(null::public.journal_entries, coalesce(v_data -> 'journal_entries', '[]'::jsonb));
  get diagnostics v_rows = row_count;
  v_restored := v_restored || jsonb_build_object('journal_entries', v_rows);

  insert into public.journal_entry_lines
  select * from jsonb_populate_recordset(null::public.journal_entry_lines, coalesce(v_data -> 'journal_entry_lines', '[]'::jsonb));
  get diagnostics v_rows = row_count;
  v_restored := v_restored || jsonb_build_object('journal_entry_lines', v_rows);

  insert into public.ledger_entries
  select * from jsonb_populate_recordset(null::public.ledger_entries, coalesce(v_data -> 'ledger_entries', '[]'::jsonb));
  get diagnostics v_rows = row_count;
  v_restored := v_restored || jsonb_build_object('ledger_entries', v_rows);

  -- Avoid sales_items_pkey conflicts: remove stale/orphan rows matching backup PKs, then all lines for tenant sales.
  delete from public.sales_items si
  where si.id in (
    select distinct (elem->>'id')::uuid
    from jsonb_array_elements(coalesce(v_data -> 'sales_items', '[]'::jsonb)) elem
    where nullif(trim(elem->>'id'), '') is not null
  );
  delete from public.sales_items si
  where si.sale_id in (select id from public.sales where company_id = p_company_id);

  insert into public.sales_items
  select * from jsonb_populate_recordset(null::public.sales_items, coalesce(v_data -> 'sales_items', '[]'::jsonb));
  get diagnostics v_rows = row_count;
  v_restored := v_restored || jsonb_build_object('sales_items', v_rows);

  insert into public.sale_return_items
  select * from jsonb_populate_recordset(null::public.sale_return_items, coalesce(v_data -> 'sale_return_items', '[]'::jsonb));
  get diagnostics v_rows = row_count;
  v_restored := v_restored || jsonb_build_object('sale_return_items', v_rows);

  insert into public.purchase_items
  select * from jsonb_populate_recordset(null::public.purchase_items, coalesce(v_data -> 'purchase_items', '[]'::jsonb));
  get diagnostics v_rows = row_count;
  v_restored := v_restored || jsonb_build_object('purchase_items', v_rows);

  insert into public.purchase_return_items
  select * from jsonb_populate_recordset(null::public.purchase_return_items, coalesce(v_data -> 'purchase_return_items', '[]'::jsonb));
  get diagnostics v_rows = row_count;
  v_restored := v_restored || jsonb_build_object('purchase_return_items', v_rows);

  -- Avoid rental_items_pkey conflicts: remove stale/orphan rows matching backup PKs, then all lines for tenant rentals.
  delete from public.rental_items ri
  where ri.id in (
    select distinct (elem->>'id')::uuid
    from jsonb_array_elements(coalesce(v_data -> 'rental_items', '[]'::jsonb)) elem
    where nullif(trim(elem->>'id'), '') is not null
  );
  delete from public.rental_items ri
  where ri.rental_id in (select id from public.rentals where company_id = p_company_id);

  insert into public.rental_items
  select * from jsonb_populate_recordset(null::public.rental_items, coalesce(v_data -> 'rental_items', '[]'::jsonb));
  get diagnostics v_rows = row_count;
  v_restored := v_restored || jsonb_build_object('rental_items', v_rows);

  -- Avoid rental_payments_pkey conflicts: remove stale/orphan rows matching backup PKs, then all payments for tenant rentals.
  delete from public.rental_payments rp
  where rp.id in (
    select distinct (elem->>'id')::uuid
    from jsonb_array_elements(coalesce(v_data -> 'rental_payments', '[]'::jsonb)) elem
    where nullif(trim(elem->>'id'), '') is not null
  );
  delete from public.rental_payments rp
  where rp.rental_id in (select id from public.rentals where company_id = p_company_id);

  insert into public.rental_payments
  select * from jsonb_populate_recordset(null::public.rental_payments, coalesce(v_data -> 'rental_payments', '[]'::jsonb));
  get diagnostics v_rows = row_count;
  v_restored := v_restored || jsonb_build_object('rental_payments', v_rows);

  -- Studio production V3 → V2 → V1 (FK order). PK cleanup avoids duplicate uuid / production_no conflicts after deletes.
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'studio_production_orders_v3') then
    delete from public.studio_production_orders_v3 o
    where o.id in (
      select distinct (elem->>'id')::uuid
      from jsonb_array_elements(coalesce(v_data -> 'studio_production_orders_v3', '[]'::jsonb)) elem
      where nullif(trim(elem->>'id'), '') is not null
    );
    delete from public.studio_production_orders_v3 where company_id = p_company_id;
    insert into public.studio_production_orders_v3
    select * from jsonb_populate_recordset(null::public.studio_production_orders_v3, coalesce(v_data -> 'studio_production_orders_v3', '[]'::jsonb));
    get diagnostics v_rows = row_count;
    v_restored := v_restored || jsonb_build_object('studio_production_orders_v3', v_rows);
  end if;

  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'studio_production_stages_v3') then
    delete from public.studio_production_stages_v3 s
    where s.id in (
      select distinct (elem->>'id')::uuid
      from jsonb_array_elements(coalesce(v_data -> 'studio_production_stages_v3', '[]'::jsonb)) elem
      where nullif(trim(elem->>'id'), '') is not null
    );
    delete from public.studio_production_stages_v3 s
    where s.order_id in (select id from public.studio_production_orders_v3 where company_id = p_company_id);
    insert into public.studio_production_stages_v3
    select * from jsonb_populate_recordset(null::public.studio_production_stages_v3, coalesce(v_data -> 'studio_production_stages_v3', '[]'::jsonb));
    get diagnostics v_rows = row_count;
    v_restored := v_restored || jsonb_build_object('studio_production_stages_v3', v_rows);
  end if;

  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'studio_production_cost_breakdown_v3') then
    delete from public.studio_production_cost_breakdown_v3 c
    where c.id in (
      select distinct (elem->>'id')::uuid
      from jsonb_array_elements(coalesce(v_data -> 'studio_production_cost_breakdown_v3', '[]'::jsonb)) elem
      where nullif(trim(elem->>'id'), '') is not null
    );
    delete from public.studio_production_cost_breakdown_v3 c
    where c.production_id in (select id from public.studio_production_orders_v3 where company_id = p_company_id);
    insert into public.studio_production_cost_breakdown_v3
    select * from jsonb_populate_recordset(null::public.studio_production_cost_breakdown_v3, coalesce(v_data -> 'studio_production_cost_breakdown_v3', '[]'::jsonb));
    get diagnostics v_rows = row_count;
    v_restored := v_restored || jsonb_build_object('studio_production_cost_breakdown_v3', v_rows);
  end if;

  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'studio_production_orders_v2') then
    delete from public.studio_production_orders_v2 o
    where o.id in (
      select distinct (elem->>'id')::uuid
      from jsonb_array_elements(coalesce(v_data -> 'studio_production_orders_v2', '[]'::jsonb)) elem
      where nullif(trim(elem->>'id'), '') is not null
    );
    delete from public.studio_production_orders_v2 where company_id = p_company_id;
    insert into public.studio_production_orders_v2
    select * from jsonb_populate_recordset(null::public.studio_production_orders_v2, coalesce(v_data -> 'studio_production_orders_v2', '[]'::jsonb));
    get diagnostics v_rows = row_count;
    v_restored := v_restored || jsonb_build_object('studio_production_orders_v2', v_rows);
  end if;

  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'studio_production_stages_v2') then
    delete from public.studio_production_stages_v2 s
    where s.id in (
      select distinct (elem->>'id')::uuid
      from jsonb_array_elements(coalesce(v_data -> 'studio_production_stages_v2', '[]'::jsonb)) elem
      where nullif(trim(elem->>'id'), '') is not null
    );
    delete from public.studio_production_stages_v2 s
    where s.order_id in (select id from public.studio_production_orders_v2 where company_id = p_company_id);
    insert into public.studio_production_stages_v2
    select * from jsonb_populate_recordset(null::public.studio_production_stages_v2, coalesce(v_data -> 'studio_production_stages_v2', '[]'::jsonb));
    get diagnostics v_rows = row_count;
    v_restored := v_restored || jsonb_build_object('studio_production_stages_v2', v_rows);
  end if;

  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'studio_stage_assignments_v2') then
    delete from public.studio_stage_assignments_v2 a
    where a.id in (
      select distinct (elem->>'id')::uuid
      from jsonb_array_elements(coalesce(v_data -> 'studio_stage_assignments_v2', '[]'::jsonb)) elem
      where nullif(trim(elem->>'id'), '') is not null
    );
    delete from public.studio_stage_assignments_v2 a
    where a.stage_id in (
      select st.id from public.studio_production_stages_v2 st
      inner join public.studio_production_orders_v2 o on o.id = st.order_id
      where o.company_id = p_company_id
    );
    insert into public.studio_stage_assignments_v2
    select * from jsonb_populate_recordset(null::public.studio_stage_assignments_v2, coalesce(v_data -> 'studio_stage_assignments_v2', '[]'::jsonb));
    get diagnostics v_rows = row_count;
    v_restored := v_restored || jsonb_build_object('studio_stage_assignments_v2', v_rows);
  end if;

  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'studio_stage_receipts_v2') then
    delete from public.studio_stage_receipts_v2 r
    where r.id in (
      select distinct (elem->>'id')::uuid
      from jsonb_array_elements(coalesce(v_data -> 'studio_stage_receipts_v2', '[]'::jsonb)) elem
      where nullif(trim(elem->>'id'), '') is not null
    );
    delete from public.studio_stage_receipts_v2 r
    where r.stage_id in (
      select st.id from public.studio_production_stages_v2 st
      inner join public.studio_production_orders_v2 o on o.id = st.order_id
      where o.company_id = p_company_id
    );
    insert into public.studio_stage_receipts_v2
    select * from jsonb_populate_recordset(null::public.studio_stage_receipts_v2, coalesce(v_data -> 'studio_stage_receipts_v2', '[]'::jsonb));
    get diagnostics v_rows = row_count;
    v_restored := v_restored || jsonb_build_object('studio_stage_receipts_v2', v_rows);
  end if;

  if exists (
    select 1 from information_schema.tables where table_schema = 'public' and table_name = 'studio_productions'
  ) then
    delete from public.studio_productions p
    where p.id in (
      select distinct (elem->>'id')::uuid
      from jsonb_array_elements(coalesce(v_data -> 'studio_productions', '[]'::jsonb)) elem
      where nullif(trim(elem->>'id'), '') is not null
    );
    delete from public.studio_productions where company_id = p_company_id;
    insert into public.studio_productions
    select * from jsonb_populate_recordset(null::public.studio_productions, coalesce(v_data -> 'studio_productions', '[]'::jsonb));
    get diagnostics v_rows = row_count;
    v_restored := v_restored || jsonb_build_object('studio_productions', v_rows);
  end if;

  if exists (
    select 1 from information_schema.tables where table_schema = 'public' and table_name = 'studio_production_stages'
  ) then
    delete from public.studio_production_stages s
    where s.id in (
      select distinct (elem->>'id')::uuid
      from jsonb_array_elements(coalesce(v_data -> 'studio_production_stages', '[]'::jsonb)) elem
      where nullif(trim(elem->>'id'), '') is not null
    );
    delete from public.studio_production_stages s
    where s.production_id in (select id from public.studio_productions where company_id = p_company_id);
    insert into public.studio_production_stages
    select * from jsonb_populate_recordset(null::public.studio_production_stages, coalesce(v_data -> 'studio_production_stages', '[]'::jsonb));
    get diagnostics v_rows = row_count;
    v_restored := v_restored || jsonb_build_object('studio_production_stages', v_rows);
  end if;

  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'studio_production_logs') then
    delete from public.studio_production_logs sl
    where sl.id in (
      select distinct (elem->>'id')::uuid
      from jsonb_array_elements(coalesce(v_data -> 'studio_production_logs', '[]'::jsonb)) elem
      where nullif(trim(elem->>'id'), '') is not null
    );
    delete from public.studio_production_logs sl
    where sl.production_id in (select id from public.studio_productions where company_id = p_company_id);
    insert into public.studio_production_logs
    select * from jsonb_populate_recordset(null::public.studio_production_logs, coalesce(v_data -> 'studio_production_logs', '[]'::jsonb));
    get diagnostics v_rows = row_count;
    v_restored := v_restored || jsonb_build_object('studio_production_logs', v_rows);
  end if;

  perform set_config('session_replication_role', coalesce(nullif(v_prev_replication_role, ''), 'origin'), true);

  return jsonb_build_object(
    'success', true,
    'restored', v_restored
  );
exception when others then
  begin
    perform set_config('session_replication_role', coalesce(nullif(v_prev_replication_role, ''), 'origin'), true);
  exception when others then
    null;
  end;
  return jsonb_build_object('success', false, 'error', sqlerrm);
end;
$$;

grant execute on function public.restore_company_backup_rpc(uuid, jsonb, text) to authenticated;
grant execute on function public.restore_company_backup_rpc(uuid, jsonb, text) to service_role;
