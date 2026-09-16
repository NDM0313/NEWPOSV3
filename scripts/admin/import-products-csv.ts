#!/usr/bin/env npx tsx
/**
 * Import cleaned product CSV via service role (same data shape as ImportProductsModal).
 *
 * Usage:
 *   npx tsx scripts/admin/import-products-csv.ts --dry-run
 *   npx tsx scripts/admin/import-products-csv.ts --apply
 *   npx tsx scripts/admin/import-products-csv.ts --apply --csv data/products_import_clean.csv
 *
 * Env: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (see scripts/lib/adminSupabase.ts)
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createAdminSupabase, formatSupabaseAuthError } from '../lib/adminSupabase';

const DEFAULT_COMPANY = '2ab65903-62a3-4bcf-bced-076b681e9b74';
const DEFAULT_BRANCH = 'df93b9e4-feea-4b8b-8103-e630c185261b';
const DEFAULT_CSV = resolve(process.cwd(), 'data/products_import_clean.csv');
const CHUNK = 8;

type ParsedRow = {
  name: string;
  sku: string;
  category: string | null;
  subcategory: string | null;
  unit: string | null;
  brand: string | null;
  cost_price: number;
  selling_price: number;
  wholesale_price: number;
  opening_stock: number;
  min_stock: number;
  max_stock: number;
  track_stock: boolean;
  is_sellable: boolean;
  barcode: string | null;
  description: string | null;
};

type CatalogMaps = {
  categoryByName: Map<string, string>;
  subcategoryByCategoryAndName: Map<string, string>;
  unitByName: Map<string, string>;
  brandByName: Map<string, string>;
};

function parseArgs(argv: string[]) {
  let apply = false;
  let dryRun = false;
  let companyId = DEFAULT_COMPANY;
  let branchId = DEFAULT_BRANCH;
  let csvPath = DEFAULT_CSV;
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--apply') apply = true;
    else if (a === '--dry-run') dryRun = true;
    else if (a === '--company' && argv[i + 1]) companyId = argv[++i]!;
    else if (a === '--branch' && argv[i + 1]) branchId = argv[++i]!;
    else if (a === '--csv' && argv[i + 1]) csvPath = resolve(argv[++i]!);
  }
  if (!apply && !dryRun) dryRun = true;
  if (apply && dryRun) {
    console.error('Use either --apply or --dry-run');
    process.exit(1);
  }
  return { apply, dryRun, companyId, branchId, csvPath };
}

function stripBom(input: string) {
  return input.replace(/^\uFEFF/, '');
}

function parseCsvToMatrix(input: string): string[][] {
  const s = stripBom(input);
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let inQuotes = false;
  const addField = () => {
    row.push(cur);
    cur = '';
  };
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < s.length && s[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQuotes = false;
      } else cur += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') addField();
    else if (ch === '\r') continue;
    else if (ch === '\n') {
      addField();
      rows.push(row);
      row = [];
    } else cur += ch;
  }
  addField();
  rows.push(row);
  while (rows.length && rows[rows.length - 1]!.every((c) => c === '')) rows.pop();
  return rows;
}

function matrixToObjects(matrix: string[][]) {
  const headers = matrix[0]!.map((h) => h.trim());
  return matrix.slice(1).map((cells) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = cells[i] ?? '';
    });
    return obj;
  });
}

function parseBool(v: string) {
  const t = String(v ?? '').trim().toLowerCase();
  return t === 'yes' || t === '1' || t === 'true' || t === 'y';
}

function parseRow(raw: Record<string, string>): ParsedRow {
  const sellingPrice = parseFloat(String(raw.selling_price ?? '').trim()) || 0;
  const costPrice = parseFloat(String(raw.cost_price ?? '').trim()) || 0;
  const wholesaleRaw = parseFloat(String(raw.wholesale_price ?? '').trim());
  return {
    name: String(raw.name ?? '').trim(),
    sku: String(raw.sku ?? '').trim(),
    category: String(raw.category ?? '').trim() || null,
    subcategory: String(raw.subcategory ?? '').trim() || null,
    unit: String(raw.unit ?? '').trim() || null,
    brand: String(raw.brand ?? '').trim() || null,
    cost_price: costPrice,
    selling_price: sellingPrice,
    wholesale_price: Number.isFinite(wholesaleRaw) ? wholesaleRaw : sellingPrice,
    opening_stock: parseFloat(String(raw.opening_stock ?? '').trim()) || 0,
    min_stock: parseInt(String(raw.min_stock ?? '').trim(), 10) || 0,
    max_stock: parseInt(String(raw.max_stock ?? '').trim(), 10) || 1000,
    track_stock: raw.track_stock ? parseBool(raw.track_stock) : true,
    is_sellable: raw.is_sellable ? parseBool(raw.is_sellable) : true,
    barcode: String(raw.barcode ?? '').trim() || null,
    description: String(raw.description ?? '').trim() || null,
  };
}

async function loadCatalog(sb: ReturnType<typeof createAdminSupabase>, companyId: string): Promise<CatalogMaps> {
  const [{ data: categories }, { data: units }, { data: brands }] = await Promise.all([
    sb.from('product_categories').select('id, name, parent_id').eq('company_id', companyId),
    sb.from('units').select('id, name, short_code').eq('company_id', companyId),
    sb.from('brands').select('id, name').eq('company_id', companyId),
  ]);

  const categoryByName = new Map<string, string>();
  const subcategoryByCategoryAndName = new Map<string, string>();
  for (const c of categories || []) {
    if (!c.parent_id) categoryByName.set(String(c.name).toLowerCase(), c.id);
    else subcategoryByCategoryAndName.set(`${c.parent_id}|${String(c.name).toLowerCase()}`, c.id);
  }

  const unitByName = new Map<string, string>();
  for (const u of units || []) {
    unitByName.set(String(u.name).toLowerCase(), u.id);
    if (u.short_code) unitByName.set(String(u.short_code).toLowerCase(), u.id);
  }

  const brandByName = new Map<string, string>();
  for (const b of brands || []) brandByName.set(String(b.name).toLowerCase(), b.id);

  return { categoryByName, subcategoryByCategoryAndName, unitByName, brandByName };
}

async function ensureCatalog(
  sb: ReturnType<typeof createAdminSupabase>,
  companyId: string,
  catalog: CatalogMaps,
  row: ParsedRow,
  dryRun: boolean
) {
  let categoryId: string | null = null;
  if (row.subcategory && !row.category) throw new Error(`Subcategory requires category (${row.sku})`);

  if (row.category) {
    const catKey = row.category.toLowerCase();
    let catId = catalog.categoryByName.get(catKey) ?? null;
    if (!catId) {
      if (dryRun) {
        catId = `dry-run-cat-${catKey}`;
      } else {
        const { data, error } = await sb
          .from('product_categories')
          .insert({ company_id: companyId, name: row.category })
          .select('id')
          .single();
        if (error) throw error;
        catId = data.id;
      }
      catalog.categoryByName.set(catKey, catId!);
    }

    if (row.subcategory) {
      const subKey = `${catId}|${row.subcategory.toLowerCase()}`;
      let subId = catalog.subcategoryByCategoryAndName.get(subKey) ?? null;
      if (!subId) {
        if (dryRun) {
          subId = `dry-run-sub-${subKey}`;
        } else {
          const { data, error } = await sb
            .from('product_categories')
            .insert({ company_id: companyId, name: row.subcategory, parent_id: catId })
            .select('id')
            .single();
          if (error) throw error;
          subId = data.id;
        }
        catalog.subcategoryByCategoryAndName.set(subKey, subId!);
      }
      categoryId = subId;
    } else {
      categoryId = catId;
    }
  }

  let unitId: string | null = null;
  if (row.unit) {
    const uKey = row.unit.toLowerCase();
    unitId = catalog.unitByName.get(uKey) ?? null;
    if (!unitId) {
      if (dryRun) {
        unitId = `dry-run-unit-${uKey}`;
      } else {
        const { data, error } = await sb
          .from('units')
          .insert({
            company_id: companyId,
            name: row.unit,
            short_code: row.unit.slice(0, 10),
          })
          .select('id')
          .single();
        if (error) throw error;
        unitId = data.id;
      }
      catalog.unitByName.set(uKey, unitId!);
    }
  }

  let brandId: string | null = null;
  if (row.brand) {
    const bKey = row.brand.toLowerCase();
    brandId = catalog.brandByName.get(bKey) ?? null;
    if (!brandId) {
      if (dryRun) {
        brandId = `dry-run-brand-${bKey}`;
      } else {
        const { data, error } = await sb
          .from('brands')
          .insert({ company_id: companyId, name: row.brand })
          .select('id')
          .single();
        if (error) throw error;
        brandId = data.id;
      }
      catalog.brandByName.set(bKey, brandId!);
    }
  }

  return { categoryId, unitId, brandId };
}

async function findProductBySku(sb: ReturnType<typeof createAdminSupabase>, companyId: string, sku: string) {
  const { data, error } = await sb
    .from('products')
    .select('id, sku')
    .eq('company_id', companyId)
    .eq('sku', sku)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function importOneRow(
  sb: ReturnType<typeof createAdminSupabase>,
  companyId: string,
  branchId: string,
  catalog: CatalogMaps,
  row: ParsedRow,
  dryRun: boolean
) {
  if (!row.name || !row.sku) throw new Error('Missing name or sku');
  if (row.selling_price <= 0) throw new Error(`Invalid selling_price (${row.sku})`);

  const { categoryId, unitId, brandId } = await ensureCatalog(sb, companyId, catalog, row, dryRun);
  const existing = dryRun ? null : await findProductBySku(sb, companyId, row.sku);

  const payload = {
    company_id: companyId,
    category_id: categoryId,
    brand_id: brandId,
    unit_id: unitId,
    name: row.name,
    sku: row.sku,
    barcode: row.barcode,
    description: row.description,
    cost_price: row.cost_price,
    retail_price: row.selling_price,
    wholesale_price: row.wholesale_price,
    min_stock: row.min_stock,
    max_stock: row.max_stock,
    has_variations: false,
    is_rentable: false,
    is_sellable: row.is_sellable,
    track_stock: row.track_stock,
    is_active: true,
    current_stock: 0,
  };

  if (dryRun) {
    return { status: existing ? 'updated' : 'created' as const, openingStock: row.opening_stock };
  }

  let productId: string;
  let created = false;
  if (existing?.id) {
    const { error } = await sb.from('products').update(payload).eq('id', existing.id);
    if (error) throw error;
    productId = existing.id;
  } else {
    const { data, error } = await sb.from('products').insert(payload).select('id').single();
    if (error) throw error;
    productId = data.id;
    created = true;
  }

  if (created && row.opening_stock > 0) {
    const { error: movErr } = await sb.from('stock_movements').insert({
      company_id: companyId,
      branch_id: branchId,
      product_id: productId,
      variation_id: null,
      movement_type: 'adjustment',
      quantity: row.opening_stock,
      unit_cost: row.cost_price,
      total_cost: row.opening_stock * row.cost_price,
      reference_type: 'opening_balance',
      reference_id: null,
      notes: 'Opening stock (CSV import)',
    });
    if (movErr) throw movErr;
  }

  return { status: created ? 'created' as const : 'updated' as const, openingStock: created ? row.opening_stock : 0 };
}

async function runChunked<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>) {
  const results: PromiseSettledResult<R>[] = [];
  for (let i = 0; i < items.length; i += size) {
    const chunk = items.slice(i, i + size);
    const settled = await Promise.allSettled(chunk.map(fn));
    results.push(...settled);
  }
  return results;
}

async function main() {
  const { apply, dryRun, companyId, branchId, csvPath } = parseArgs(process.argv);
  const sb = createAdminSupabase();
  const raw = readFileSync(csvPath, 'utf8');
  const rows = matrixToObjects(parseCsvToMatrix(raw)).map(parseRow).filter((r) => r.name);

  console.log(`Product CSV import (${dryRun ? 'DRY-RUN' : 'LIVE'})`);
  console.log(`  company: ${companyId}`);
  console.log(`  branch:  ${branchId}`);
  console.log(`  csv:     ${csvPath}`);
  console.log(`  rows:    ${rows.length}`);

  const catalog = await loadCatalog(sb, companyId);
  let created = 0;
  let updated = 0;
  let failed = 0;
  const errors: { sku: string; message: string }[] = [];

  await runChunked(rows, CHUNK, async (row) => {
    try {
      const r = await importOneRow(sb, companyId, branchId, catalog, row, dryRun);
      if (r.status === 'created') created++;
      else updated++;
      return r;
    } catch (e) {
      failed++;
      const message =
        e && typeof e === 'object' && 'message' in e
          ? String((e as { message?: unknown }).message)
          : e instanceof Error
            ? e.message
            : JSON.stringify(e);
      errors.push({ sku: row.sku, message });
      return null;
    }
  });

  console.log('Summary:');
  console.log(`  created: ${created}`);
  console.log(`  updated: ${updated}`);
  console.log(`  failed:  ${failed}`);
  if (errors.length) {
    console.log('Errors (first 10):');
    for (const e of errors.slice(0, 10)) console.log(`  ${e.sku}: ${e.message}`);
  }

  if (failed > 0) process.exit(1);
  if (apply) {
    console.log('Import complete. Run opening GL repair if needed:');
    console.log(`  npx tsx scripts/admin/company-opening-repair-and-verify.ts --company ${companyId} --verify-only`);
  }
}

main().catch((err) => {
  console.error(formatSupabaseAuthError(err));
  process.exit(1);
});
