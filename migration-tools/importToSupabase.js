#!/usr/bin/env node
/**
 * Phase 13 Go-Live — Import extracted JSON into a target Supabase company.
 *
 * Usage:
 *   node migration-tools/importToSupabase.js --dry-run --target-company-id <uuid>
 *   node migration-tools/importToSupabase.js --confirm --target-company-id <uuid>
 *   node migration-tools/importToSupabase.js --confirm --phase ledgers --target-company-id <uuid>
 *
 * Env: migration-tools/.env.migration (see .env.migration.example) + optional .env.local fallback.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { batchUpsert } from './lib/batchUpsert.js';
import { loadMigrationEnv } from './lib/loadMigrationEnv.js';

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function normalizeTimestamp(value) {
  if (value == null || value === '') return null;
  const s = String(value).trim();
  if (/^0000-00-00/.test(s)) return null;
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) {
    return s.replace(' ', 'T') + 'Z';
  }
  if (/^0000-00-00/.test(s.replace('T', ' '))) return null;
  return s;
}

function deterministicLineId(entryId, lineIndex) {
  const hex = createHash('sha256')
    .update(`phase13:journal_line:${entryId}:${lineIndex}`)
    .digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function sortAccountsByParent(accounts) {
  const sorted = [];
  const done = new Set();
  let remaining = [...accounts];

  while (remaining.length > 0) {
    const wave = remaining.filter((a) => !a.parentId || done.has(a.parentId));
    if (wave.length === 0) {
      throw new Error('Circular or missing parent reference in accounts.json');
    }
    for (const account of wave) {
      sorted.push(account);
      done.add(account.id);
    }
    remaining = remaining.filter((a) => !done.has(a.id));
  }
  return sorted;
}

function mapContactRow(entry, companyId) {
  return {
    id: entry.id,
    company_id: companyId,
    type: entry.type,
    name: entry.name,
    phone: entry.phone ?? null,
    email: entry.email ?? null,
    city: entry.city ?? null,
    address: entry.address ?? null,
    country: entry.country ?? null,
    opening_balance: entry.opening_balance ?? 0,
    credit_limit: entry.credit_limit ?? null,
    is_active: entry.is_active ?? true,
    code: entry.code ?? null,
    is_default: entry.is_default ?? false,
    is_system_generated: entry.is_system_generated ?? false,
    system_type: entry.system_type ?? null,
  };
}

function mapAccountRow(entry, companyId) {
  return {
    id: entry.id,
    company_id: companyId,
    code: entry.code,
    name: entry.name,
    type: entry.type,
    parent_id: entry.parentId ?? null,
    balance: entry.balance ?? 0,
    is_group: entry.isGroup ?? false,
    linked_contact_id: entry.linkedContactId ?? null,
    is_active: entry.isActive ?? true,
  };
}

function mapProductRow(entry, companyId) {
  return {
    id: entry.id,
    company_id: companyId,
    name: entry.name,
    sku: entry.sku,
    description: entry.description ?? null,
    cost_price: entry.costPrice ?? 0,
    retail_price: entry.retailPrice ?? 0,
    wholesale_price: entry.wholesalePrice ?? null,
    min_stock: entry.minStock ?? 0,
    has_variations: entry.hasVariations ?? (entry.variations?.length > 1),
    is_active: entry.status !== 'inactive',
    track_stock: true,
    category_id: null,
    brand_id: null,
  };
}

function mapVariationRows(parent, companyId) {
  return (parent.variations || []).map((variant) => ({
    id: variant.id,
    product_id: parent.id,
    sku: variant.sku,
    attributes: variant.attributes || {},
    price: variant.price ?? 0,
    stock: variant.stock ?? 0,
    is_active: true,
  }));
}

function mapJournalEntryRow(entry, companyId) {
  return {
    id: entry.id,
    company_id: companyId,
    entry_no: entry.entry_no ?? null,
    entry_date: entry.entry_date,
    description: entry.description ?? null,
    reference_type: entry.reference_type ?? null,
    reference_id: entry.reference_id ?? null,
    // Payments are not imported in Phase 13; keep journal headers without FK violations.
    payment_id: null,
    total_debit: entry.total_debit ?? 0,
    total_credit: entry.total_credit ?? 0,
    is_posted: entry.posted_at != null,
    posted_at: normalizeTimestamp(entry.posted_at),
    is_void: false,
    created_at: normalizeTimestamp(entry.created_at),
  };
}

function mapJournalLineRows(entry) {
  return (entry.lines || []).map((line, index) => ({
    id: deterministicLineId(entry.id, index),
    journal_entry_id: entry.id,
    account_id: line.account_id,
    debit: line.debit ?? 0,
    credit: line.credit ?? 0,
    description: line.description ?? null,
  }));
}

async function preflightCompany(supabase, companyId) {
  const { data, error } = await supabase.from('companies').select('id, name').eq('id', companyId).maybeSingle();
  if (error) throw new Error(`Company preflight failed: ${error.message}`);
  if (!data) {
    throw new Error(`Company not found for TARGET_COMPANY_ID=${companyId}. Create the company first.`);
  }
  console.log(`Target company: ${data.name} (${data.id})`);
  return data;
}

async function existingWalkingCustomerId(supabase, companyId) {
  if (!supabase) return null;

  let result;
  try {
    result = await supabase
      .from('contacts')
      .select('id')
      .eq('company_id', companyId)
      .eq('system_type', 'walking_customer')
      .maybeSingle();
  } catch (err) {
    console.warn(
      `[contacts] Walk-in lookup exception: ${err?.message ?? err} — proceeding to insert extracted walk-in`
    );
    return null;
  }

  if (result == null) {
    console.warn('[contacts] Walk-in lookup returned no response — proceeding to insert extracted walk-in');
    return null;
  }

  const error = result?.error;
  const data = result?.data;

  if (error) {
    console.warn(
      `[contacts] Walk-in lookup: ${error?.message ?? error} — proceeding to insert extracted walk-in`
    );
    return null;
  }

  return data?.id ?? null;
}

/** Upsert batches fail if the same primary key appears twice in one chunk. */
function dedupeRowsById(rows, label) {
  const byId = new Map();
  for (const r of rows) {
    if (r?.id != null) byId.set(r.id, r);
  }
  if (byId.size < rows.length) {
    console.log(`[${label}] Deduped ${rows.length - byId.size} row(s) with duplicate id`);
  }
  return [...byId.values()];
}

