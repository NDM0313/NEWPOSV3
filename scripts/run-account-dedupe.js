/**
 * Run account_dedupe_apply.sql (repoint jel, mark duplicate accounts inactive).
 * Requires DATABASE_URL in .env.local.
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

async function main() {
  if (!connectionString) {
    console.error('No DATABASE_URL in .env.local');
    process.exit(1);
  }
  const client = new pg.Client({ connectionString });
  await client.connect();

  const sql = fs.readFileSync(path.join(auditDir, 'account_dedupe_apply.sql'), 'utf8');
  const doBlocks = sql.split(/\n(?=DO \$\$)/).filter((s) => s.includes('DO $$') && s.includes('END $$'));
  for (const block of doBlocks) {
    const stmt = block.replace(/^\s*--[^\n]*\n?/gm, '').trim();
    if (stmt.startsWith('DO $$')) await client.query(stmt);
  }
  console.log('Account dedupe applied (repoint jel + mark duplicates inactive).');

  const r = await client.query(`
    SELECT LOWER(TRIM(name)) AS norm_name, COUNT(*) AS cnt
    FROM accounts
    WHERE company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5' AND is_active = true
    GROUP BY LOWER(TRIM(name))
    HAVING COUNT(*) > 1
  `);
  console.log('Remaining duplicate name groups (active):', r.rows?.length ?? 0);

  await client.end();
  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
