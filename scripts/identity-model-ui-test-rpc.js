/**
 * PHASE 8 backend test: call set_user_branches and set_user_account_access with a valid auth.users id.
 * Proves RPC + DB accept auth id (no FK error). Run after identity-model-verify-and-fix.js.
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
      SELECT id, email, auth_user_id FROM public.users WHERE auth_user_id IS NOT NULL LIMIT 1
    `);
    if (linked.rows.length === 0) {
      console.log('No linked user (auth_user_id NOT NULL). Create/invite in Auth and run STEP 6 link, then retry.');
      return;
    }
    const authUid = linked.rows[0].auth_user_id;
    const branch = await client.query('SELECT id FROM public.branches LIMIT 1');
    const account = await client.query('SELECT id FROM public.accounts LIMIT 1');
    const branchId = branch.rows[0]?.id;
    const accountId = account.rows[0]?.id;
    if (!branchId || !accountId) {
      console.log('No branch or account found.');
      return;
    }
    console.log('Linked user:', linked.rows[0].email, 'auth_user_id:', authUid);
    console.log('Branch:', branchId, 'Account:', accountId);

    await client.query('SELECT set_user_branches($1, $2, $3, (SELECT company_id FROM public.users WHERE auth_user_id = $1 LIMIT 1))', [authUid, [branchId], branchId]);
    console.log('set_user_branches: OK');
    await client.query('SELECT set_user_account_access($1, $2, (SELECT company_id FROM public.users WHERE auth_user_id = $1 LIMIT 1))', [authUid, [accountId]]);
    console.log('set_user_account_access: OK');

    const rowsB = await client.query('SELECT branch_id FROM public.user_branches WHERE user_id = $1', [authUid]);
    const rowsA = await client.query('SELECT account_id FROM public.user_account_access WHERE user_id = $1', [authUid]);
    console.log('user_branches rows for this auth id:', rowsB.rows.length);
    console.log('user_account_access rows for this auth id:', rowsA.rows.length);
  } finally {
    await client.end();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
