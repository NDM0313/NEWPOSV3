/**
 * Prove FK accepts auth.users id: direct INSERT into user_branches and user_account_access.
 * Uses same DB connection (may need superuser or table owner to bypass RLS).
 */
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
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
  console.error('No DB URL');
  process.exit(1);
}

const client = new pg.Client({ connectionString });

async function run() {
  await client.connect();
  try {
    const linked = await client.query(`
      SELECT auth_user_id FROM public.users WHERE auth_user_id IS NOT NULL LIMIT 1
    `);
    const branch = await client.query('SELECT id FROM public.branches LIMIT 1');
    const account = await client.query('SELECT id FROM public.accounts LIMIT 1');
    const authUid = linked.rows[0]?.auth_user_id;
    const branchId = branch.rows[0]?.id;
    const accountId = account.rows[0]?.id;
    if (!authUid || !branchId || !accountId) {
      console.log('Missing linked user, branch, or account');
      return;
    }
    await client.query(
      'INSERT INTO public.user_branches (user_id, branch_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [authUid, branchId]
    );
    console.log('INSERT user_branches: OK (no FK error)');
    await client.query(
      'INSERT INTO public.user_account_access (user_id, account_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [authUid, accountId]
    );
    console.log('INSERT user_account_access: OK (no FK error)');
  } catch (e) {
    if (e.code === '23503') console.error('FK violation:', e.message);
    else console.error(e.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
