/**
 * W1 Import FX mutation-security QA (localhost only).
 * Usage: node scripts/qa/import-fx-w1-mutation-security-qa.mjs
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
console.log(`[MUT-QA] host=${host} port=${port} db=${db}`);
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

const companyA = randomUUID();
const companyB = randomUUID();
const branchA1 = randomUUID();
const branchA2 = randomUUID();
const userRestricted = randomUUID();
const userAdmin = randomUUID();
const supplier = randomUUID();
const purchaseId = randomUUID();

await client.query(`INSERT INTO companies (id, name) VALUES ($1,'MUT Co A'), ($2,'MUT Co B')`, [
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
  `INSERT INTO users (id, auth_user_id, company_id, role) VALUES
   ($1,$1,$3,'user'), ($2,$2,$3,'admin')`,
  [userRestricted, userAdmin, companyA]
);
await client.query(
  `INSERT INTO user_branches (user_id, branch_id, is_default) VALUES ($1,$2,true)`,
  [userRestricted, branchA1]
);
await client.query(
  `INSERT INTO contacts (id, company_id, name, type) VALUES ($1,$2,'MUT Supplier','supplier')`,
  [supplier, companyA]
);
await client.query(
  `INSERT INTO purchases (id, company_id, branch_id, supplier_id, total, due_amount)
   VALUES ($1,$2,$3,$4,100,100)`,
  [purchaseId, companyA, branchA1, supplier]
);

const before = await counts();
console.log('[MUT-QA] before', before);

await setSession({ companyId: companyA, userId: userAdmin, role: 'admin' });

// 1 Authorized company create
const op1 = randomUUID();
let caseId;
try {
  const r1 = (
    await client.query(
      `SELECT create_import_fx_case($1,$2,'POOLED_USD_CNY',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'mut-1',NULL,$3) AS j`,
      [companyA, branchA1, op1]
    )
  ).rows[0].j;
  caseId = r1.case_id;
  if (caseId && r1.idempotent_replay === false) ok('1 authorized company create', r1.case_no);
  else fail('1 authorized company create', JSON.stringify(r1));
} catch (e) {
  fail('1 authorized company create', e.message);
}

// 2 Same client_operation_id retry
try {
  const r2 = (
    await client.query(
      `SELECT create_import_fx_case($1,$2,'POOLED_USD_CNY',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'mut-1',NULL,$3) AS j`,
      [companyA, branchA1, op1]
    )
  ).rows[0].j;
  if (r2.case_id === caseId && r2.idempotent_replay === true) ok('2 retry same client_operation_id');
  else fail('2 retry same client_operation_id', JSON.stringify(r2));
} catch (e) {
  fail('2 retry same client_operation_id', e.message);
}

// 3 No duplicate stages/events
try {
  const st = Number(
    (await client.query(`SELECT count(*)::int AS c FROM import_fx_case_stages WHERE case_id=$1`, [caseId]))
      .rows[0].c
  );
  const ev = Number(
    (
      await client.query(
        `SELECT count(*)::int AS c FROM import_fx_case_events WHERE case_id=$1 AND event_type='CASE_CREATED'`,
        [caseId]
      )
    ).rows[0].c
  );
  const cases = Number(
    (
      await client.query(
        `SELECT count(*)::int AS c FROM import_fx_cases WHERE company_id=$1 AND client_operation_id=$2`,
        [companyA, op1]
      )
    ).rows[0].c
  );
  if (cases === 1 && st === 8 && ev === 1) ok('3 no duplicate stages/events', `stages=${st} created_events=${ev}`);
  else fail('3 no duplicate stages/events', `cases=${cases} stages=${st} events=${ev}`);
} catch (e) {
  fail('3 no duplicate stages/events', e.message);
}

// 4 Different company ID rejected
try {
  await client.query(
    `SELECT create_import_fx_case($1,$2,'POOLED_USD_CNY',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,$3)`,
    [companyB, branchA1, randomUUID()]
  );
  fail('4 different company ID rejected', 'expected COMPANY_MISMATCH');
} catch (e) {
  if (String(e.message).includes('COMPANY_MISMATCH')) ok('4 different company ID rejected');
  else fail('4 different company ID rejected', e.message);
}

// 5 NULL authenticated company rejected
await setSession({ companyId: null, userId: userAdmin, role: 'admin' });
try {
  await client.query(`SELECT create_import_fx_case($1,$2)`, [companyA, branchA1]);
  fail('5 NULL auth company rejected', 'expected AUTH_COMPANY_REQUIRED');
} catch (e) {
  if (String(e.message).includes('AUTH_COMPANY_REQUIRED')) ok('5 NULL auth company rejected');
  else fail('5 NULL auth company rejected', e.message);
}

// 6 Company resolver error rejected
await client.query(`SELECT set_config('app.company_id', 'not-a-uuid', false)`);
await client.query(`SELECT set_config('app.user_id', $1, false)`, [userAdmin]);
await client.query(`SELECT set_config('app.user_role', 'admin', false)`);
try {
  await client.query(`SELECT create_import_fx_case($1,$2)`, [companyA, branchA1]);
  fail('6 company resolver error rejected', 'expected error');
} catch (e) {
  if (
    String(e.message).includes('invalid input syntax') ||
    String(e.message).includes('AUTH_COMPANY')
  ) {
    ok('6 company resolver error rejected', e.message.split('\n')[0]);
  } else fail('6 company resolver error rejected', e.message);
}

// 7 Anonymous create rejected
await setSession({ companyId: companyA, userId: userAdmin, role: 'admin' });
try {
  await client.query('BEGIN');
  await client.query('SET LOCAL ROLE anon');
  await client.query(`SELECT create_import_fx_case($1,$2)`, [companyA, branchA1]);
  await client.query('ROLLBACK');
  fail('7 anonymous create rejected', 'expected permission denied');
} catch (e) {
  await client.query('ROLLBACK').catch(() => {});
  if (String(e.message).includes('permission denied')) ok('7 anonymous create rejected');
  else fail('7 anonymous create rejected', e.message);
}

// 8 Authenticated without company rejected
await setSession({ companyId: null, userId: userRestricted, role: 'user' });
try {
  await client.query('BEGIN');
  await client.query('SET LOCAL ROLE authenticated');
  await client.query(`SELECT create_import_fx_case($1,$2)`, [companyA, branchA1]);
  await client.query('ROLLBACK');
  fail('8 authenticated without company rejected', 'expected AUTH_COMPANY_REQUIRED');
} catch (e) {
  await client.query('ROLLBACK').catch(() => {});
  if (
    String(e.message).includes('AUTH_COMPANY_REQUIRED') ||
    String(e.message).includes('permission denied')
  ) {
    ok('8 authenticated without company rejected', e.message.split('\n')[0]);
  } else fail('8 authenticated without company rejected', e.message);
}

// 9 Authorized branch create
await setSession({ companyId: companyA, userId: userRestricted, role: 'user' });
let caseRestricted;
try {
  const r = (
    await client.query(
      `SELECT create_import_fx_case($1,$2,'POOLED_USD_CNY',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'mut-br',NULL,$3) AS j`,
      [companyA, branchA1, randomUUID()]
    )
  ).rows[0].j;
  caseRestricted = r.case_id;
  if (caseRestricted) ok('9 authorized branch create', r.case_no);
  else fail('9 authorized branch create', JSON.stringify(r));
} catch (e) {
  fail('9 authorized branch create', e.message);
}

// 10 Unauthorized branch create rejected
try {
  await client.query(
    `SELECT create_import_fx_case($1,$2,'POOLED_USD_CNY',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,$3)`,
    [companyA, branchA2, randomUUID()]
  );
  fail('10 unauthorized branch create rejected', 'expected BRANCH_ACCESS_DENIED');
} catch (e) {
  if (String(e.message).includes('BRANCH_ACCESS_DENIED')) ok('10 unauthorized branch create rejected');
  else fail('10 unauthorized branch create rejected', e.message);
}

// 11 NULL/company-wide branch create — canonical commission/payments policy ALLOWS
try {
  const r = (
    await client.query(
      `SELECT create_import_fx_case($1,NULL,'POOLED_USD_CNY',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'mut-null',NULL,$2) AS j`,
      [companyA, randomUUID()]
    )
  ).rows[0].j;
  if (r.case_id) {
    ok(
      '11 NULL branch create allowed per canonical policy',
      'commission/payments INSERT allows NULL branch for company members'
    );
  } else fail('11 NULL branch create allowed per canonical policy', JSON.stringify(r));
} catch (e) {
  fail('11 NULL branch create allowed per canonical policy', e.message);
}

// 12 Multi Currency OFF create rejected
await setSession({ companyId: companyA, userId: userAdmin, role: 'admin' });
await client.query(
  `UPDATE settings SET value = jsonb_set(value, '{multiCurrencyEnabled}', 'false'::jsonb)
   WHERE company_id=$1 AND key='accounting_settings'`,
  [companyA]
);
try {
  await client.query(`SELECT create_import_fx_case($1,$2)`, [companyA, branchA1]);
  fail('12 OFF create rejected', 'expected MULTI_CURRENCY_DISABLED');
} catch (e) {
  if (String(e.message).includes('MULTI_CURRENCY_DISABLED')) ok('12 OFF create rejected');
  else fail('12 OFF create rejected', e.message);
}

// 13 ON create succeeds
await client.query(
  `UPDATE settings SET value = jsonb_set(value, '{multiCurrencyEnabled}', 'true'::jsonb)
   WHERE company_id=$1 AND key='accounting_settings'`,
  [companyA]
);
let caseOn;
try {
  const r = (
    await client.query(
      `SELECT create_import_fx_case($1,$2,'POOLED_USD_CNY',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'mut-on',NULL,$3) AS j`,
      [companyA, branchA1, randomUUID()]
    )
  ).rows[0].j;
  caseOn = r.case_id;
  if (caseOn) ok('13 ON create succeeds', r.case_no);
  else fail('13 ON create succeeds', JSON.stringify(r));
} catch (e) {
  fail('13 ON create succeeds', e.message);
}

// Seed a case on branch A2 as admin for cross-branch mutation tests
const caseA2 = (
  await client.query(
    `SELECT create_import_fx_case($1,$2,'POOLED_USD_CNY',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'mut-a2',NULL,$3) AS j`,
    [companyA, branchA2, randomUUID()]
  )
).rows[0].j.case_id;

// 14 Update draft cross-company rejected
await setSession({ companyId: companyB, userId: userAdmin, role: 'admin' });
try {
  await client.query(
    `SELECT update_import_fx_case_draft($1,$2,NULL,NULL,'USD',1,NULL,NULL,NULL,NULL,NULL,'x',NULL,false,false)`,
    [companyA, caseId]
  );
  fail('14 update cross-company rejected', 'expected COMPANY_MISMATCH');
} catch (e) {
  if (String(e.message).includes('COMPANY_MISMATCH')) ok('14 update cross-company rejected');
  else fail('14 update cross-company rejected', e.message);
}

// 15 Confirm cross-company rejected
try {
  await client.query(`SELECT confirm_import_fx_case_stage($1,$2,'ARRANGEMENT')`, [companyA, caseId]);
  fail('15 confirm cross-company rejected', 'expected COMPANY_MISMATCH');
} catch (e) {
  if (String(e.message).includes('COMPANY_MISMATCH')) ok('15 confirm cross-company rejected');
  else fail('15 confirm cross-company rejected', e.message);
}

// 16 Cancel cross-company rejected
try {
  await client.query(`SELECT cancel_import_fx_case_unposted($1,$2)`, [companyA, caseOn]);
  fail('16 cancel cross-company rejected', 'expected COMPANY_MISMATCH');
} catch (e) {
  if (String(e.message).includes('COMPANY_MISMATCH')) ok('16 cancel cross-company rejected');
  else fail('16 cancel cross-company rejected', e.message);
}

// 17 Link cross-company rejected
try {
  await client.query(`SELECT link_import_fx_case_target($1,$2,'PURCHASE',$3)`, [
    companyA,
    caseId,
    purchaseId,
  ]);
  fail('17 link cross-company rejected', 'expected COMPANY_MISMATCH');
} catch (e) {
  if (String(e.message).includes('COMPANY_MISMATCH')) ok('17 link cross-company rejected');
  else fail('17 link cross-company rejected', e.message);
}

// 18 Unauthorized branch mutation rejected
await setSession({ companyId: companyA, userId: userRestricted, role: 'user' });
try {
  await client.query(
    `SELECT update_import_fx_case_draft($1,$2,NULL,NULL,'USD',2,NULL,NULL,NULL,NULL,NULL,'nope',NULL,false,false)`,
    [companyA, caseA2]
  );
  fail('18 unauthorized branch mutation rejected', 'expected BRANCH_ACCESS_DENIED');
} catch (e) {
  if (String(e.message).includes('BRANCH_ACCESS_DENIED')) ok('18 unauthorized branch mutation rejected');
  else fail('18 unauthorized branch mutation rejected', e.message);
}

// 19 Invalid stage transition rejected
await setSession({ companyId: companyA, userId: userAdmin, role: 'admin' });
try {
  await client.query(`SELECT confirm_import_fx_case_stage($1,$2,'ADVANCE')`, [companyA, caseId]);
  fail('19 invalid stage transition rejected', 'expected W1_PLANNING_ONLY');
} catch (e) {
  if (String(e.message).includes('W1_PLANNING_ONLY')) ok('19 invalid stage transition rejected');
  else fail('19 invalid stage transition rejected', e.message);
}

const after = await counts();
console.log('[MUT-QA] after', after);
const delta = {
  je: after.je - before.je,
  jel: after.jel - before.jel,
  pay: after.pay - before.pay,
};

if (delta.je === 0) ok('20 create JE delta 0', JSON.stringify({ before: before.je, after: after.je }));
else fail('20 create JE delta 0', JSON.stringify({ before, after, delta }));
if (delta.jel === 0)
  ok('21 journal-line delta 0', JSON.stringify({ before: before.jel, after: after.jel }));
else fail('21 journal-line delta 0', JSON.stringify({ before, after, delta }));
if (delta.pay === 0) ok('22 payment delta 0', JSON.stringify({ before: before.pay, after: after.pay }));
else fail('22 payment delta 0', JSON.stringify({ before, after, delta }));

await client.end();

const failed = results.filter((r) => r.status === 'FAIL');
console.log('\n=== MUTATION SECURITY QA SUMMARY ===');
console.log(`pass=${results.filter((r) => r.status === 'PASS').length} fail=${failed.length} skipped=0`);
console.log('DB identity:', { host, port, db, production: false });
if (failed.length) {
  for (const f of failed) console.log('- FAIL', f.name, f.detail);
  process.exit(1);
}
process.exit(0);
