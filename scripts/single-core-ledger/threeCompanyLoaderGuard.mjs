/**
 * Read-only three-company unified loader guard (post BS/P&L swap baseline).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSqlFileViaSsh } from './monitoringSshSql.mjs';

export const ALLOWED_LOADER_COMPANIES = new Set(['DIN CHINA', 'DIN BRIDAL', 'DIN COUTURE']);

const FLAG_GUARD_SQL = path.join(path.dirname(fileURLToPath(import.meta.url)), 'three-company-loader-guard-pipe.sql');

export function parseThreeCompanyLoaderGuardRows(raw) {
  return raw.trim().split('\n').filter(Boolean).map((line) => {
    const [name, count] = line.split('|');
    return { name, loaders_on: Number(count) };
  });
}

export function evaluateThreeCompanyLoaderGuard(rows) {
  const unexpected = rows.filter((r) => !ALLOWED_LOADER_COMPANIES.has(r.name));
  return {
    ok: unexpected.length === 0 && rows.length === 3,
    rows,
    unexpected,
    other_company_loaders_on: unexpected.reduce((n, r) => n + r.loaders_on, 0),
  };
}

export function runReadOnlyFlagGuard(sqlPath = FLAG_GUARD_SQL) {
  if (!fs.existsSync(sqlPath)) {
    return { ok: false, error: 'missing three-company-loader-guard-pipe.sql' };
  }
  try {
    const raw = execSqlFileViaSsh(sqlPath);
    return evaluateThreeCompanyLoaderGuard(parseThreeCompanyLoaderGuardRows(raw));
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}
