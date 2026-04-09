/**
 * Verify live Postgres definition of get_contact_balances_summary + sample RPC rows.
 * Usage: node scripts/verify-contact-balances-rpc.mjs [company_uuid]
 * Loads DATABASE_ADMIN_URL | DATABASE_POOLER_URL | DATABASE_URL from .env.local
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const envPath = path.join(root, '.env.local');

function loadEnvLocal() {
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
      v = v.slice(1, -1);
    if (!process.env[k]) process.env[k] = v;
  }
}

loadEnvLocal();
const connectionString =
  process.env.DATABASE_ADMIN_URL || process.env.DATABASE_POOLER_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.error('No DATABASE_* in .env.local');
  process.exit(1);
}

const companyId = process.argv[2] || '595c08c2-1e47-4581-89c9-1f78de51c613';

const client = new pg.Client({ connectionString });
await client.connect();

const sig = await client.query(`
  SELECT p.oid::regprocedure::text AS sig, pg_get_function_identity_arguments(p.oid) AS args
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE p.proname = 'get_contact_balances_summary' AND n.nspname = 'public'
`);
console.log('=== get_contact_balances_summary signatures ===');
console.log(JSON.stringify(sig.rows, null, 2));

const def = await client.query(`
  SELECT pg_get_functiondef(p.oid) AS def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE p.proname = 'get_contact_balances_summary'
    AND n.nspname = 'public'
    AND pg_get_function_identity_arguments(p.oid) = 'p_company_id uuid, p_branch_id uuid'
  LIMIT 1
`);
const body = def.rows[0]?.def || '';
const checks = {
  branch_null_sales: /OR s\.branch_id IS NULL/.test(body),
  payment_allocations: body.includes('payment_allocations') && body.includes('allocated_amount'),
  manual_payment_subtract: body.includes("'manual_payment'") || body.includes('manual_payment'),
  on_account_in_pay_subtract:
    body.includes('on_account') && body.includes("'paid'") && body.includes('manual_payment'),
  voided_at: body.includes('voided_at'),
};
console.log('\n=== Body heuristic checks (uuid,uuid overload) ===');
console.log(JSON.stringify(checks, null, 2));
console.log('\n=== Body length ===', body.length);

const names = ['ABC', 'Ali', 'DIN COLLECTION', 'DIN COUTURE', 'KHURAM SILK', 'SATTAR', 'Salar'];
const contacts = await client.query(
  `SELECT id, name, type, opening_balance, supplier_opening_balance
   FROM contacts WHERE company_id = $1 AND (${names.map((_, i) => `name ILIKE $${i + 2}`).join(' OR ')})
   ORDER BY name`,
  [companyId, ...names.map((n) => `%${n}%`)]
);
console.log('\n=== Matching contacts ===');
console.log(JSON.stringify(contacts.rows, null, 2));

const rpcNull = await client.query(
  `SELECT * FROM get_contact_balances_summary($1::uuid, NULL::uuid) c
   WHERE c.contact_id = ANY($2::uuid[])`,
  [companyId, contacts.rows.map((r) => r.id)]
);
const byId = new Map(rpcNull.rows.map((r) => [r.contact_id, r]));
console.log('\n=== RPC branch NULL ===');
for (const row of contacts.rows) {
  const r = byId.get(row.id);
  console.log(row.name, row.type, 'recv', r?.receivables, 'pay', r?.payables);
}

await client.end();
console.log('\nDone.');
