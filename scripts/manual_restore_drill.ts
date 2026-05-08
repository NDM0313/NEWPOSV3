import fs from 'node:fs/promises';
import path from 'node:path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

type Row = Record<string, unknown>;

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const companyId = process.argv[2] || '375fa03b-8e1e-46d3-9cfe-1cc20c02b473'; // test company with activity

function chunk<T>(arr: T[], size = 400): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function fetchByCompany(table: string): Promise<Row[]> {
  const { data, error } = await supabase.from(table).select('*').eq('company_id', companyId);
  if (error) throw new Error(`${table} fetch failed: ${error.message}`);
  return (data || []) as Row[];
}

async function fetchByIds(table: string, fkColumn: string, ids: string[]): Promise<Row[]> {
  if (!ids.length) return [];
  const out: Row[] = [];
  for (const part of chunk(ids, 500)) {
    const { data, error } = await supabase.from(table).select('*').in(fkColumn, part);
    if (error) throw new Error(`${table} fetch by ids failed: ${error.message}`);
    out.push(...((data || []) as Row[]));
  }
  return out;
}

async function deleteByCompany(table: string): Promise<void> {
  const { error } = await supabase.from(table).delete().eq('company_id', companyId);
  if (error) throw new Error(`${table} delete failed: ${error.message}`);
}

async function deleteByIds(table: string, fkColumn: string, ids: string[]): Promise<void> {
  if (!ids.length) return;
  for (const part of chunk(ids, 500)) {
    const { error } = await supabase.from(table).delete().in(fkColumn, part);
    if (error) throw new Error(`${table} delete by ids failed: ${error.message}`);
  }
}

function isProtectedSystemWalkInContact(row: Row): boolean {
  return row.is_system_generated === true && String(row.system_type || '').toLowerCase() === 'walking_customer';
}

async function insertMany(table: string, rows: Row[]): Promise<void> {
  if (!rows.length) return;
  for (const part of chunk(rows, 400)) {
    const { error } = await supabase.from(table).insert(part);
    if (error) throw new Error(`${table} insert failed: ${error.message}`);
  }
}

async function upsertMany(table: string, rows: Row[], onConflict: string): Promise<void> {
  if (!rows.length) return;
  for (const part of chunk(rows, 400)) {
    const { error } = await supabase.from(table).upsert(part, { onConflict, ignoreDuplicates: false });
    if (error) throw new Error(`${table} upsert failed: ${error.message}`);
  }
}

async function countByCompany(table: string): Promise<number> {
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true }).eq('company_id', companyId);
  if (error) throw new Error(`${table} count failed: ${error.message}`);
  return count || 0;
}

async function countByParent(table: string, fkColumn: string, ids: string[]): Promise<number> {
  if (!ids.length) return 0;
  let total = 0;
  for (const part of chunk(ids, 500)) {
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true }).in(fkColumn, part);
    if (error) throw new Error(`${table} count by parent failed: ${error.message}`);
    total += count || 0;
  }
  return total;
}

