/**
 * Restore company backup JSON via restore_company_backup_rpc (service role).
 * Usage: node scripts/restore_company_backup_from_file.mjs /path/to/backup.json
 * Env: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local (same as manual_restore_drill.ts).
 *
 * Optional: DATABASE_ADMIN_URL (or DATABASE_URL) — if HTTP RPC returns auth errors, pass --via-pg
 * to run SELECT restore_company_backup_rpc(...) in Postgres after set_config(role, service_role).
 */
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const fileArg = process.argv.filter((a) => !a.startsWith('--')).slice(2)[0];
const viaPg = process.argv.includes('--via-pg');

if (!fileArg) {
  console.error(
    'Usage: node scripts/restore_company_backup_from_file.mjs /path/to/backup.json [--via-pg]'
  );
  process.exit(1);
}

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

function jwtPayloadRole(jwt) {
  try {
    const parts = jwt.split('.');
    if (parts.length < 2) return null;
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = Buffer.from(b64, 'base64').toString('utf8');
    const payload = JSON.parse(json);
    return payload.role || null;
  } catch {
    return null;
  }
}

const jwtRole = jwtPayloadRole(SUPABASE_SERVICE_ROLE_KEY);
if (jwtRole !== 'service_role') {
  console.error(
    `JWT role must be "service_role" (got ${jwtRole === null ? 'decode failed' : `"${jwtRole}"`}). Use SUPABASE_SERVICE_ROLE_KEY from Supabase Dashboard → Settings → API.`
  );
  process.exit(1);
}

const abs = path.resolve(fileArg);
const raw = fs.readFileSync(abs, 'utf8');
let backup;
try {
  backup = JSON.parse(raw);
} catch (e) {
  console.error('Invalid JSON:', e.message);
  process.exit(1);
}

const companyId = backup?.meta?.company_id;
if (!companyId) {
  console.error('Backup missing meta.company_id');
  process.exit(1);
}

console.log(`Restoring backup for company_id=${companyId} from ${abs}`);

async function rpcViaFetch() {
  const url = `${SUPABASE_URL}/rest/v1/rpc/restore_company_backup_rpc`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({
      p_company_id: companyId,
      p_backup: backup,
      p_confirmation: 'RESTORE',
    }),
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    console.error('Non-JSON response:', text.slice(0, 500));
    process.exit(1);
  }
  if (!res.ok) {
    console.error('HTTP', res.status, data || text);
    process.exit(1);
  }
  return data;
}

async function rpcViaPg() {
  const conn =
    process.env.DATABASE_ADMIN_URL ||
    process.env.DATABASE_POOLER_URL ||
    process.env.DATABASE_URL;
  if (!conn) {
    console.error('Missing DATABASE_ADMIN_URL / DATABASE_POOLER_URL / DATABASE_URL for --via-pg');
    process.exit(1);
  }
  const client = new pg.Client({ connectionString: conn });
  await client.connect();
  try {
    await client.query(`select set_config('request.jwt.claim.role', 'service_role', true)`);
    const r = await client.query(
      `select public.restore_company_backup_rpc($1::uuid, $2::jsonb, $3::text) as payload`,
      [companyId, backup, 'RESTORE']
    );
    return r.rows[0]?.payload;
  } finally {
    await client.end();
  }
}

const payload = viaPg ? await rpcViaPg() : await rpcViaFetch();

if (!payload || typeof payload !== 'object') {
  console.error('Unexpected RPC result:', payload);
  process.exit(1);
}

if (!payload.success) {
  console.error('Restore failed:', payload.error || 'unknown');
  process.exit(1);
}

console.log('Restore OK:', JSON.stringify(payload.restored || {}, null, 2));
