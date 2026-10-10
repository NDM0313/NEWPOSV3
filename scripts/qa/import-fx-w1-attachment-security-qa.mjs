/**
 * W1 Import FX attachment security QA (localhost only).
 * Usage: node scripts/qa/import-fx-w1-attachment-security-qa.mjs
 */
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { URL } from 'url';
import { randomUUID } from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');

function loadEnvDbLocal() {
  const envPath = path.join(root, '.env.db.local');
  const out = {};
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#') || !t.includes('=')) continue;
    const i = t.indexOf('=');
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^['"]|['"]$/g, '');
  }
  return out;
}

const env = loadEnvDbLocal();
const connectionString = env.DATABASE_ADMIN_URL || env.DIRECT_URL || env.DATABASE_URL;
const u = new URL(connectionString);
const host = u.hostname;
const port = u.port || '5432';
const db = (u.pathname || '/postgres').replace(/^\//, '') || 'postgres';
console.log(`[ATT-QA] host=${host} port=${port} db=${db}`);
if (!['localhost', '127.0.0.1'].includes(host)) {
  console.error('ABORT non-local host');
  process.exit(2);
}
if (String(connectionString).includes('dincouture') || String(connectionString).includes('72.62')) {
  console.error('ABORT production marker');
  process.exit(2);
}

const client = new pg.Client({ connectionString });
await client.connect();

const results = [];
function ok(name, detail = '') {
  results.push({ name, pass: true, status: 'PASS', detail });
  console.log('PASS', name, detail);
}
function fail(name, detail = '') {
  results.push({ name, pass: false, status: 'FAIL', detail });
  console.error('FAIL', name, detail);
}

async function counts() {
  const q = async (sql) => Number((await client.query(sql)).rows[0].c);
  return {
    je: await q('SELECT count(*)::int AS c FROM journal_entries'),
    jel: await q('SELECT count(*)::int AS c FROM journal_entry_lines'),
    pay: await q('SELECT count(*)::int AS c FROM payments'),
  };
}

async function setSession({ companyId = null, userId = null, role = 'user' } = {}) {
  await client.query(`SELECT set_config('app.company_id', $1, false)`, [companyId ?? '']);
  await client.query(`SELECT set_config('app.user_id', $1, false)`, [userId ?? '']);
  await client.query(`SELECT set_config('app.user_role', $1, false)`, [role ?? 'user']);
}

function isDenied(err) {
  const m = String(err.message);
  return (
    m.includes('permission denied') ||
    m.includes('COMPANY_MISMATCH') ||
    m.includes('AUTH_COMPANY_REQUIRED') ||
    m.includes('BRANCH_ACCESS_DENIED') ||
    m.includes('MULTI_CURRENCY_DISABLED') ||
    m.includes('new row violates row-level security') ||
    m.includes('violates row-level security')
  );
}

const companyA = randomUUID();
const companyB = randomUUID();
const branchA1 = randomUUID();
const branchA2 = randomUUID();
const userRestricted = randomUUID();
const userAdmin = randomUUID();

await client.query(`INSERT INTO companies (id, name) VALUES ($1,'ATT Co A'), ($2,'ATT Co B')`, [
  companyA,
  companyB,
]);
await client.query(
  `INSERT INTO branches (id, company_id, name) VALUES ($1,$2,'A1'), ($3,$2,'A2')`,
  [branchA1, companyA, branchA2]
);
await client.query(
  `INSERT INTO settings (company_id, key, value) VALUES
   ($1,'accounting_settings', '{"multiCurrencyEnabled":true,"fxSettlementAccountingEnabled":false}'::jsonb),
   ($2,'accounting_settings', '{"multiCurrencyEnabled":true,"fxSettlementAccountingEnabled":false}'::jsonb)`,
  [companyA, companyB]
);
await client.query(
  `INSERT INTO users (id, auth_user_id, company_id, role) VALUES ($1,$1,$3,'user'), ($2,$2,$3,'admin')`,
  [userRestricted, userAdmin, companyA]
);
await client.query(
  `INSERT INTO user_branches (user_id, branch_id, is_default) VALUES ($1,$2,true)`,
  [userRestricted, branchA1]
);

const before = await counts();
console.log('[ATT-QA] before', before);

await setSession({ companyId: companyA, userId: userAdmin, role: 'admin' });
const caseA1 = (
  await client.query(
    `SELECT create_import_fx_case($1,$2,'POOLED_USD_CNY',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'att-a1',NULL,$3) AS j`,
    [companyA, branchA1, randomUUID()]
  )
).rows[0].j.case_id;
const caseA2 = (
  await client.query(
    `SELECT create_import_fx_case($1,$2,'POOLED_USD_CNY',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'att-a2',NULL,$3) AS j`,
    [companyA, branchA2, randomUUID()]
  )
).rows[0].j.case_id;
const caseNull = (
  await client.query(
    `SELECT create_import_fx_case($1,NULL,'POOLED_USD_CNY',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'att-null',NULL,$2) AS j`,
    [companyA, randomUUID()]
  )
).rows[0].j.case_id;

const attA1 = randomUUID();
const attA2 = randomUUID();
const attNull = randomUUID();
await client.query(
  `INSERT INTO import_fx_case_attachments
   (id, company_id, case_id, storage_path, file_name, mime_type, file_size)
   VALUES
   ($1,$4,$5,'private/a1/secret.bin','a1.pdf','application/pdf',10),
   ($2,$4,$6,'private/a2/secret.bin','a2.pdf','application/pdf',20),
   ($3,$4,$7,'private/null/secret.bin','null.pdf','application/pdf',30)`,
  [attA1, attA2, attNull, companyA, caseA1, caseA2, caseNull]
);

// Privilege inventory
const grants = await client.query(
  `SELECT grantee, privilege_type FROM information_schema.role_table_grants
   WHERE table_schema='public' AND table_name='import_fx_case_attachments'
     AND grantee IN ('PUBLIC','anon','authenticated','service_role')
   ORDER BY 1,2`
);
console.log('[ATT-QA] client grants', grants.rows);

// 1 Authorized company attachment read (via get RPC)
await setSession({ companyId: companyA, userId: userAdmin, role: 'admin' });
try {
  const got = (await client.query(`SELECT get_import_fx_case($1,$2) AS j`, [companyA, caseA1])).rows[0]
    .j;
  const atts = got.attachments || [];
  if (got.ok && atts.some((a) => a.id === attA1) && atts.every((a) => a.storage_path === undefined)) {
    ok('1 authorized company attachment read', `n=${atts.length}`);
  } else fail('1 authorized company attachment read', JSON.stringify(got));
} catch (e) {
  fail('1 authorized company attachment read', e.message);
}

// 2 Cross-company attachment read denied
await setSession({ companyId: companyB, userId: userAdmin, role: 'admin' });
try {
  await client.query(`SELECT get_import_fx_case($1,$2)`, [companyA, caseA1]);
  fail('2 cross-company attachment read denied', 'expected COMPANY_MISMATCH');
} catch (e) {
  if (String(e.message).includes('COMPANY_MISMATCH')) ok('2 cross-company attachment read denied');
  else fail('2 cross-company attachment read denied', e.message);
}

// 3 Authorized branch attachment read
await setSession({ companyId: companyA, userId: userRestricted, role: 'user' });
try {
  const got = (await client.query(`SELECT get_import_fx_case($1,$2) AS j`, [companyA, caseA1])).rows[0]
    .j;
  if (got.ok && (got.attachments || []).some((a) => a.id === attA1)) {
    ok('3 authorized branch attachment read');
  } else fail('3 authorized branch attachment read', JSON.stringify(got));
} catch (e) {
  fail('3 authorized branch attachment read', e.message);
}

// 4 Unauthorized branch attachment read denied
try {
  await client.query(`SELECT get_import_fx_case($1,$2)`, [companyA, caseA2]);
  fail('4 unauthorized branch attachment read denied', 'expected BRANCH_ACCESS_DENIED');
} catch (e) {
  if (String(e.message).includes('BRANCH_ACCESS_DENIED')) {
    ok('4 unauthorized branch attachment read denied');
  } else fail('4 unauthorized branch attachment read denied', e.message);
}

// 5 NULL branch follows canonical policy (visible to restricted user)
try {
  const got = (await client.query(`SELECT get_import_fx_case($1,$2) AS j`, [companyA, caseNull]))
    .rows[0].j;
  if (got.ok && (got.attachments || []).some((a) => a.id === attNull)) {
    ok('5 NULL branch attachment read per canonical policy');
  } else fail('5 NULL branch attachment read per canonical policy', JSON.stringify(got));
} catch (e) {
  fail('5 NULL branch attachment read per canonical policy', e.message);
}

// 6 Anonymous access denied
await setSession({ companyId: companyA, userId: userAdmin, role: 'admin' });
try {
  await client.query('BEGIN');
  await client.query('SET LOCAL ROLE anon');
  await client.query(`SELECT id FROM import_fx_case_attachments LIMIT 1`);
  await client.query('ROLLBACK');
  fail('6 anonymous access denied', 'expected permission denied');
} catch (e) {
  await client.query('ROLLBACK').catch(() => {});
  if (isDenied(e)) ok('6 anonymous access denied');
  else fail('6 anonymous access denied', e.message);
}

// 7 PUBLIC access denied (privilege probe)
const pubPriv = await client.query(
  `SELECT has_table_privilege('anon', 'public.import_fx_case_attachments', 'SELECT') AS anon_sel,
          has_table_privilege('public', 'public.import_fx_case_attachments', 'SELECT') AS public_sel,
          has_table_privilege('authenticated', 'public.import_fx_case_attachments', 'SELECT') AS auth_sel,
          has_table_privilege('authenticated', 'public.import_fx_case_attachments', 'INSERT') AS auth_ins`
);
if (
  !pubPriv.rows[0].anon_sel &&
  !pubPriv.rows[0].public_sel &&
  !pubPriv.rows[0].auth_sel &&
  !pubPriv.rows[0].auth_ins
) {
  ok('7 PUBLIC/anon/authenticated direct privileges denied');
} else fail('7 PUBLIC/anon/authenticated direct privileges denied', JSON.stringify(pubPriv.rows[0]));

// 8 Unauthorized direct INSERT denied
try {
  await client.query('BEGIN');
  await client.query('SET LOCAL ROLE authenticated');
  await setSession({ companyId: companyA, userId: userAdmin, role: 'admin' });
  await client.query(
    `INSERT INTO import_fx_case_attachments (company_id, case_id, storage_path)
     VALUES ($1,$2,'x')`,
    [companyA, caseA1]
  );
  await client.query('ROLLBACK');
  fail('8 unauthorized direct INSERT denied', 'expected permission denied');
} catch (e) {
  await client.query('ROLLBACK').catch(() => {});
  if (isDenied(e)) ok('8 unauthorized direct INSERT denied');
  else fail('8 unauthorized direct INSERT denied', e.message);
}

// Temporarily grant table DML to prove RLS parent-case / branch / MC gates
await client.query(
  `GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_fx_case_attachments TO authenticated`
);
await client.query(
  `GRANT EXECUTE ON FUNCTION public._import_fx_case_attachment_parent_access_ok(uuid,uuid) TO authenticated`
);
await client.query(
  `GRANT EXECUTE ON FUNCTION public._import_fx_case_attachment_mutation_ok(uuid,uuid) TO authenticated`
);

// 9 Cross-company case_id INSERT denied (RLS)
try {
  await client.query('BEGIN');
  await client.query('SET LOCAL ROLE authenticated');
  await setSession({ companyId: companyB, userId: userAdmin, role: 'admin' });
  await client.query(
    `INSERT INTO import_fx_case_attachments (company_id, case_id, storage_path)
     VALUES ($1,$2,'cross')`,
    [companyA, caseA1]
  );
  await client.query('ROLLBACK');
  fail('9 cross-company case_id INSERT denied', 'expected RLS deny');
} catch (e) {
  await client.query('ROLLBACK').catch(() => {});
  if (isDenied(e)) ok('9 cross-company case_id INSERT denied');
  else fail('9 cross-company case_id INSERT denied', e.message);
}

// 10 Cross-branch case_id INSERT denied
try {
  await client.query('BEGIN');
  await client.query('SET LOCAL ROLE authenticated');
  await setSession({ companyId: companyA, userId: userRestricted, role: 'user' });
  await client.query(
    `INSERT INTO import_fx_case_attachments (company_id, case_id, storage_path)
     VALUES ($1,$2,'branch-x')`,
    [companyA, caseA2]
  );
  await client.query('ROLLBACK');
  fail('10 cross-branch case_id INSERT denied', 'expected RLS deny');
} catch (e) {
  await client.query('ROLLBACK').catch(() => {});
  if (isDenied(e)) ok('10 cross-branch case_id INSERT denied');
  else fail('10 cross-branch case_id INSERT denied', e.message);
}

// 11 Reassign attachment to unauthorized case denied
try {
  await client.query('BEGIN');
  await client.query('SET LOCAL ROLE authenticated');
  await setSession({ companyId: companyA, userId: userRestricted, role: 'user' });
  await client.query(`UPDATE import_fx_case_attachments SET case_id=$1 WHERE id=$2`, [
    caseA2,
    attA1,
  ]);
  const moved = await client.query(
    `SELECT case_id FROM import_fx_case_attachments WHERE id=$1`,
    [attA1]
  );
  await client.query('ROLLBACK');
  if (moved.rowCount === 0 || moved.rows[0].case_id === caseA2) {
    fail('11 reassign to unauthorized case denied', JSON.stringify(moved.rows));
  } else {
    ok('11 reassign to unauthorized case denied', 'no unauthorized move');
  }
} catch (e) {
  await client.query('ROLLBACK').catch(() => {});
  if (isDenied(e)) ok('11 reassign to unauthorized case denied');
  else fail('11 reassign to unauthorized case denied', e.message);
}

// 12 Unauthorized DELETE denied
try {
  await client.query('BEGIN');
  await client.query('SET LOCAL ROLE authenticated');
  await setSession({ companyId: companyA, userId: userRestricted, role: 'user' });
  const del = await client.query(`DELETE FROM import_fx_case_attachments WHERE id=$1`, [attA2]);
  await client.query('RESET ROLE');
  const left = await client.query(`SELECT 1 FROM import_fx_case_attachments WHERE id=$1`, [attA2]);
  await client.query('ROLLBACK');
  if (del.rowCount === 0 && left.rowCount === 1) {
    ok('12 unauthorized DELETE denied', '0 rows deleted; retained');
  } else fail('12 unauthorized DELETE denied', `deleted=${del.rowCount} left=${left.rowCount}`);
} catch (e) {
  await client.query('ROLLBACK').catch(() => {});
  if (isDenied(e)) ok('12 unauthorized DELETE denied');
  else fail('12 unauthorized DELETE denied', e.message);
}

// Restore revoked privileges (W1 contract)
await client.query(`RESET ROLE`).catch(() => {});
await client.query(
  `REVOKE ALL ON TABLE public.import_fx_case_attachments FROM authenticated`
);
await client.query(
  `REVOKE ALL ON FUNCTION public._import_fx_case_attachment_parent_access_ok(uuid,uuid) FROM authenticated`
);
await client.query(
  `REVOKE ALL ON FUNCTION public._import_fx_case_attachment_mutation_ok(uuid,uuid) FROM authenticated`
);

// 13 MC OFF historical attachment read
await setSession({ companyId: companyA, userId: userAdmin, role: 'admin' });
await client.query(
  `UPDATE settings SET value = jsonb_set(value, '{multiCurrencyEnabled}', 'false'::jsonb)
   WHERE company_id=$1 AND key='accounting_settings'`,
  [companyA]
);
try {
  const got = (await client.query(`SELECT get_import_fx_case($1,$2) AS j`, [companyA, caseA1])).rows[0]
    .j;
  if (got.ok && got.read_only === true && (got.attachments || []).some((a) => a.id === attA1)) {
    ok('13 OFF historical attachment read');
  } else fail('13 OFF historical attachment read', JSON.stringify(got));
} catch (e) {
  fail('13 OFF historical attachment read', e.message);
}

// 14 OFF attachment mutation denied (direct privileges remain revoked)
try {
  await client.query('BEGIN');
  await client.query('SET LOCAL ROLE authenticated');
  await setSession({ companyId: companyA, userId: userAdmin, role: 'admin' });
  await client.query(
    `INSERT INTO import_fx_case_attachments (company_id, case_id, storage_path)
     VALUES ($1,$2,'off-mut')`,
    [companyA, caseA1]
  );
  await client.query('ROLLBACK');
  fail('14 OFF attachment mutation denied', 'expected permission denied');
} catch (e) {
  await client.query('ROLLBACK').catch(() => {});
  if (isDenied(e)) ok('14 OFF attachment mutation denied');
  else fail('14 OFF attachment mutation denied', e.message);
}

// Also prove RLS mutation gate if privileges restored while OFF
await client.query(
  `GRANT INSERT ON public.import_fx_case_attachments TO authenticated`
);
await client.query(
  `GRANT EXECUTE ON FUNCTION public._import_fx_case_attachment_mutation_ok(uuid,uuid) TO authenticated`
);
try {
  await client.query('BEGIN');
  await client.query('SET LOCAL ROLE authenticated');
  await setSession({ companyId: companyA, userId: userAdmin, role: 'admin' });
  await client.query(
    `INSERT INTO import_fx_case_attachments (company_id, case_id, storage_path)
     VALUES ($1,$2,'off-rls')`,
    [companyA, caseA1]
  );
  await client.query('ROLLBACK');
  fail('14b OFF mutation RLS denied', 'expected RLS deny');
} catch (e) {
  await client.query('ROLLBACK').catch(() => {});
  if (isDenied(e)) ok('14b OFF mutation RLS denied (defense-in-depth)');
  else fail('14b OFF mutation RLS denied', e.message);
}
await client.query(`RESET ROLE`).catch(() => {});
await client.query(`REVOKE ALL ON TABLE public.import_fx_case_attachments FROM authenticated`);
await client.query(
  `REVOKE ALL ON FUNCTION public._import_fx_case_attachment_mutation_ok(uuid,uuid) FROM authenticated`
);

// 15 get-case omits storage_path
await client.query(
  `UPDATE settings SET value = jsonb_set(value, '{multiCurrencyEnabled}', 'true'::jsonb)
   WHERE company_id=$1 AND key='accounting_settings'`,
  [companyA]
);
await setSession({ companyId: companyA, userId: userAdmin, role: 'admin' });
try {
  const got = (await client.query(`SELECT get_import_fx_case($1,$2) AS j`, [companyA, caseA1])).rows[0]
    .j;
  const raw = JSON.stringify(got.attachments || []);
  if (!raw.includes('storage_path') && !raw.includes('private/a1')) {
    ok('15 get-case omits storage_path');
  } else fail('15 get-case omits storage_path', raw);
} catch (e) {
  fail('15 get-case omits storage_path', e.message);
}

const after = await counts();
console.log('[ATT-QA] after', after);
const delta = {
  je: after.je - before.je,
  jel: after.jel - before.jel,
  pay: after.pay - before.pay,
};
if (delta.je === 0) ok('16 JE delta 0', JSON.stringify({ before: before.je, after: after.je }));
else fail('16 JE delta 0', JSON.stringify({ before, after, delta }));
if (delta.jel === 0)
  ok('17 journal-line delta 0', JSON.stringify({ before: before.jel, after: after.jel }));
else fail('17 journal-line delta 0', JSON.stringify({ before, after, delta }));
if (delta.pay === 0) ok('18 payment delta 0', JSON.stringify({ before: before.pay, after: after.pay }));
else fail('18 payment delta 0', JSON.stringify({ before, after, delta }));

await client.end();

const failed = results.filter((r) => r.status === 'FAIL');
const skipped = results.filter((r) => r.status === 'SKIPPED');
console.log('\n=== ATTACHMENT SECURITY QA SUMMARY ===');
console.log(
  `pass=${results.filter((r) => r.status === 'PASS').length} fail=${failed.length} skipped=${skipped.length}`
);
console.log('DB identity:', { host, port, db, production: false });
if (failed.length || skipped.length) {
  for (const f of failed) console.log('- FAIL', f.name, f.detail);
  for (const s of skipped) console.log('- SKIPPED', s.name, s.detail);
  process.exit(1);
}
process.exit(0);
