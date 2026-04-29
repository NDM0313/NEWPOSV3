import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function loadEnv() {
  for (const f of ['.env.local', '.env']) {
    const p = path.join(root, f);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq === -1) continue;
      const key = t.slice(0, eq).trim();
      let val = t.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

async function run() {
  loadEnv();
  const connectionString =
    process.env.DATABASE_ADMIN_URL ||
    process.env.DATABASE_POOLER_URL ||
    process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('No DATABASE_ADMIN_URL / DATABASE_POOLER_URL / DATABASE_URL found in .env.local or .env');
  }

  const sqlFile = process.argv[2] || 'mm_user_branch_access_deep_fix.sql';
  const sqlPath = path.join(root, 'scripts', 'sql', sqlFile);
  if (!fs.existsSync(sqlPath)) {
    throw new Error(`SQL file not found: ${sqlPath}`);
  }
  const sql = fs.readFileSync(sqlPath, 'utf8');
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    const result = await client.query(sql);
    console.log(`[MM BRANCH FIX] executed successfully: ${sqlFile}`);
    if (result?.rows?.length) {
      console.table(result.rows);
    }
  } finally {
    await client.end();
  }
}

run().catch((e) => {
  console.error('[MM BRANCH FIX] failed:', e?.message || e);
  process.exit(1);
});
