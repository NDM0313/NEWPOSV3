-- Forward migration: restore_company_backup_rpc (rental PK cleanup, auth.jwt role, Studio/Production tables).
-- Full definition also shipped as 20260514120000_company_backup_studio_tables_export_restore.sql for one-shot Supabase apply.

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