/** One code per company (idx_contacts_company_code_unique); keep first occurrence. */
function dedupeContactsByCompanyCode(rows) {
  const seen = new Set();
  const out = [];
  let skipped = 0;
  for (const r of rows) {
    const code = r.code != null ? String(r.code).trim() : '';
    if (!code) {
      out.push(r);
      continue;
    }
    const key = code.toLowerCase();
    if (seen.has(key)) {
      skipped += 1;
      continue;
    }
    seen.add(key);
    out.push(r);
  }
  if (skipped) {
    console.log(`[contacts] Deduped ${skipped} row(s) with duplicate code within import batch`);
  }
  return out;
}

async function importContacts(supabase, outputDir, companyId, batchSize, dryRun) {
  const doc = readJson(path.join(outputDir, 'contacts.json'));
  const entries = doc.entries || [];
  let rows = entries.map((e) => mapContactRow(e, companyId));

  let skippedWalkIn = 0;
  if (!dryRun) {
    const existingWalkInId = await existingWalkingCustomerId(supabase, companyId);
    if (existingWalkInId) {
      const before = rows.length;
      rows = rows.filter(
        (r) => !(r.system_type === 'walking_customer' && r.id !== existingWalkInId)
      );
      skippedWalkIn = before - rows.length;
      if (skippedWalkIn) {
        console.log(
          `[contacts] Skipped ${skippedWalkIn} extracted walk-in row(s) — company already has walking_customer (${existingWalkInId})`
        );
      }
      rows = rows.filter(
        (r) =>
          !(
            r.code &&
            String(r.code).trim().toUpperCase() === 'CUS-0000' &&
            r.system_type !== 'walking_customer'
          )
      );
    }
  } else {
    const walkIns = rows.filter((r) => r.system_type === 'walking_customer');
    if (walkIns.length) {
      console.log(
        `[contacts] dry-run: ${walkIns.length} walk-in row(s) may be skipped if target company already has walking_customer`
      );
    }
  }

  rows = dedupeContactsByCompanyCode(rows);

  if (dryRun) {
    console.log(`[contacts] dry-run: would upsert ${rows.length} rows`);
    return { table: 'contacts', inserted: rows.length, skippedWalkIn, batches: 0 };
  }

  const result = await batchUpsert(supabase, 'contacts', rows, { batchSize, label: 'contacts' });
  return { ...result, skippedWalkIn };
}

async function importAccounts(supabase, outputDir, companyId, batchSize, dryRun) {
  const accounts = readJson(path.join(outputDir, 'accounts.json'));
  const sorted = sortAccountsByParent(accounts);
  const rows = sorted.map((a) => mapAccountRow(a, companyId));

  if (dryRun) {
    console.log(`[accounts] dry-run: would upsert ${rows.length} rows (${sorted.filter((a) => a.isGroup).length} groups first)`);
    return { table: 'accounts', inserted: rows.length, batches: 0 };
  }

  return batchUpsert(supabase, 'accounts', rows, { batchSize, label: 'accounts' });
}

