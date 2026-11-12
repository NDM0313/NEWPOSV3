/**
 * Shared Postgres client for ledger remediation CLI (clone/staging only).
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { loadEnvLocal, pgClientOptions } from '../../single-core-ledger/staging-env-guard.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(__dirname, '../../..');
export const reportsDir = path.join(repoRoot, 'reports', 'single-core-ledger');
export const sqlDir = path.join(__dirname, '..', 'sql');

export function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

export function fail(msg, code = 1) {
  console.error(`❌ ${msg}`);
  process.exit(code);
}

export function initRemediationEnv() {
  loadEnvLocal(repoRoot);
}

export function getConnectionString() {
  return (
    process.env.DATABASE_ADMIN_URL ||
    process.env.DATABASE_URL ||
    process.env.DATABASE_POOLER_URL ||
    null
  );
}

export async function withPgClient(connectionString, fn) {
  const client = new pg.Client(pgClientOptions(connectionString));
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

export function readSqlFile(name) {
  const p = path.join(sqlDir, name);
  return fs.readFileSync(p, 'utf8');
}

export function loadSql(name) {
  return readSqlFile(name);
}

export async function runDiagnostics(client) {
  const { rows } = await client.query(
    'SELECT public.get_single_core_ledger_systemwide_diagnostics() AS payload'
  );
  return rows[0]?.payload ?? null;
}

export const fetchDiagnostics = runDiagnostics;

export function parseArg(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return null;
  return process.argv[idx + 1] ?? null;
}

export function parseCompanyId() {
  return parseArg('--company-id');
}

export function ensureReportsDir() {
  fs.mkdirSync(reportsDir, { recursive: true });
}

export function timestampStamp(iso = new Date().toISOString()) {
  return iso.replace(/[:.]/g, '-');
}

export function writeJsonReport(prefix, envelope) {
  ensureReportsDir();
  const runAt = envelope.run_at || new Date().toISOString();
  const stamp = timestampStamp(runAt);
  const jsonPath = path.join(reportsDir, `${prefix}-${stamp}.json`);
  const jsonText = JSON.stringify(envelope, null, 2);
  fs.writeFileSync(jsonPath, jsonText, 'utf8');
  const hash = sha256(jsonText);
  return { jsonPath, jsonText, hash, runAt, stamp };
}

export function writeCsvReport(prefix, rows, columns, stamp) {
  ensureReportsDir();
  const csvPath = path.join(reportsDir, `${prefix}-${stamp}.csv`);
  const header = columns.join(',');
  const lines = rows.map((r) =>
    columns
      .map((c) => {
        const v = r[c];
        if (v == null) return '';
        const s = String(v);
        return s.includes(',') || s.includes('"') || s.includes('\n')
          ? `"${s.replace(/"/g, '""')}"`
          : s;
      })
      .join(',')
  );
  fs.writeFileSync(csvPath, [header, ...lines].join('\n'), 'utf8');
  return csvPath;
}
