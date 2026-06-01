/** Tables that must never be deleted by rollback tooling. */
export const PROTECTED_TABLES = new Set([
  'companies',
  'branches',
  'users',
  'user_branches',
  'roles',
  'permissions',
  'role_permissions',
  'settings',
  'modules_config',
  'schema_migrations',
]);

/** Keep small — PostgREST URI length limits on large `.in()` lists. */
const CHUNK_SIZE = 80;

export function assertDeletableTable(table) {
  if (PROTECTED_TABLES.has(table)) {
    throw new Error(`Refusing to delete from protected table: ${table}`);
  }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} table
 * @param {string} column
 * @param {string} value
 */
export async function countEq(supabase, table, column, value) {
  assertDeletableTable(table);
  const { count, error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq(column, value);
  if (error) {
    throw new Error(`[${table}] count failed: ${error.message || error.code || JSON.stringify(error)}`);
  }
  if (count == null) {
    throw new Error(`[${table}] count returned null`);
  }
  return count;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} table
 * @param {string} fkColumn
 * @param {string[]} parentIds
 */
export async function countIn(supabase, table, fkColumn, parentIds) {
  assertDeletableTable(table);
  if (!parentIds.length) return 0;
  let total = 0;
  for (let i = 0; i < parentIds.length; i += CHUNK_SIZE) {
    const chunk = parentIds.slice(i, i + CHUNK_SIZE);
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })
      .in(fkColumn, chunk);
    if (error) {
      throw new Error(
        `[${table}] count failed: ${error.message || error.code || JSON.stringify(error)}`
      );
    }
    if (count == null) {
      throw new Error(`[${table}] count returned null (try smaller chunk size)`);
    }
    total += count;
  }
  return total;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} table
 * @param {string} column
 * @param {string} companyId
 */
export async function selectIdsByCompany(supabase, table, column, companyId) {
  assertDeletableTable(table);
  const ids = [];
  const pageSize = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select('id')
      .eq(column, companyId)
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`[${table}] select ids failed: ${error.message}`);
    if (!data?.length) break;
    for (const row of data) ids.push(row.id);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return ids;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} table
 * @param {string} column
 * @param {string} value
 * @param {{ dryRun?: boolean }} [opts]
 */
export async function deleteEq(supabase, table, column, value, opts = {}) {
  assertDeletableTable(table);
  const n = await countEq(supabase, table, column, value);
  if (opts.dryRun) {
    console.log(`[${table}] dry-run: would delete ${n} row(s)`);
    return { table, deleted: 0, wouldDelete: n };
  }
  if (n === 0) {
    console.log(`[${table}] deleted 0 row(s)`);
    return { table, deleted: 0 };
  }
  const { error, count } = await supabase
    .from(table)
    .delete({ count: 'exact' })
    .eq(column, value);
  if (error) throw new Error(`[${table}] delete failed: ${error.message}`);
  const deleted = count ?? n;
  console.log(`[${table}] deleted ${deleted} row(s)`);
  return { table, deleted };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} table
 * @param {string} fkColumn
 * @param {string[]} parentIds
 * @param {{ dryRun?: boolean }} [opts]
 */
export async function deleteInChunks(supabase, table, fkColumn, parentIds, opts = {}) {
  assertDeletableTable(table);
  if (!parentIds.length) {
    console.log(`[${table}] deleted 0 row(s)`);
    return { table, deleted: 0 };
  }

  const wouldDelete = await countIn(supabase, table, fkColumn, parentIds);
  if (opts.dryRun) {
    console.log(`[${table}] dry-run: would delete ${wouldDelete} row(s)`);
    return { table, deleted: 0, wouldDelete };
  }

  let deleted = 0;
  for (let i = 0; i < parentIds.length; i += CHUNK_SIZE) {
    const chunk = parentIds.slice(i, i + CHUNK_SIZE);
    const { error, count } = await supabase
      .from(table)
      .delete({ count: 'exact' })
      .in(fkColumn, chunk);
    if (error) throw new Error(`[${table}] delete failed: ${error.message}`);
    deleted += count ?? 0;
  }
  console.log(`[${table}] deleted ${deleted} row(s)`);
  return { table, deleted };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} companyId
 * @param {{ dryRun?: boolean }} [opts]
 */
export async function clearBranchSettingsAccountRefs(supabase, companyId, opts = {}) {
  const payload = {
    default_cash_account_id: null,
    default_bank_account_id: null,
    default_pos_drawer_account_id: null,
  };

  if (opts.dryRun) {
    console.log(
      '[branches] dry-run: would clear default_cash/bank/pos_drawer account FKs for company (protected table — update only)'
    );
    console.log(
      '[settings] dry-run: would clear default_cash/bank account FKs for company (protected table — update only)'
    );
    return;
  }

  const { error: branchErr } = await supabase.from('branches').update(payload).eq('company_id', companyId);
  if (branchErr) throw new Error(`[branches] clear account FKs failed: ${branchErr.message}`);
  console.log('[branches] cleared default account FKs for company');

  const { error: settingsErr } = await supabase
    .from('settings')
    .update({ default_cash_account_id: null, default_bank_account_id: null })
    .eq('company_id', companyId);
  if (settingsErr) throw new Error(`[settings] clear account FKs failed: ${settingsErr.message}`);
  console.log('[settings] cleared default account FKs for company');
}

/**
 * Delete contacts for company except system walk-in customer.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} companyId
 * @param {{ dryRun?: boolean }} [opts]
 */
export async function deleteImportedContacts(supabase, companyId, opts = {}) {
  const table = 'contacts';
  assertDeletableTable(table);

  const { count, error: countErr } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .or('system_type.is.null,system_type.neq.walking_customer');
  if (countErr) throw new Error(`[${table}] count failed: ${countErr.message}`);
  const n = count ?? 0;

  if (opts.dryRun) {
    console.log(`[${table}] dry-run: would delete ${n} row(s) (preserving walking_customer)`);
    return { table, deleted: 0, wouldDelete: n };
  }
  if (n === 0) {
    console.log(`[${table}] deleted 0 row(s) (walk-in preserved)`);
    return { table, deleted: 0 };
  }

  const { error, count: deletedCount } = await supabase
    .from(table)
    .delete({ count: 'exact' })
    .eq('company_id', companyId)
    .or('system_type.is.null,system_type.neq.walking_customer');
  if (error) throw new Error(`[${table}] delete failed: ${error.message}`);
  const deleted = deletedCount ?? n;
  console.log(`[${table}] deleted ${deleted} row(s) (walk-in preserved)`);
  return { table, deleted };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} companyId
 * @param {string[]} productIds
 * @param {{ dryRun?: boolean }} [opts]
 */
export async function deleteProductSatellites(supabase, companyId, productIds, opts = {}) {
  const results = [];
  for (const table of ['inventory_balance', 'product_branches']) {
    const n = productIds.length ? await countIn(supabase, table, 'product_id', productIds) : 0;
    if (n === 0) {
      const label = opts.dryRun ? 'dry-run: would delete' : 'deleted';
      console.log(`[${table}] ${label} 0 row(s)`);
      results.push({ table, deleted: 0, ...(opts.dryRun ? { wouldDelete: 0 } : {}) });
      continue;
    }
    if (opts.dryRun) {
      console.log(`[${table}] dry-run: would delete ${n} row(s)`);
      results.push({ table, deleted: 0, wouldDelete: n });
      continue;
    }
    const r = await deleteInChunks(supabase, table, 'product_id', productIds, opts);
    results.push(r);
  }
  return results;
}