async function importProducts(supabase, outputDir, companyId, batchSize, dryRun) {
  const doc = readJson(path.join(outputDir, 'products.json'));
  const entries = doc.entries || [];
  const parentRows = entries.map((p) => mapProductRow(p, companyId));
  const variantRows = dedupeRowsById(
    entries.flatMap((p) => mapVariationRows(p, companyId)),
    'product_variations'
  );

  if (dryRun) {
    console.log(`[products] dry-run: would upsert ${parentRows.length} parent rows`);
    console.log(`[product_variations] dry-run: would upsert ${variantRows.length} variant rows`);
    return {
      table: 'products',
      inserted: parentRows.length,
      variants: variantRows.length,
      batches: 0,
    };
  }

  const parentResult = await batchUpsert(supabase, 'products', parentRows, {
    batchSize,
    label: 'products',
  });
  const variantResult = await batchUpsert(supabase, 'product_variations', variantRows, {
    batchSize,
    label: 'product_variations',
  });
  return {
    table: 'products',
    inserted: parentResult.inserted,
    variants: variantResult.inserted,
    batches: parentResult.batches + variantResult.batches,
  };
}

async function importLedgers(supabase, outputDir, companyId, batchSize, dryRun) {
  const doc = readJson(path.join(outputDir, 'ledgers.json'));
  const entries = doc.entries || [];
  const headerRows = dedupeRowsById(
    entries.map((e) => mapJournalEntryRow(e, companyId)),
    'journal_entries'
  );
  const lineRows = dedupeRowsById(entries.flatMap((e) => mapJournalLineRows(e)), 'journal_entry_lines');

  if (dryRun) {
    console.log(`[journal_entries] dry-run: would upsert ${headerRows.length} rows`);
    console.log(`[journal_entry_lines] dry-run: would upsert ${lineRows.length} rows`);
    return {
      table: 'journal_entries',
      inserted: headerRows.length,
      lines: lineRows.length,
      batches: 0,
    };
  }

  const headerResult = await batchUpsert(supabase, 'journal_entries', headerRows, {
    batchSize,
    label: 'journal_entries',
  });
  const lineResult = await batchUpsert(supabase, 'journal_entry_lines', lineRows, {
    batchSize,
    label: 'journal_entry_lines',
  });
  return {
    table: 'journal_entries',
    inserted: headerResult.inserted,
    lines: lineResult.inserted,
    batches: headerResult.batches + lineResult.batches,
  };
}

function shouldRun(phase, name) {
  return phase === 'all' || phase === name;
}

function writeReport(outputDir, report) {
  const outPath = path.join(outputDir, 'import_report.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(`Report written: ${outPath}`);
}

async function main() {
  const startedAt = new Date().toISOString();
  let env;

  try {
    env = loadMigrationEnv();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }

  const { dryRun, phase, batchSize, targetCompanyId, supabaseUrl, serviceRoleKey, outputDir } = env;

  console.log('Phase 13 Go-Live import');
  console.log(`  mode: ${dryRun ? 'DRY-RUN (no writes)' : 'LIVE (--confirm)'}`);
  console.log(`  target company: ${targetCompanyId}`);
  console.log(`  phase: ${phase}`);
  console.log(`  batch size: ${batchSize}`);
  console.log(`  output dir: ${outputDir}`);

  const requiredFiles = ['contacts.json', 'accounts.json', 'products.json', 'ledgers.json'];
  for (const file of requiredFiles) {
    const p = path.join(outputDir, file);
    if (!fs.existsSync(p)) {
      console.error(`Missing required file: ${p}`);
      process.exit(1);
    }
  }

  let supabase = null;
  if (!dryRun) {
    supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await preflightCompany(supabase, targetCompanyId);
  }

  const phaseResults = {};
  const runOrder = [
    ['contacts', importContacts],
    ['accounts', importAccounts],
    ['products', importProducts],
    ['ledgers', importLedgers],
  ];

  try {
    for (const [name, fn] of runOrder) {
      if (!shouldRun(phase, name)) continue;
      console.log(`\n--- Phase: ${name} ---`);
      phaseResults[name] = await fn(supabase, outputDir, targetCompanyId, batchSize, dryRun);
    }
  } catch (err) {
    console.error('\nImport aborted:', err.message);
    writeReport(outputDir, {
      ok: false,
      startedAt,
      finishedAt: new Date().toISOString(),
      targetCompanyId,
      dryRun,
      phase,
      phaseResults,
      error: err.message,
    });
    process.exit(1);
  }

  const report = {
    ok: true,
    startedAt,
    finishedAt: new Date().toISOString(),
    targetCompanyId,
    dryRun,
    phase,
    batchSize,
    phaseResults,
  };
  writeReport(outputDir, report);
  console.log('\nImport finished successfully.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