async function run(): Promise<void> {
  console.log(`Manual restore drill for company_id=${companyId}`);

  const companyRows = await fetchByIds('companies', 'id', [companyId]);
  if (!companyRows.length) throw new Error('Company not found');
  const companyName = String(companyRows[0].name || companyRows[0].id);

  // BEFORE snapshot IDs
  const beforeSales = await fetchByCompany('sales');
  const beforePurchases = await fetchByCompany('purchases');
  const beforeRentals = await fetchByCompany('rentals');
  const beforeProducts = await fetchByCompany('products');
  const beforeStudioProductions = await fetchByCompany('studio_productions').catch(() => []);
  const beforeAccounts = await fetchByCompany('accounts').catch(() => []);
  const beforePayments = await fetchByCompany('payments').catch(() => []);
  const beforeJournals = await fetchByCompany('journal_entries').catch(() => []);
  const beforeLedgerEntries = await fetchByCompany('ledger_entries').catch(() => []);
  const beforeSaleReturns = await fetchByCompany('sale_returns').catch(() => []);
  const beforePurchaseReturns = await fetchByCompany('purchase_returns').catch(() => []);

  const beforeSaleIds = beforeSales.map((x) => String(x.id)).filter(Boolean);
  const beforePurchaseIds = beforePurchases.map((x) => String(x.id)).filter(Boolean);
  const beforeRentalIds = beforeRentals.map((x) => String(x.id)).filter(Boolean);
  const beforeProductIds = beforeProducts.map((x) => String(x.id)).filter(Boolean);
  const beforeJournalIds = beforeJournals.map((x) => String(x.id)).filter(Boolean);
  const beforeSaleReturnIds = beforeSaleReturns.map((x) => String(x.id)).filter(Boolean);
  const beforePurchaseReturnIds = beforePurchaseReturns.map((x) => String(x.id)).filter(Boolean);

  const beforeCounts: Record<string, number> = {
    branches: await countByCompany('branches'),
    users: await countByCompany('users'),
    accounts: await countByCompany('accounts').catch(() => 0),
    contacts: await countByCompany('contacts'),
    products: await countByCompany('products'),
    studio_productions: await countByCompany('studio_productions').catch(() => 0),
    product_variations: await countByParent('product_variations', 'product_id', beforeProductIds),
    sales: await countByCompany('sales'),
    sales_items: await countByParent('sales_items', 'sale_id', beforeSaleIds),
    sale_returns: await countByCompany('sale_returns').catch(() => 0),
    sale_return_items: await countByParent('sale_return_items', 'sale_return_id', beforeSaleReturnIds).catch(() => 0),
    purchases: await countByCompany('purchases'),
    purchase_items: await countByParent('purchase_items', 'purchase_id', beforePurchaseIds),
    purchase_returns: await countByCompany('purchase_returns').catch(() => 0),
    purchase_return_items: await countByParent('purchase_return_items', 'purchase_return_id', beforePurchaseReturnIds).catch(() => 0),
    rentals: await countByCompany('rentals'),
    stock_movements: await countByCompany('stock_movements').catch(() => 0),
    payments: await countByCompany('payments').catch(() => 0),
    journal_entries: await countByCompany('journal_entries').catch(() => 0),
    journal_entry_lines: await countByParent('journal_entry_lines', 'journal_entry_id', beforeJournalIds).catch(() => 0),
    ledger_entries: await countByCompany('ledger_entries').catch(() => 0),
    rental_items: await countByParent('rental_items', 'rental_id', beforeRentalIds),
    rental_payments: await countByParent('rental_payments', 'rental_id', beforeRentalIds),
    expenses: await countByCompany('expenses'),
  };

  // Export backup payload
  const backup = {
    meta: {
      schema_version: 1,
      exported_at: new Date().toISOString(),
      company_id: companyId,
      company_name: companyName,
    },
    data: {
      branches: await fetchByCompany('branches'),
      accounts: beforeAccounts,
      contacts: await fetchByCompany('contacts'),
      products: beforeProducts,
      studio_productions: beforeStudioProductions,
      product_variations: await fetchByIds('product_variations', 'product_id', beforeProductIds).catch(() => []),
      sales: beforeSales,
      sales_items: await fetchByIds('sales_items', 'sale_id', beforeSaleIds).catch(() => []),
      sale_returns: beforeSaleReturns,
      sale_return_items: await fetchByIds('sale_return_items', 'sale_return_id', beforeSaleReturnIds).catch(() => []),
      purchases: beforePurchases,
      purchase_items: await fetchByIds('purchase_items', 'purchase_id', beforePurchaseIds).catch(() => []),
      purchase_returns: beforePurchaseReturns,
      purchase_return_items: await fetchByIds('purchase_return_items', 'purchase_return_id', beforePurchaseReturnIds).catch(() => []),
      rentals: beforeRentals,
      stock_movements: await fetchByCompany('stock_movements').catch(() => []),
      payments: beforePayments,
      journal_entries: beforeJournals,
      journal_entry_lines: await fetchByIds('journal_entry_lines', 'journal_entry_id', beforeJournalIds).catch(() => []),
      ledger_entries: beforeLedgerEntries,
      rental_items: await fetchByIds('rental_items', 'rental_id', beforeRentalIds).catch(() => []),
      rental_payments: await fetchByIds('rental_payments', 'rental_id', beforeRentalIds).catch(() => []),
      expenses: await fetchByCompany('expenses'),
    },
  };

  const backupPath = path.join(process.cwd(), 'backups', `manual_restore_drill_${companyId.slice(0, 8)}.json`);
  await fs.mkdir(path.dirname(backupPath), { recursive: true });
  await fs.writeFile(backupPath, JSON.stringify(backup, null, 2), 'utf-8');
  console.log(`Backup exported: ${backupPath}`);

  // Restore via transactional RPC (all-or-nothing + trigger-safe).
  const { data: restoreResult, error: restoreError } = await supabase.rpc('restore_company_backup_rpc', {
    p_company_id: companyId,
    p_backup: backup,
    p_confirmation: 'RESTORE',
  });
  if (restoreError) {
    throw new Error(`restore_company_backup_rpc failed: ${restoreError.message}`);
  }
  const restorePayload = (restoreResult || {}) as { success?: boolean; error?: string };
  if (!restorePayload.success) {
    throw new Error(`restore_company_backup_rpc returned failure: ${restorePayload.error || 'unknown error'}`);
  }

  // AFTER snapshot
  const afterSales = await fetchByCompany('sales');
  const afterPurchases = await fetchByCompany('purchases');
  const afterRentals = await fetchByCompany('rentals');
  const afterProducts = await fetchByCompany('products');
  const afterJournals = await fetchByCompany('journal_entries').catch(() => []);
  const afterSaleReturns = await fetchByCompany('sale_returns').catch(() => []);
  const afterPurchaseReturns = await fetchByCompany('purchase_returns').catch(() => []);

  const afterSaleIds = afterSales.map((x) => String(x.id)).filter(Boolean);
  const afterPurchaseIds = afterPurchases.map((x) => String(x.id)).filter(Boolean);
  const afterRentalIds = afterRentals.map((x) => String(x.id)).filter(Boolean);
  const afterProductIds = afterProducts.map((x) => String(x.id)).filter(Boolean);
  const afterJournalIds = afterJournals.map((x) => String(x.id)).filter(Boolean);
  const afterSaleReturnIds = afterSaleReturns.map((x) => String(x.id)).filter(Boolean);
  const afterPurchaseReturnIds = afterPurchaseReturns.map((x) => String(x.id)).filter(Boolean);

  const afterCounts: Record<string, number> = {
    branches: await countByCompany('branches'),
    users: await countByCompany('users'),
    accounts: await countByCompany('accounts').catch(() => 0),
    contacts: await countByCompany('contacts'),
    products: await countByCompany('products'),
    studio_productions: await countByCompany('studio_productions').catch(() => 0),
    product_variations: await countByParent('product_variations', 'product_id', afterProductIds),
    sales: await countByCompany('sales'),
    sales_items: await countByParent('sales_items', 'sale_id', afterSaleIds),
    sale_returns: await countByCompany('sale_returns').catch(() => 0),
    sale_return_items: await countByParent('sale_return_items', 'sale_return_id', afterSaleReturnIds).catch(() => 0),
    purchases: await countByCompany('purchases'),
    purchase_items: await countByParent('purchase_items', 'purchase_id', afterPurchaseIds),
    purchase_returns: await countByCompany('purchase_returns').catch(() => 0),
    purchase_return_items: await countByParent('purchase_return_items', 'purchase_return_id', afterPurchaseReturnIds).catch(() => 0),
    rentals: await countByCompany('rentals'),
    stock_movements: await countByCompany('stock_movements').catch(() => 0),
    payments: await countByCompany('payments').catch(() => 0),
    journal_entries: await countByCompany('journal_entries').catch(() => 0),
    journal_entry_lines: await countByParent('journal_entry_lines', 'journal_entry_id', afterJournalIds).catch(() => 0),
    ledger_entries: await countByCompany('ledger_entries').catch(() => 0),
    rental_items: await countByParent('rental_items', 'rental_id', afterRentalIds),
    rental_payments: await countByParent('rental_payments', 'rental_id', afterRentalIds),
    expenses: await countByCompany('expenses'),
  };

  const keys = Object.keys(beforeCounts);
  const diff = keys.map((k) => ({
    table: k,
    before: beforeCounts[k],
    after: afterCounts[k],
    delta: afterCounts[k] - beforeCounts[k],
    ok: beforeCounts[k] === afterCounts[k],
  }));

  console.log('\n=== BEFORE COUNTS ===');
  console.log(JSON.stringify(beforeCounts, null, 2));
  console.log('\n=== AFTER COUNTS ===');
  console.log(JSON.stringify(afterCounts, null, 2));
  console.log('\n=== CHECKLIST ===');
  console.table(diff);

  const failed = diff.filter((d) => !d.ok);
  if (failed.length) {
    throw new Error(`Count mismatch detected in ${failed.map((x) => x.table).join(', ')}`);
  }

  console.log('\nRestore drill success: counts match and no FK errors occurred.');
}

run().catch((err) => {
  console.error(`Drill failed: ${err?.message || err}`);
  process.exit(1);
});
