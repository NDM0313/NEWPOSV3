/**
 * Live W1 RPC / zero-journal QA against localhost only (.env.db.local).
 * Usage: node scripts/qa/import-fx-w1-live-rpc-qa.mjs
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
console.log(`[QA] host=${u.hostname} port=${u.port || 5432} db=${u.pathname.replace(/^\//, '')}`);
if (!['localhost', '127.0.0.1'].includes(u.hostname)) {
  console.error('ABORT non-local host');
  process.exit(2);
}

const client = new pg.Client({ connectionString });
await client.connect();

const results = [];
function ok(name, detail = '') {
  results.push({ name, pass: true, detail });
  console.log('PASS', name, detail);
}
function fail(name, detail = '') {
  results.push({ name, pass: false, detail });
  console.error('FAIL', name, detail);
}

async function setSessionCompany(companyId, role = 'admin') {
  await client.query(`SELECT set_config('app.company_id', $1, false)`, [companyId ?? '']);
  await client.query(`SELECT set_config('app.user_role', $1, false)`, [role]);
}

async function counts() {
  const q = async (sql) => Number((await client.query(sql)).rows[0].c);
  return {
    je: await q('SELECT count(*)::int AS c FROM journal_entries'),
    jel: await q('SELECT count(*)::int AS c FROM journal_entry_lines'),
    pay: await q('SELECT count(*)::int AS c FROM payments'),
  };
}

const companyA = randomUUID();
const companyB = randomUUID();
const branchA = randomUUID();
const branchB = randomUUID();

await client.query(`INSERT INTO companies (id, name) VALUES ($1,'QA Co A'), ($2,'QA Co B')`, [
  companyA,
  companyB,
]);
await client.query(
  `INSERT INTO branches (id, company_id, name) VALUES ($1,$2,'A1'), ($3,$4,'B1')`,
  [branchA, companyA, branchB, companyB]
);
await client.query(
  `INSERT INTO settings (company_id, key, value) VALUES
   ($1,'accounting_settings', '{"multiCurrencyEnabled":false,"fxSettlementAccountingEnabled":false}'::jsonb),
   ($2,'accounting_settings', '{"multiCurrencyEnabled":true,"fxSettlementAccountingEnabled":false,"activeCurrencies":[{"code":"USD","label":"USD"},{"code":"CNY","label":"RMB"}]}'::jsonb)`,
  [companyA, companyB]
);
// companyA OFF, companyB ON — also set B as primary for ON tests below
// Re-use: enable A for most tests; keep B separate for cross-company
await client.query(
  `UPDATE settings SET value = '{"multiCurrencyEnabled":true,"fxSettlementAccountingEnabled":false,"activeCurrencies":[{"code":"USD","label":"USD"},{"code":"CNY","label":"RMB"}]}'::jsonb
   WHERE company_id = $1 AND key = 'accounting_settings'`,
  [companyA]
);
await client.query(
  `UPDATE settings SET value = '{"multiCurrencyEnabled":false,"fxSettlementAccountingEnabled":false}'::jsonb
   WHERE company_id = $1 AND key = 'accounting_settings'`,
  [companyB]
);

const agent = randomUUID();
const supplier = randomUUID();
await client.query(
  `INSERT INTO contacts (id, company_id, name, type) VALUES
   ($1,$3,'QA Agent','money_exchange'),
   ($2,$3,'QA Supplier','supplier')`,
  [agent, supplier, companyA]
);
await client.query(
  `INSERT INTO accounts (id, company_id, code, name, type) VALUES
   ($1,$2,'2000','AP Control','liability'),
   ($3,$2,'1205','HAMID IK RMB','asset'),
   ($4,$2,'1010','Bank','bank')`,
  [randomUUID(), companyA, randomUUID(), randomUUID()]
);
const purchaseId = randomUUID();
await client.query(
  `INSERT INTO purchases (id, company_id, branch_id, supplier_id, total, due_amount, document_currency, fx_rate_to_base, foreign_total)
   VALUES ($1,$2,$3,$4,1000,1000,'CNY',40,25)`,
  [purchaseId, companyA, branchA, supplier]
);

const before = await counts();

// Session company for fail-closed read/write company assert (create still has legacy inline until later)
await setSessionCompany(companyA, 'admin');

// 1) OFF reject
await client.query(
  `UPDATE settings SET value = jsonb_set(value, '{multiCurrencyEnabled}', 'false'::jsonb)
   WHERE company_id = $1`,
  [companyA]
);
try {
  await client.query(`SELECT create_import_fx_case($1,$2)`, [companyA, branchA]);
  fail('OFF rejects create', 'expected exception');
} catch (e) {
  if (String(e.message).includes('MULTI_CURRENCY_DISABLED')) ok('OFF rejects create');
  else fail('OFF rejects create', e.message);
}

// 2) ON allow
await client.query(
  `UPDATE settings SET value = jsonb_set(value, '{multiCurrencyEnabled}', 'true'::jsonb)
   WHERE company_id = $1`,
  [companyA]
);
const op1 = randomUUID();
const r1 = (
  await client.query(
    `SELECT create_import_fx_case(
      $1,$2,'POOLED_USD_CNY',$3,NULL,'USD',100,280,7,700,0,NULL,'n',$4,$5
    ) AS j`,
    [companyA, branchA, agent, null, op1]
  )
).rows[0].j;
const caseId = r1.case_id;
if (caseId && r1.idempotent_replay === false) ok('ON create first', r1.case_no);
else fail('ON create first', JSON.stringify(r1));

// 3-5) retry same op
const r2 = (
  await client.query(
    `SELECT create_import_fx_case(
      $1,$2,'POOLED_USD_CNY',$3,NULL,'USD',100,280,7,700,0,NULL,'n',$4,$5
    ) AS j`,
    [companyA, branchA, agent, null, op1]
  )
).rows[0].j;
if (r2.case_id === caseId && r2.idempotent_replay === true) ok('retry same UUID returns same case');
else fail('retry same UUID', JSON.stringify(r2));

const stageCount = Number(
  (
    await client.query(`SELECT count(*)::int AS c FROM import_fx_case_stages WHERE case_id = $1`, [
      caseId,
    ])
  ).rows[0].c
);
const eventCount = Number(
  (
    await client.query(`SELECT count(*)::int AS c FROM import_fx_case_events WHERE case_id = $1`, [
      caseId,
    ])
  ).rows[0].c
);
const caseCount = Number(
  (
    await client.query(
      `SELECT count(*)::int AS c FROM import_fx_cases WHERE company_id = $1 AND client_operation_id = $2`,
      [companyA, op1]
    )
  ).rows[0].c
);
if (caseCount === 1 && stageCount === 8) ok('no duplicate case/stages on retry', `events=${eventCount}`);
else fail('duplicate check', `cases=${caseCount} stages=${stageCount} events=${eventCount}`);

// 6) different UUID new case
const op2 = randomUUID();
let r3b;
try {
  r3b = (
    await client.query(
      `SELECT create_import_fx_case(
        $1,$2,'POOLED_USD_CNY',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,$3
      ) AS j`,
      [companyA, branchA, op2]
    )
  ).rows[0].j;
} catch (e) {
  fail('different UUID create', e.message);
  r3b = null;
}
if (r3b && r3b.case_id !== caseId) ok('different UUID new case', r3b.case_no);
else if (r3b) fail('different UUID new case', JSON.stringify(r3b));

// 7) company mismatch via setting app.company_id (same transaction)
await client.query('BEGIN');
try {
  await client.query(`SELECT set_config('app.company_id', $1, true)`, [companyB]);
  await client.query(
    `SELECT create_import_fx_case($1,$2,'POOLED_USD_CNY',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,$3)`,
    [companyA, branchA, randomUUID()]
  );
  await client.query('ROLLBACK');
  fail('cross-company create rejected', 'expected mismatch');
} catch (e) {
  await client.query('ROLLBACK');
  if (String(e.message).includes('COMPANY_MISMATCH') || String(e.message).includes('MULTI_CURRENCY'))
    ok('cross-company create rejected', e.message.split('\n')[0]);
  else fail('cross-company create rejected', e.message);
}

// 9 draft update
await client.query(
  `SELECT update_import_fx_case_draft($1,$2,$3,NULL,'USD',50,290,NULL,NULL,NULL,NULL,'updated',NULL,false,false)`,
  [companyA, caseId, agent]
);
ok('draft update');

// 10-11 confirm arrangement + retry
const confOp = randomUUID();
const c1 = (
  await client.query(
    `SELECT confirm_import_fx_case_stage($1,$2,'ARRANGEMENT',NULL,false,NULL,$3) AS j`,
    [companyA, caseId, confOp]
  )
).rows[0].j;
const c2 = (
  await client.query(
    `SELECT confirm_import_fx_case_stage($1,$2,'ARRANGEMENT',NULL,false,NULL,$3) AS j`,
    [companyA, caseId, confOp]
  )
).rows[0].j;
if (c1.posts_journal === false && (c2.idempotent_replay === true || c2.stage_status === 'COMPLETED'))
  ok('confirm arrangement + idempotent retry', c1.operational_status);
else fail('confirm arrangement', JSON.stringify({ c1, c2 }));

// 12 W2 stage rejected
try {
  await client.query(`SELECT confirm_import_fx_case_stage($1,$2,'ADVANCE')`, [companyA, caseId]);
  fail('W2 stage rejected', 'expected exception');
} catch (e) {
  if (/W2_ARRANGEMENT_ONLY|W1_PLANNING_ONLY/.test(String(e.message))) ok('W2 stage rejected');
  else fail('W2 stage rejected', e.message);
}

// 15 link purchase
await client.query(`SELECT link_import_fx_case_target($1,$2,'PURCHASE',$3)`, [
  companyA,
  caseId,
  purchaseId,
]);
ok('link purchase');

// cancel other draft
const cancelCase = r3b?.case_id;
if (cancelCase) {
  await client.query(`SELECT cancel_import_fx_case_unposted($1,$2,'cancel qa')`, [
    companyA,
    cancelCase,
  ]);
  ok('cancel unposted');
  try {
    // invalid: already cancelled is idempotent ok; try cancel with accounting posted simulation
    await client.query(
      `UPDATE import_fx_cases SET accounting_status = 'POSTED' WHERE id = $1`,
      [cancelCase]
    );
    await client.query(`SELECT cancel_import_fx_case_unposted($1,$2)`, [companyA, cancelCase]);
    fail('invalid cancel rejected', 'expected exception');
  } catch (e) {
    if (String(e.message).includes('CANCEL_REQUIRES_REVERSAL') || String(e.message).includes('NOT_EDITABLE'))
      ok('invalid cancel rejected');
    else fail('invalid cancel rejected', e.message);
  }
}

// list/get ON
await setSessionCompany(companyA, 'admin');
const listed = (
  await client.query(`SELECT list_import_fx_cases($1,$2) AS j`, [companyA, branchA])
).rows[0].j;
const got = (await client.query(`SELECT get_import_fx_case($1,$2) AS j`, [companyA, caseId])).rows[0]
  .j;
if (listed.ok && got.ok && Array.isArray(got.stages)) ok('list/get company scoped');
else fail('list/get', JSON.stringify({ listed, got }));

// fxSettlementAccountingEnabled false
const fxGate = (
  await client.query(
    `SELECT value->>'fxSettlementAccountingEnabled' AS v FROM settings WHERE company_id = $1 AND key = 'accounting_settings'`,
    [companyA]
  )
).rows[0].v;
if (fxGate === 'false' || fxGate == null) ok('fxSettlementAccountingEnabled false', String(fxGate));
else fail('fxSettlementAccountingEnabled false', String(fxGate));

// --- Historical read when Multi Currency OFF ---
await setSessionCompany(companyA, 'admin');
await client.query(
  `UPDATE settings SET value = jsonb_set(value, '{multiCurrencyEnabled}', 'false'::jsonb) WHERE company_id = $1`,
  [companyA]
);

const beforeOffRead = await counts();

let listedOff;
try {
  listedOff = (
    await client.query(`SELECT list_import_fx_cases($1,$2) AS j`, [companyA, branchA])
  ).rows[0].j;
  if (
    listedOff.ok &&
    listedOff.read_only === true &&
    listedOff.multi_currency_enabled === false &&
    Array.isArray(listedOff.rows) &&
    listedOff.rows.some((r) => r.id === caseId)
  ) {
    ok('OFF list returns historical case', `total=${listedOff.total}`);
  } else fail('OFF list returns historical case', JSON.stringify(listedOff));
} catch (e) {
  fail('OFF list returns historical case', e.message);
}

let gotOff;
try {
  gotOff = (await client.query(`SELECT get_import_fx_case($1,$2) AS j`, [companyA, caseId])).rows[0]
    .j;
  if (
    gotOff.ok &&
    gotOff.read_only === true &&
    Array.isArray(gotOff.stages) &&
    gotOff.stages.length >= 1 &&
    Array.isArray(gotOff.events) &&
    Array.isArray(gotOff.links) &&
    Array.isArray(gotOff.attachments)
  ) {
    ok('OFF get returns full historical details', `stages=${gotOff.stages.length}`);
  } else fail('OFF get returns full historical details', JSON.stringify(gotOff));
} catch (e) {
  fail('OFF get returns full historical details', e.message);
}

// Cross-company list/get blocked
await client.query('BEGIN');
try {
  await client.query(`SELECT set_config('app.company_id', $1, true)`, [companyB]);
  await client.query(`SELECT list_import_fx_cases($1,NULL)`, [companyA]);
  await client.query('ROLLBACK');
  fail('cross-company list blocked', 'expected COMPANY_MISMATCH');
} catch (e) {
  await client.query('ROLLBACK');
  if (String(e.message).includes('COMPANY_MISMATCH')) ok('cross-company list blocked');
  else fail('cross-company list blocked', e.message);
}

await client.query('BEGIN');
try {
  await client.query(`SELECT set_config('app.company_id', $1, true)`, [companyB]);
  await client.query(`SELECT get_import_fx_case($1,$2)`, [companyA, caseId]);
  await client.query('ROLLBACK');
  fail('cross-company get blocked', 'expected COMPANY_MISMATCH');
} catch (e) {
  await client.query('ROLLBACK');
  if (String(e.message).includes('COMPANY_MISMATCH')) ok('cross-company get blocked');
  else fail('cross-company get blocked', e.message);
}

// Wrong company_id on get → NOT_FOUND (no tenant leak)
try {
  await client.query(`SELECT get_import_fx_case($1,$2)`, [companyB, caseId]);
  fail('foreign company get not found', 'expected NOT_FOUND');
} catch (e) {
  if (String(e.message).includes('NOT_FOUND') || String(e.message).includes('COMPANY_MISMATCH'))
    ok('foreign company get not found');
  else fail('foreign company get not found', e.message);
}

// Branch filter: other branch id for company-wide admin still filters by id (no leak of other branch cases)
const listedOtherBranch = (
  await client.query(`SELECT list_import_fx_cases($1,$2) AS j`, [companyA, branchB])
).rows[0].j;
if (
  listedOtherBranch.ok &&
  (!Array.isArray(listedOtherBranch.rows) ||
    !listedOtherBranch.rows.some((r) => r.id === caseId))
) {
  ok('unauthorized branch filter excludes case');
} else fail('unauthorized branch filter excludes case', JSON.stringify(listedOtherBranch));

// Mutations remain blocked while OFF
for (const [name, sql, params] of [
  ['OFF create fails', `SELECT create_import_fx_case($1,$2)`, [companyA, branchA]],
  [
    'OFF update fails',
    `SELECT update_import_fx_case_draft($1,$2,NULL,NULL,'USD',1,NULL,NULL,NULL,NULL,NULL,'x',NULL,false,false)`,
    [companyA, caseId],
  ],
  [
    'OFF confirm fails',
    `SELECT confirm_import_fx_case_stage($1,$2,'ARRANGEMENT')`,
    [companyA, caseId],
  ],
  [
    'OFF link fails',
    `SELECT link_import_fx_case_target($1,$2,'PURCHASE',$3)`,
    [companyA, caseId, purchaseId],
  ],
]) {
  try {
    await client.query(sql, params);
    fail(name, 'expected MULTI_CURRENCY_DISABLED');
  } catch (e) {
    if (String(e.message).includes('MULTI_CURRENCY_DISABLED')) ok(name);
    else fail(name, e.message);
  }
}

const afterOffRead = await counts();
const offReadDelta = {
  je: afterOffRead.je - beforeOffRead.je,
  jel: afterOffRead.jel - beforeOffRead.jel,
  pay: afterOffRead.pay - beforeOffRead.pay,
};
if (offReadDelta.je === 0 && offReadDelta.jel === 0 && offReadDelta.pay === 0)
  ok('historical read zero-journal proof', JSON.stringify(offReadDelta));
else fail('historical read zero-journal proof', JSON.stringify(offReadDelta));

// Re-enable Multi Currency → operational actions work again
await client.query(
  `UPDATE settings SET value = jsonb_set(value, '{multiCurrencyEnabled}', 'true'::jsonb) WHERE company_id = $1`,
  [companyA]
);
const restoreCase = (
  await client.query(
    `SELECT create_import_fx_case($1,$2,'POOLED_USD_CNY',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'restore',NULL,$3) AS j`,
    [companyA, branchA, randomUUID()]
  )
).rows[0].j;
if (restoreCase?.case_id) ok('ON restored create works', restoreCase.case_no);
else fail('ON restored create works', JSON.stringify(restoreCase));

const after = await counts();
const delta = {
  je: after.je - before.je,
  jel: after.jel - before.jel,
  pay: after.pay - before.pay,
};
if (delta.je === 0 && delta.jel === 0 && delta.pay === 0)
  ok('zero-journal proof', JSON.stringify(delta));
else fail('zero-journal proof', JSON.stringify({ before, after, delta }));

// Phase-3 accounts absent
const badAcct = await client.query(
  `SELECT code FROM accounts WHERE code IN ('1395','2295','6100','7100')`
);
if (badAcct.rowCount === 0) ok('no Phase-3 accounts');
else fail('no Phase-3 accounts', badAcct.rows.map((r) => r.code).join(','));

const pooled = await client.query(
  `SELECT to_regclass('public.import_fx_cny_pool_lots') AS t, to_regclass('public.wallet_movements') AS w`
);
if (!pooled.rows[0].t && !pooled.rows[0].w) ok('no pooled/wallet_movements tables');
else fail('pooled tables present');

await client.end();

const failed = results.filter((r) => !r.pass);
console.log('\n=== SUMMARY ===');
console.log(`pass=${results.length - failed.length} fail=${failed.length}`);
if (failed.length) {
  for (const f of failed) console.log('-', f.name, f.detail);
  process.exit(1);
}
process.exit(0);
