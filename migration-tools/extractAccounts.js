#!/usr/bin/env node
/**
 * Phase 13 — Extract accounting_accounts from legacy phpMyAdmin dump (62547.sql).
 * Output: JSON arrays matching modern AccountRow shape + migration metadata.
 *
 * Usage:
 *   node migration-tools/extractAccounts.js [path/to/62547.sql] [--config mapping.json]
 *
 * Default dump path: repo root 62547.sql, else config dumpPath, else ../Downloads/62547.sql
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSqlInsertRows } from './lib/parseSqlInsert.js';
import { legacyToUuid, stripHtml } from './lib/legacyId.js';
import { mapLegacyAccountType, provisionalAccountCode } from './lib/mapAccountType.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOOLS_ROOT = __dirname;

function loadConfig(configPath) {
  const raw = fs.readFileSync(configPath, 'utf8');
  return JSON.parse(raw);
}

function resolveDumpPath(args, config) {
  const positional = args.filter((a) => !a.startsWith('--') && !a.endsWith('.json'));
  if (positional[0]) return path.resolve(positional[0]);

  const candidates = [
    config?.dumpPath ? path.resolve(TOOLS_ROOT, config.dumpPath) : null,
    path.resolve(TOOLS_ROOT, '..', '62547.sql'),
    path.resolve(process.env.USERPROFILE || process.env.HOME || '', 'Downloads', '62547.sql'),
  ].filter(Boolean);

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return candidates[0];
}

function transformAccounts(rawRows, config) {
  const businessId = Number(config.legacyBusinessId ?? 2);
  const companyId = String(config.targetCompanyId);

  const scoped = rawRows.filter((r) => {
    const bid = Number(r.business_id);
    if (bid !== businessId) return false;
    if (Number(r.id) === 1 && String(r.name) === 'name') return false;
    return true;
  });

  const byId = new Map(scoped.map((r) => [Number(r.id), r]));
  const childIds = new Set(
    scoped
      .map((r) => (r.parent_account_id != null ? Number(r.parent_account_id) : null))
      .filter((id) => id != null),
  );

  const accounts = scoped.map((row) => {
    const legacyId = Number(row.id);
    const parentLegacyId = row.parent_account_id != null ? Number(row.parent_account_id) : null;
    const type = mapLegacyAccountType(row, byId);
    const isGroup = childIds.has(legacyId);
    const code = provisionalAccountCode(row, type, legacyId);
    const status = String(row.status || 'active').toLowerCase();

    /** @type {import('../erp-mobile-app/src/api/accounts.ts').AccountRow & Record<string, unknown>} */
    const modern = {
      id: legacyToUuid('accounting_accounts', legacyId),
      code,
      name: String(row.name || '').trim(),
      type,
      balance: 0,
      linkedContactId: null,
    };

    return {
      ...modern,
      companyId,
      legacyId,
      legacyBusinessId: businessId,
      parentLegacyId,
      parentId: parentLegacyId != null ? legacyToUuid('accounting_accounts', parentLegacyId) : null,
      isGroup,
      isActive: status === 'active',
      glCode: row.gl_code != null ? String(row.gl_code) : null,
      accountPrimaryType: row.account_primary_type != null ? String(row.account_primary_type) : null,
      description: stripHtml(row.description),
      legacyCreatedAt: row.created_at,
      legacyUpdatedAt: row.updated_at,
    };
  });

  accounts.sort((a, b) => {
    const pa = a.parentLegacyId ?? 0;
    const pb = b.parentLegacyId ?? 0;
    if (pa !== pb) return pa - pb;
    return a.legacyId - b.legacyId;
  });

  const idMap = Object.fromEntries(
    accounts.map((a) => [String(a.legacyId), { uuid: a.id, code: a.code, name: a.name, type: a.type }]),
  );

  return { accounts, idMap, stats: { total: accounts.length, businessId } };
}

function main() {
  const args = process.argv.slice(2);
  const configFlag = args.indexOf('--config');
  const configPath =
    configFlag >= 0 && args[configFlag + 1]
      ? path.resolve(args[configFlag + 1])
      : path.join(TOOLS_ROOT, 'config', 'mapping.example.json');

  const config = fs.existsSync(configPath) ? loadConfig(configPath) : { legacyBusinessId: 2 };
  const dumpPath = resolveDumpPath(args, config);

  if (!fs.existsSync(dumpPath)) {
    console.error(`Dump file not found: ${dumpPath}`);
    console.error('Copy 62547.sql to repo root or pass path: node migration-tools/extractAccounts.js /path/to/62547.sql');
    process.exit(1);
  }

  console.log(`Reading dump: ${dumpPath}`);
  const sql = fs.readFileSync(dumpPath, 'utf8');
  const rawRows = parseSqlInsertRows(sql, 'accounting_accounts');
  console.log(`Parsed ${rawRows.length} raw accounting_accounts rows`);

  const { accounts, idMap, stats } = transformAccounts(rawRows, config);
  const outDir = path.resolve(TOOLS_ROOT, config.outputDir || './output');
  fs.mkdirSync(outDir, { recursive: true });

  const accountsPath = path.join(outDir, 'accounts.json');
  const mapPath = path.join(outDir, 'account_id_map.json');

  fs.writeFileSync(accountsPath, JSON.stringify(accounts, null, 2), 'utf8');
  fs.writeFileSync(mapPath, JSON.stringify(idMap, null, 2), 'utf8');

  const byType = accounts.reduce((acc, a) => {
    acc[a.type] = (acc[a.type] || 0) + 1;
    return acc;
  }, {});

  console.log(`Wrote ${stats.total} accounts (business_id=${stats.businessId}) → ${accountsPath}`);
  console.log(`Wrote id map → ${mapPath}`);
  console.log('By type:', byType);
}

main();
