/**
 * A-to-Z backup package export (ZIP + manifest + per-entity CSVs).
 * Client-only: read via export RPC + inventory overview for stock balances.
 */

import JSZip from 'jszip';
import { exportCompanyBackup, type CompanyBackupData } from '@/app/services/backupService';
import { inventoryService } from '@/app/services/inventoryService';
import { contactsToCanonicalCsv } from '../profiles/contactsProfile';
import { PRODUCT_CANONICAL_HEADERS } from '../profiles/productsProfile';
import { serializeTableToCsv } from './serializeTableToCsv';
import {
  flattenInventoryOverviewToRows,
  INVENTORY_STOCK_HEADERS,
} from './flattenInventoryStock';
import { BACKUP_ENTITY_BY_KEY } from './backupEntityRegistry';
import {
  BACKUP_SCHEMA_VERSION,
  type BackupEntityKey,
  type BackupManifest,
  type BackupManifestFileEntry,
} from './types';

type JsonRow = Record<string, unknown>;

export interface ExportBackupPackageOptions {
  companyId: string;
  branchId?: string | null;
  companyName?: string;
}

function splitContacts(contacts: JsonRow[]): {
  customers: JsonRow[];
  suppliers: JsonRow[];
  workers: JsonRow[];
} {
  const customers: JsonRow[] = [];
  const suppliers: JsonRow[] = [];
  const workers: JsonRow[] = [];
  for (const c of contacts) {
    if (c.is_system_generated === true) continue;
    const t = String(c.type ?? 'customer').toLowerCase();
    const row = {
      backup_contact_id: c.id,
      name: c.name,
      type: t === 'both' ? 'both' : t === 'supplier' ? 'supplier' : t === 'worker' ? 'worker' : 'customer',
      email: c.email,
      phone: c.phone,
      mobile: c.mobile,
      address: c.address,
      city: c.city,
      state: c.state,
      country: c.country,
      postal_code: c.postal_code,
      notes: c.notes,
      opening_balance: c.opening_balance,
      credit_limit: c.credit_limit,
      payment_terms: c.payment_terms,
      worker_role: c.worker_role,
      worker_default_rate: c.worker_default_rate,
    };
    if (t === 'worker') workers.push(row);
    if (t === 'supplier') suppliers.push({ ...row, type: 'supplier' });
    else if (t === 'both') {
      customers.push({ ...row, type: 'customer' });
      suppliers.push({ ...row, type: 'supplier' });
    } else {
      customers.push({ ...row, type: 'customer' });
    }
  }
  return { customers, suppliers, workers };
}

function mapProductToCsvRow(p: JsonRow, categoryName = '', unitName = '', brandName = ''): Record<string, string | number> {
  return {
    backup_product_id: String(p.id ?? ''),
    name: String(p.name ?? ''),
    sku: String(p.sku ?? ''),
    category: categoryName,
    subcategory: '',
    unit: unitName,
    brand: brandName,
    cost_price: Number(p.cost_price ?? p.purchase_price ?? 0),
    selling_price: Number(p.retail_price ?? p.selling_price ?? 0),
    wholesale_price: Number(p.wholesale_price ?? p.retail_price ?? 0),
    opening_stock: 0,
    min_stock: Number(p.min_stock ?? 0),
    max_stock: Number(p.max_stock ?? 0),
    track_stock: p.track_stock !== false ? 'yes' : 'no',
    is_sellable: p.is_sellable !== false ? 'yes' : 'no',
    barcode: String(p.barcode ?? ''),
    description: String(p.description ?? ''),
    image_url: String(p.image_url ?? ''),
    variation_name: '',
    variation_sku: '',
    variation_barcode: '',
  };
}

/** Products CSV with backup_product_id column appended */
function buildProductsCsvWithIds(data: CompanyBackupData): string {
  const products = data.data.products ?? [];
  const headers = [...PRODUCT_CANONICAL_HEADERS, 'backup_product_id'];
  const rows = products.map((p) => {
    const base = mapProductToCsvRow(p);
    const cells = PRODUCT_CANONICAL_HEADERS.map((h) => {
      const v = base[h as keyof typeof base];
      return v === undefined || v === null ? '' : String(v);
    });
    cells.push(String(p.id ?? ''));
    return Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? '']));
  });
  return serializeTableToCsv(rows, headers);
}

function manifestEntry(
  key: BackupEntityKey,
  rowCount: number
): BackupManifestFileEntry {
  const def = BACKUP_ENTITY_BY_KEY[key];
  return {
    filename: def.filename,
    row_count: rowCount,
    phase: def.phase,
    commit_implemented: def.commitImplemented,
  };
}

