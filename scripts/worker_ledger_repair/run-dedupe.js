/**
 * Auto-apply worker ledger duplicate cleanup SQL (company eb71d817-b87e-4195-964b-7b5321b480f5).
 * Runs: 04 detection → 06 cleanup → 07 verification.
 * Usage: npm run worker-ledger-dedupe   OR   node scripts/worker_ledger_repair/run-dedupe.js
 */
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..', '..');

function loadEnvLocal() {
  const envPath = path.join(root, '.env.local');
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1).replace(/\\"/g, '"');
    if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1).replace(/\\'/g, "'");
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvLocal();

const connectionString =
  process.env.DATABASE_ADMIN_URL ||
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL;

if (!connectionString) {
  console.error('[worker-ledger-dedupe] No DATABASE_ADMIN_URL/DATABASE_POOLER_URL/DATABASE_URL in .env.local');
  process.exit(1);
}

function stripComments(sql) {
  return sql
    .replace(/--[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .trim();
}

async function run() {
  const client = new pg.Client({ connectionString });
  try {
    await client.connect();
    const companyId = 'eb71d817-b87e-4195-964b-7b5321b480f5';
    console.log('[worker-ledger-dedupe] Company:', companyId);

    // 1) Detection (04)
    const detectionPath = path.join(__dirname, '04_duplicate_detection_company.sql');
    const detectionSql = stripComments(fs.readFileSync(detectionPath, 'utf8'));
    const detectRes = await client.query(detectionSql);
    const duplicates = (detectRes.rows || []).length;
    if (duplicates === 0) {
      console.log('[worker-ledger-dedupe] No duplicate payment rows found. Nothing to clean.');
      const verifyPath = path.join(__dirname, '07_verification_company.sql');
      const verifySql = stripComments(fs.readFileSync(verifyPath, 'utf8'));
      await client.query(verifySql);
      console.log('[worker-ledger-dedupe] OK.');
      return;
    }
    console.log('[worker-ledger-dedupe] Duplicate groups found:', duplicates);
    (detectRes.rows || []).slice(0, 5).forEach((r, i) => {
      console.log(' ', i + 1, 'worker_id', r.worker_id?.slice(0, 8), 'reference_id', r.reference_id?.slice(0, 8), 'count', r.row_count);
    });

    // 2) Cleanup (06)
    const cleanupPath = path.join(__dirname, '06_duplicate_cleanup_company.sql');
    let cleanupSql = fs.readFileSync(cleanupPath, 'utf8');
    cleanupSql = stripComments(cleanupSql);
    const delRes = await client.query(cleanupSql);
    const deleted = delRes.rowCount ?? 0;
    console.log('[worker-ledger-dedupe] Deleted duplicate rows:', deleted);

    // 3) Verification (07)
    const verifyPath = path.join(__dirname, '07_verification_company.sql');
    const verifySql = stripComments(fs.readFileSync(verifyPath, 'utf8'));
    const verifyRes = await client.query(verifySql);
    const remaining = (verifyRes.rows || []).length;
    if (remaining > 0) {
      console.warn('[worker-ledger-dedupe] Warning: verification still shows', remaining, 'duplicate group(s). Re-run 04 in SQL Editor to inspect.');
    } else {
      console.log('[worker-ledger-dedupe] Verification: 0 duplicate groups remaining.');
    }
    console.log('[worker-ledger-dedupe] OK.');
  } catch (err) {
    console.error('[worker-ledger-dedupe] Error:', err.message);
    if (err.detail) console.error('Detail:', err.detail);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
