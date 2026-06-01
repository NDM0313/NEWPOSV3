#!/usr/bin/env node
/**
 * Phase 13 Track C — Extract contacts (customers, suppliers, walk-in).
 *
 * Usage:
 *   node migration-tools/extractContacts.js [62547.sql] [--config mapping.json]
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseSqlInsertRows } from './lib/parseSqlInsert.js';
import { legacyToUuid } from './lib/legacyId.js';
import { loadConfig, resolveDumpPath, resolveOutputDir, TOOLS_ROOT } from './lib/resolvePaths.js';

function resolveName(row) {
  const supplier = row.supplier_business_name != null ? String(row.supplier_business_name).trim() : '';
  const name = row.name != null ? String(row.name).trim() : '';
  if (name) return name;
  if (supplier) return supplier;
  const parts = [row.prefix, row.first_name, row.middle_name, row.last_name]
    .filter((p) => p != null && String(p).trim())
    .map((p) => String(p).trim());
  return parts.join(' ').trim() || 'Unknown';
}

function resolvePhone(row) {
  return (
    (row.mobile != null && String(row.mobile).trim()) ||
    (row.landline != null && String(row.landline).trim()) ||
    (row.alternate_number != null && String(row.alternate_number).trim()) ||
    null
  );
}

function isWalkingCustomer(row) {
  if (Number(row.is_default) === 1) return true;
  const n = resolveName(row).toLowerCase();
  return /walking|walk-in|walk in|^customers$/.test(n);
}

function mapContactType(row) {
  const t = String(row.type || '').toLowerCase().trim();
  if (t === 'supplier') return 'supplier';
  if (t === 'both') return 'both';
  if (t === 'customer') return 'customer';
  return 'customer';
}

function main() {
  const args = process.argv.slice(2);
  const configFlag = args.indexOf('--config');
  const configPath =
    configFlag >= 0 && args[configFlag + 1]
      ? path.resolve(args[configFlag + 1])
      : path.join(TOOLS_ROOT, 'config', 'mapping.example.json');

  const config = fs.existsSync(configPath) ? loadConfig(configPath) : { legacyBusinessId: 2 };
  const businessId = Number(config.legacyBusinessId ?? 2);
  const companyId = String(config.targetCompanyId || '00000000-0000-4000-8000-000000000001');
  const dumpPath = resolveDumpPath(args, config);
  const outDir = resolveOutputDir(config);

  if (!fs.existsSync(dumpPath)) {
    console.error(`Dump not found: ${dumpPath}`);
    process.exit(1);
  }

  console.log(`Reading dump: ${dumpPath}`);
  const sql = fs.readFileSync(dumpPath, 'utf8');
  const rows = parseSqlInsertRows(sql, 'contacts');

  const stats = {
    total: 0,
    customers: 0,
    suppliers: 0,
    both: 0,
    walkingCustomer: 0,
    skippedDeleted: 0,
  };

  const entries = [];

  for (const row of rows) {
    if (Number(row.business_id) !== businessId) continue;
    if (row.deleted_at) {
      stats.skippedDeleted++;
      continue;
    }

    const legacyId = Number(row.id);
    const walkIn = isWalkingCustomer(row);
    let type = mapContactType(row);
    let name = resolveName(row);

    if (walkIn) {
      name = 'Walk-in Customer';
      type = 'customer';
      stats.walkingCustomer++;
    }

    if (type === 'customer') stats.customers++;
    else if (type === 'supplier') stats.suppliers++;
    else if (type === 'both') stats.both++;

    const address = [row.address_line_1, row.address_line_2].filter(Boolean).join(', ').trim() || null;

    entries.push({
      id: legacyToUuid('contacts', legacyId),
      company_id: companyId,
      type,
      name,
      phone: resolvePhone(row),
      email: row.email != null ? String(row.email).trim() || null : null,
      city: row.city != null ? String(row.city).trim() || null : null,
      address,
      opening_balance: Number(row.balance) || 0,
      credit_limit: row.credit_limit != null ? Number(row.credit_limit) : null,
      is_active: String(row.contact_status || 'active').toLowerCase() === 'active',
      code: row.contact_id != null ? String(row.contact_id).trim() || null : null,
      is_default: walkIn || Number(row.is_default) === 1,
      is_system_generated: walkIn,
      system_type: walkIn ? 'walking_customer' : null,
      legacyId,
      legacyBusinessId: businessId,
      legacyType: row.type != null ? String(row.type) : null,
    });
    stats.total++;
  }

  entries.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'contacts.json');
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        meta: {
          track: 'C',
          documentType: 'contacts',
          companyId,
          legacyBusinessId: businessId,
          extractedAt: new Date().toISOString(),
          stats,
        },
        entries,
      },
      null,
      2,
    ),
    'utf8',
  );

  console.log(`Wrote ${stats.total} contacts → ${outPath}`);
  console.log(
    `Track C Contacts: extracted ${stats.total} (customers: ${stats.customers}, suppliers: ${stats.suppliers}, both: ${stats.both}, walk-in: ${stats.walkingCustomer})`,
  );
}

main();
