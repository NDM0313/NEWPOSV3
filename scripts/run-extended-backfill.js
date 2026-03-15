/**
 * Run extended payment backfill: preview, then apply, then verification.
 * Uses DATABASE_URL / DATABASE_POOLER_URL / DATABASE_ADMIN_URL from .env.local.
 * Usage: node scripts/run-extended-backfill.js
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const auditDir = path.join(root, 'docs', 'audit');

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
  console.error('No DATABASE_URL / DATABASE_POOLER_URL / DATABASE_ADMIN_URL in .env.local');
  process.exit(1);
}

async function runQuery(client, sql, label) {
  const res = await client.query(sql);
  if (res.rows && res.rows.length > 0) {
    console.table(res.rows);
  }
  return res;
}

async function main() {
  const client = new pg.Client({ connectionString });
  try {
    await client.connect();
    console.log('Extended backfill — connected\n');

    console.log('=== BEFORE: post_fix_verification ===');
    const verifyBefore = await runQuery(
      client,
      fs.readFileSync(path.join(auditDir, 'post_fix_verification.sql'), 'utf8'),
      'before'
    );

    console.log('\n=== PREVIEW: extended_payment_backfill_preview ===');
    const previewSql = fs.readFileSync(path.join(auditDir, 'extended_payment_backfill_preview.sql'), 'utf8');
    const preview = await client.query(previewSql);
    console.log('Backfill candidate rows:', preview.rows?.length ?? 0);
    if (preview.rows?.length > 0) {
      console.table(preview.rows.slice(0, 15));
      if (preview.rows.length > 15) console.log('... and', preview.rows.length - 15, 'more');
    }

    const applyPath = path.join(auditDir, 'extended_payment_backfill_apply.sql');
    const applyFull = fs.readFileSync(applyPath, 'utf8').trim();
    const insertEnd = applyFull.indexOf('\n\nUPDATE ');
    const insertSql = insertEnd >= 0 ? applyFull.slice(0, insertEnd + 1) : applyFull;
    const updateSql = insertEnd >= 0 ? applyFull.slice(insertEnd + 2).trim() : '';

    console.log('\n=== APPLY: INSERT payments ===');
    const insertRes = await client.query(insertSql);
    console.log('Inserted payments:', insertRes.rowCount ?? 0);

    if (updateSql) {
      console.log('=== APPLY: UPDATE journal_entries.payment_id ===');
      const updateRes = await client.query(updateSql);
      console.log('Updated journal_entries:', updateRes.rowCount ?? 0);
    }

    console.log('\n=== AFTER: post_fix_verification ===');
    const verifyAfter = await runQuery(
      client,
      fs.readFileSync(path.join(auditDir, 'post_fix_verification.sql'), 'utf8'),
      'after'
    );
    if (verifyAfter.rows?.length) console.table(verifyAfter.rows);

    console.log('\nExtended backfill complete.');
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
