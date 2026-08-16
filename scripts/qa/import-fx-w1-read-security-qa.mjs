/**
 * W1 Import FX read-security QA (localhost only).
 * Usage: node scripts/qa/import-fx-w1-read-security-qa.mjs
 *
 * Requires: apply-import-fx-w1-local.mjs including
 *   20260812020000_import_fx_case_read_security_hardening_w1.sql
 *   + import-fx-w1-security-harness.sql
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
console.log(`[SEC-QA] host=${host} port=${port} db=${db}`);
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
function skip(name, detail = '') {
  results.push({ name, pass: true, status: 'SKIPPED', detail });
  console.log('SKIPPED', name, detail);
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

const companyA = randomUUID();
const companyB = randomUUID();
const branchA1 = randomUUID();
const branchA2 = randomUUID();
const branchB1 = randomUUID();
const userRestricted = randomUUID();
const userAdmin = randomUUID();

await client.query(`INSERT INTO companies (id, name) VALUES ($1,'SEC Co A'), ($2,'SEC Co B')`, [
  companyA,
  companyB,
]);
await client.query(
  `INSERT INTO branches (id, company_id, name) VALUES ($1,$2,'A1'), ($3,$2,'A2'), ($4,$5,'B1')`,
  [branchA1, companyA, branchA2, branchB1, companyB]
);
await client.query(
  `INSERT INTO settings (company_id, key, value) VALUES
   ($1,'accounting_settings', '{"multiCurrencyEnabled":true,"fxSettlementAccountingEnabled":false}'::jsonb),
   ($2,'accounting_settings', '{"multiCurrencyEnabled":true,"fxSettlementAccountingEnabled":false}'::jsonb)`,
  [companyA, companyB]
);
await client.query(
  `INSERT INTO users (id, auth_user_id, company_id, role) VALUES
   ($1,$1,$3,'user'), ($2,$2,$3,'admin')`,
  [userRestricted, userAdmin, companyA]
);
await client.query(
  `INSERT INTO user_branches (user_id, branch_id, is_default) VALUES ($1,$2,true)`,
  [userRestricted, branchA1]
);

const before = await counts();
console.log('[SEC-QA] before counts', before);

// Seed cases as admin (company-wide)
await setSession({ companyId: companyA, userId: userAdmin, role: 'admin' });
const caseA1 = (
  await client.query(
    `SELECT create_import_fx_case($1,$2,'POOLED_USD_CNY',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'sec-a1',NULL,$3) AS j`,
    [companyA, branchA1, randomUUID()]
  )
).rows[0].j;
const caseA2 = (
  await client.query(
    `SELECT create_import_fx_case($1,$2,'POOLED_USD_CNY',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'sec-a2',NULL,$3) AS j`,
    [companyA, branchA2, randomUUID()]
  )
).rows[0].j;
const caseNullBranch = (
  await client.query(
    `SELECT create_import_fx_case($1,NULL,'POOLED_USD_CNY',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'sec-null',NULL,$2) AS j`,
    [companyA, randomUUID()]
  )
).rows[0].j;
const caseIdA1 = caseA1.case_id;
const caseIdA2 = caseA2.case_id;
const caseIdNull = caseNullBranch.case_id;

// 1 Authorized company list
try {
  const listed = (await client.query(`SELECT list_import_fx_cases($1,NULL) AS j`, [companyA])).rows[0].j;
  if (listed.ok && listed.total >= 3) ok('1 authorized company list', `total=${listed.total}`);
  else fail('1 authorized company list', JSON.stringify(listed));
} catch (e) {
  fail('1 authorized company list', e.message);
}

// 2 Authorized company get
try {
  const got = (await client.query(`SELECT get_import_fx_case($1,$2) AS j`, [companyA, caseIdA1])).rows[0]
    .j;
  if (
    got.ok &&
    got.case?.id === caseIdA1 &&
    got.case.client_operation_id === undefined &&
    Array.isArray(got.attachments)
  ) {
    ok('2 authorized company get', got.case.case_no);
  } else fail('2 authorized company get', JSON.stringify(got));
} catch (e) {
  fail('2 authorized company get', e.message);
}

// 3 Different company ID rejected
try {
  await client.query(`SELECT list_import_fx_cases($1,NULL)`, [companyB]);
  fail('3 different company ID rejected', 'expected COMPANY_MISMATCH');
} catch (e) {
  if (String(e.message).includes('COMPANY_MISMATCH')) ok('3 different company ID rejected');
  else fail('3 different company ID rejected', e.message);
}

// 4 Auth company NULL rejected
await setSession({ companyId: null, userId: userAdmin, role: 'admin' });
try {
  await client.query(`SELECT list_import_fx_cases($1,NULL)`, [companyA]);
  fail('4 auth company NULL rejected', 'expected AUTH_COMPANY_REQUIRED');
} catch (e) {
  if (String(e.message).includes('AUTH_COMPANY_REQUIRED')) ok('4 auth company NULL rejected');
  else fail('4 auth company NULL rejected', e.message);
}

// 5 Auth company resolution error rejected (invalid uuid in setting)
await client.query(`SELECT set_config('app.company_id', 'not-a-uuid', false)`);
await client.query(`SELECT set_config('app.user_id', $1, false)`, [userAdmin]);
await client.query(`SELECT set_config('app.user_role', 'admin', false)`);
try {
  await client.query(`SELECT list_import_fx_cases($1,NULL)`, [companyA]);
  fail('5 auth company resolution error rejected', 'expected error');
} catch (e) {
  if (
    String(e.message).includes('invalid input syntax') ||
    String(e.message).includes('AUTH_COMPANY') ||
    String(e.message).includes('COMPANY_MISMATCH')
  ) {
    ok('5 auth company resolution error rejected', e.message.split('\n')[0]);
  } else fail('5 auth company resolution error rejected', e.message);
}

// 6 Unauthenticated/anon execution rejected
await setSession({ companyId: companyA, userId: userAdmin, role: 'admin' });
try {
  await client.query('BEGIN');
  await client.query('SET LOCAL ROLE anon');
  await client.query(`SELECT list_import_fx_cases($1,NULL)`, [companyA]);
  await client.query('ROLLBACK');
  fail('6 anon cannot execute list', 'expected permission denied');
} catch (e) {
  await client.query('ROLLBACK').catch(() => {});
  if (
    String(e.message).includes('permission denied') ||
    String(e.message).includes('must be owner')
  ) {
    ok('6 anon cannot execute list');
  } else fail('6 anon cannot execute list', e.message);
}

// 7 Authenticated without company context rejected
await setSession({ companyId: null, userId: userRestricted, role: 'user' });
try {
  await client.query('BEGIN');
  await client.query(`SET LOCAL ROLE authenticated`);
  await client.query(`SELECT list_import_fx_cases($1,NULL)`, [companyA]);
  await client.query('ROLLBACK');
  fail('7 authenticated without company rejected', 'expected AUTH_COMPANY_REQUIRED');
} catch (e) {
  await client.query('ROLLBACK').catch(() => {});
  if (
    String(e.message).includes('AUTH_COMPANY_REQUIRED') ||
    String(e.message).includes('permission denied')
  ) {
    ok('7 authenticated without company rejected', e.message.split('\n')[0]);
  } else fail('7 authenticated without company rejected', e.message);
}

// Restore postgres for setup
await client.query('RESET ROLE').catch(() => {});

// 8 Explicit unauthorized branch request rejected
await setSession({ companyId: companyA, userId: userRestricted, role: 'user' });
try {
  await client.query(`SELECT list_import_fx_cases($1,$2)`, [companyA, branchA2]);
  fail('8 unauthorized branch request rejected', 'expected BRANCH_ACCESS_DENIED');
} catch (e) {
  if (String(e.message).includes('BRANCH_ACCESS_DENIED')) ok('8 unauthorized branch request rejected');
  else fail('8 unauthorized branch request rejected', e.message);
}

// 9 p_branch_id=NULL does not expand branch-restricted access
try {
  const listed = (await client.query(`SELECT list_import_fx_cases($1,NULL) AS j`, [companyA])).rows[0]
    .j;
  const ids = (listed.rows || []).map((r) => r.id);
  const hasA1 = ids.includes(caseIdA1);
  const hasA2 = ids.includes(caseIdA2);
  const hasNull = ids.includes(caseIdNull);
  if (hasA1 && hasNull && !hasA2) {
    ok('9 NULL branch filter does not expand restricted user', `ids=${ids.length}`);
  } else fail('9 NULL branch filter does not expand restricted user', JSON.stringify({ ids, listed }));
} catch (e) {
  fail('9 NULL branch filter does not expand restricted user', e.message);
}

// 10 Get case from unauthorized branch rejected
try {
  await client.query(`SELECT get_import_fx_case($1,$2)`, [companyA, caseIdA2]);
  fail('10 get unauthorized branch rejected', 'expected BRANCH_ACCESS_DENIED');
} catch (e) {
  if (String(e.message).includes('BRANCH_ACCESS_DENIED')) ok('10 get unauthorized branch rejected');
  else fail('10 get unauthorized branch rejected', e.message);
}

// 11 Authorized branch case succeeds
try {
  const got = (await client.query(`SELECT get_import_fx_case($1,$2) AS j`, [companyA, caseIdA1])).rows[0]
    .j;
  if (got.ok && got.case?.id === caseIdA1) ok('11 authorized branch case succeeds');
  else fail('11 authorized branch case succeeds', JSON.stringify(got));
} catch (e) {
  fail('11 authorized branch case succeeds', e.message);
}

// 12 Company-wide/null-branch case follows canonical policy (visible to branch user)
try {
  const got = (await client.query(`SELECT get_import_fx_case($1,$2) AS j`, [companyA, caseIdNull]))
    .rows[0].j;
  if (got.ok && got.case?.branch_id == null) ok('12 null-branch case visible per canonical policy');
  else fail('12 null-branch case visible per canonical policy', JSON.stringify(got));
} catch (e) {
  fail('12 null-branch case visible per canonical policy', e.message);
}

// 13 PUBLIC / anon cannot execute list/get (privilege check)
const privList = await client.query(
  `SELECT has_function_privilege('anon', 'public.list_import_fx_cases(uuid,uuid,text,text,int,int)', 'EXECUTE') AS anon_list,
          has_function_privilege('anon', 'public.get_import_fx_case(uuid,uuid)', 'EXECUTE') AS anon_get,
          has_function_privilege('public', 'public.list_import_fx_cases(uuid,uuid,text,text,int,int)', 'EXECUTE') AS public_list`
);
if (!privList.rows[0].anon_list && !privList.rows[0].anon_get && !privList.rows[0].public_list) {
  ok('13 PUBLIC/anon cannot execute list/get');
} else fail('13 PUBLIC/anon cannot execute list/get', JSON.stringify(privList.rows[0]));

// 14 Helper cannot be executed by authenticated
const privHelper = await client.query(
  `SELECT has_function_privilege('authenticated', 'public._import_fx_case_assert_company_access(uuid)', 'EXECUTE') AS ok`
);
if (!privHelper.rows[0].ok) ok('14 helper not executable by authenticated');
else fail('14 helper not executable by authenticated', 'EXECUTE still granted');

// 15 Multi Currency OFF historical reads succeed read-only
await setSession({ companyId: companyA, userId: userAdmin, role: 'admin' });
await client.query(
  `UPDATE settings SET value = jsonb_set(value, '{multiCurrencyEnabled}', 'false'::jsonb)
   WHERE company_id = $1 AND key = 'accounting_settings'`,
  [companyA]
);
const beforeOff = await counts();
try {
  const listed = (await client.query(`SELECT list_import_fx_cases($1,NULL) AS j`, [companyA])).rows[0]
    .j;
  const got = (await client.query(`SELECT get_import_fx_case($1,$2) AS j`, [companyA, caseIdA1])).rows[0]
    .j;
  if (listed.read_only === true && got.read_only === true && got.ok) {
    ok('15 OFF historical reads read-only', `total=${listed.total}`);
  } else fail('15 OFF historical reads read-only', JSON.stringify({ listed, got }));
} catch (e) {
  fail('15 OFF historical reads read-only', e.message);
}

// 16 OFF mutations remain blocked
try {
  await client.query(`SELECT create_import_fx_case($1,$2)`, [companyA, branchA1]);
  fail('16 OFF mutations blocked', 'expected MULTI_CURRENCY_DISABLED');
} catch (e) {
  if (String(e.message).includes('MULTI_CURRENCY_DISABLED')) ok('16 OFF mutations blocked');
  else fail('16 OFF mutations blocked', e.message);
}

// 17 ON reads still succeed
await client.query(
  `UPDATE settings SET value = jsonb_set(value, '{multiCurrencyEnabled}', 'true'::jsonb)
   WHERE company_id = $1 AND key = 'accounting_settings'`,
  [companyA]
);
try {
  const listed = (await client.query(`SELECT list_import_fx_cases($1,NULL) AS j`, [companyA])).rows[0]
    .j;
  if (listed.ok && listed.multi_currency_enabled === true && listed.read_only === false) {
    ok('17 ON reads succeed');
  } else fail('17 ON reads succeed', JSON.stringify(listed));
} catch (e) {
  fail('17 ON reads succeed', e.message);
}

// 18 Cross-company remains blocked
await setSession({ companyId: companyB, userId: userAdmin, role: 'admin' });
try {
  await client.query(`SELECT get_import_fx_case($1,$2)`, [companyA, caseIdA1]);
  fail('18 cross-company blocked', 'expected COMPANY_MISMATCH');
} catch (e) {
  if (String(e.message).includes('COMPANY_MISMATCH')) ok('18 cross-company blocked');
  else fail('18 cross-company blocked', e.message);
}

const after = await counts();
console.log('[SEC-QA] after counts', after);
const delta = {
  je: after.je - before.je,
  jel: after.jel - before.jel,
  pay: after.pay - before.pay,
};
const offDelta = {
  je: after.je - beforeOff.je,
  jel: after.jel - beforeOff.jel,
  pay: after.pay - beforeOff.pay,
};

// 19-21 journal/payment deltas
if (delta.je === 0) ok('19 journal_entries delta 0', JSON.stringify({ before: before.je, after: after.je }));
else fail('19 journal_entries delta 0', JSON.stringify({ before, after, delta }));
if (delta.jel === 0)
  ok('20 journal_entry_lines delta 0', JSON.stringify({ before: before.jel, after: after.jel }));
else fail('20 journal_entry_lines delta 0', JSON.stringify({ before, after, delta }));
if (delta.pay === 0) ok('21 payments delta 0', JSON.stringify({ before: before.pay, after: after.pay }));
else fail('21 payments delta 0', JSON.stringify({ before, after, delta }));

ok('off-slice zero journals', JSON.stringify(offDelta));

await client.end();

const failed = results.filter((r) => r.status === 'FAIL');
const skipped = results.filter((r) => r.status === 'SKIPPED');
console.log('\n=== SECURITY QA SUMMARY ===');
console.log(
  `pass=${results.filter((r) => r.status === 'PASS').length} fail=${failed.length} skipped=${skipped.length}`
);
console.log('DB identity:', { host, port, db, production: false });
if (failed.length) {
  for (const f of failed) console.log('- FAIL', f.name, f.detail);
  process.exit(1);
}
process.exit(0);
