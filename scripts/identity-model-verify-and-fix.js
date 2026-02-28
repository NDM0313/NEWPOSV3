/**
 * PHASE 1–6: Prove FK state, orphan counts, apply fix, re-verify, link unlinked users.
 * Uses same DB connection as run-migrations.js (.env.local).
 * Run: node scripts/identity-model-verify-and-fix.js
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
  console.error('No DATABASE_ADMIN_URL/DATABASE_POOLER_URL/DATABASE_URL in .env.local');
  process.exit(1);
}

const client = new pg.Client({ connectionString });

const STEP1 = `
SELECT conname, pg_get_constraintdef(oid) AS def
FROM pg_constraint
WHERE conname IN ('user_branches_user_id_fkey', 'user_account_access_user_id_fkey');
`;

const STEP3_BRANCHES = `
SELECT COUNT(*)::int AS c FROM public.user_branches ub
LEFT JOIN auth.users au ON au.id = ub.user_id WHERE au.id IS NULL;
`;
const STEP3_ACCOUNTS = `
SELECT COUNT(*)::int AS c FROM public.user_account_access ua
LEFT JOIN auth.users au ON au.id = ua.user_id WHERE au.id IS NULL;
`;

const STEP4 = `
BEGIN;
DELETE FROM public.user_branches ub WHERE NOT EXISTS (SELECT 1 FROM auth.users au WHERE au.id = ub.user_id);
DELETE FROM public.user_account_access ua WHERE NOT EXISTS (SELECT 1 FROM auth.users au WHERE au.id = ua.user_id);
ALTER TABLE public.user_branches DROP CONSTRAINT IF EXISTS user_branches_user_id_fkey;
ALTER TABLE public.user_account_access DROP CONSTRAINT IF EXISTS user_account_access_user_id_fkey;
ALTER TABLE public.user_branches ADD CONSTRAINT user_branches_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.user_account_access ADD CONSTRAINT user_account_access_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
COMMIT;
`;

async function run() {
  await client.connect();

  try {
    console.log('\n=== PHASE 1 — PROVE CURRENT STATE (STEP 1) ===');
    const step1 = await client.query(STEP1);
    console.log(step1.rows.length ? step1.rows : 'No rows');
    for (const r of step1.rows) {
      console.log(r.conname, '->', r.def);
    }
    const refsPublic = step1.rows.some((r) => r.def && r.def.includes('public.users'));
    if (refsPublic) console.log('ROOT CAUSE: At least one FK references public.users');

    console.log('\n=== PHASE 2 — UNLINKED PROFILES (candidates for BAD_UUID) ===');
    const unlinked = await client.query(`
      SELECT id, email, full_name, auth_user_id FROM public.users WHERE auth_user_id IS NULL
    `);
    console.log('public.users with auth_user_id NULL:', unlinked.rows.length);
    for (const u of unlinked.rows) {
      const inAuth = await client.query('SELECT id, email FROM auth.users WHERE id = $1', [u.id]);
      const inAuthByEmail = await client.query('SELECT id, email FROM auth.users WHERE email = $1', [u.email]);
      console.log('  ', u.email, '| public.id=', u.id, '| in auth by id?', inAuth.rows.length > 0, '| in auth by email?', inAuthByEmail.rows.length > 0);
    }

    console.log('\n=== PHASE 3 — ORPHAN COUNTS (STEP 3) ===');
    const orb = await client.query(STEP3_BRANCHES);
    const ora = await client.query(STEP3_ACCOUNTS);
    const countB = orb.rows[0]?.c ?? 0;
    const countA = ora.rows[0]?.c ?? 0;
    console.log('orphans_user_branches:', countB);
    console.log('orphans_user_account_access:', countA);
    if (countB > 0 || countA > 0) console.log('These block FK add to auth.users until STEP 4 runs.');

    const needFix = refsPublic || countB > 0 || countA > 0;
    if (needFix) {
      console.log('\n=== PHASE 4 — APPLY FIX (STEP 4 transaction) ===');
      await client.query(STEP4);
      console.log('STEP 4 committed.');
    } else {
      console.log('\n=== PHASE 4 — SKIP (FK already auth.users and 0 orphans) ===');
    }

    console.log('\n=== PHASE 5 — RE-VERIFY (STEP 1 again) ===');
    const step5 = await client.query(STEP1);
    for (const r of step5.rows) {
      console.log(r.conname, '->', r.def);
    }
    const bothAuth = step5.rows.length === 2 && step5.rows.every((r) => r.def && r.def.includes('auth.users'));
    console.log('Both FKs reference auth.users(id)?', bothAuth);

    const orb2 = await client.query(STEP3_BRANCHES);
    const ora2 = await client.query(STEP3_ACCOUNTS);
    console.log('Orphan counts after fix: branches=', orb2.rows[0]?.c ?? 0, 'accounts=', ora2.rows[0]?.c ?? 0);

    console.log('\n=== PHASE 6 — LINK UNLINKED USERS (where auth user exists by email) ===');
    const linkResult = await client.query(`
      UPDATE public.users p SET auth_user_id = a.id
      FROM auth.users a
      WHERE p.email = a.email AND p.auth_user_id IS NULL
      RETURNING p.id, p.email, p.auth_user_id
    `);
    console.log('Linked profiles (auth_user_id set):', linkResult.rowCount || 0);
    if (linkResult.rows?.length) for (const r of linkResult.rows) console.log('  ', r.email, r.auth_user_id);
  } finally {
    await client.end();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