function countCsvRows(csv: string): number {
  const lines = csv.trim().split(/\r?\n/).filter(Boolean);
  return Math.max(0, lines.length - 1);
}

export async function exportBackupPackage(
  options: ExportBackupPackageOptions
): Promise<Blob> {
  const { companyId, branchId = null, companyName } = options;
  const branchScope =
    branchId && branchId !== 'all' ? ('single' as const) : ('all' as const);
  const effectiveBranch = branchScope === 'single' ? branchId : null;

  const [backup, overview] = await Promise.all([
    exportCompanyBackup(companyId),
    inventoryService.getInventoryOverview(companyId, effectiveBranch),
  ]);

  const zip = new JSZip();
  const files: BackupManifest['files'] = {};

  const { customers, suppliers, workers } = splitContacts(backup.data.contacts ?? []);
  const customersCsv = contactsToCanonicalCsv(
    customers.map((c) => ({
      ...c,
      name: String(c.name ?? ''),
      type: 'customer' as const,
    })) as never
  );
  const suppliersCsv = contactsToCanonicalCsv(
    suppliers.map((c) => ({
      ...c,
      name: String(c.name ?? ''),
      type: 'supplier' as const,
    })) as never
  );
  const workersCsv = contactsToCanonicalCsv(
    workers.map((c) => ({
      ...c,
      name: String(c.name ?? ''),
      type: 'worker' as const,
    })) as never
  );

  zip.file('contacts_customers.csv', customersCsv);
  files.contacts_customers = manifestEntry('contacts_customers', countCsvRows(customersCsv));
  zip.file('contacts_suppliers.csv', suppliersCsv);
  files.contacts_suppliers = manifestEntry('contacts_suppliers', countCsvRows(suppliersCsv));
  zip.file('contacts_workers.csv', workersCsv);
  files.contacts_workers = manifestEntry('contacts_workers', countCsvRows(workersCsv));

  const productsCsv = buildProductsCsvWithIds(backup);
  zip.file('products.csv', productsCsv);
  files.products = manifestEntry('products', countCsvRows(productsCsv));

  const variations = backup.data.product_variations ?? [];
  const variationsCsv = serializeTableToCsv(variations);
  zip.file('product_variations.csv', variationsCsv);
  files.product_variations = manifestEntry('product_variations', variations.length);

  const stockRows = flattenInventoryOverviewToRows(overview, effectiveBranch);
  const stockCsv = serializeTableToCsv(stockRows, [...INVENTORY_STOCK_HEADERS]);
  zip.file('inventory_stock_balances.csv', stockCsv);
  files.inventory_stock_balances = manifestEntry(
    'inventory_stock_balances',
    stockRows.length
  );

  const tableExports: Array<{ key: BackupEntityKey; rows: JsonRow[] }> = [
    { key: 'sales', rows: backup.data.sales ?? [] },
    { key: 'sales_items', rows: backup.data.sales_items ?? [] },
    { key: 'purchases', rows: backup.data.purchases ?? [] },
    { key: 'purchase_items', rows: backup.data.purchase_items ?? [] },
    { key: 'rentals', rows: backup.data.rentals ?? [] },
    { key: 'rental_items', rows: backup.data.rental_items ?? [] },
    { key: 'rental_payments', rows: backup.data.rental_payments ?? [] },
    { key: 'expenses', rows: backup.data.expenses ?? [] },
  ];

  for (const { key, rows } of tableExports) {
    const def = BACKUP_ENTITY_BY_KEY[key];
    const csv = serializeTableToCsv(rows);
    zip.file(def.filename, csv);
    files[key] = manifestEntry(key, rows.length);
  }

  const manifest: BackupManifest = {
    schema_version: BACKUP_SCHEMA_VERSION,
    exported_at: new Date().toISOString(),
    company_id: companyId,
    company_name: companyName ?? backup.meta.company_name,
    branch_id: effectiveBranch,
    branch_scope: branchScope,
    files,
  };

  zip.file('manifest.json', JSON.stringify(manifest, null, 2));

  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}

export async function downloadBackupPackage(
  options: ExportBackupPackageOptions
): Promise<void> {
  const blob = await exportBackupPackage(options);
  const name = (options.companyName ?? options.companyId.slice(0, 8)).replace(/\s/g, '_');
  const date = new Date().toISOString().slice(0, 10);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `erp_backup_${name}_${date}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}
