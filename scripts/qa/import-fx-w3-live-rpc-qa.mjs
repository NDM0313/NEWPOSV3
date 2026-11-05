/**
 * Live W3 Advance Confirm & Post QA — localhost only (.env.db.local).
 * Applies W3 harness stubs, posts one agent advance, asserts JE lines, reverses.
 * Never loads .env.local / production.
 *
 * Usage: node scripts/qa/import-fx-w3-live-rpc-qa.mjs
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
  if (!fs.existsSync(envPath)) {
    console.error('BLOCKED — LOCALHOST DATABASE NOT CONFIRMED');
    process.exit(2);
  }
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
console.log(`[W3-LIVE] host=${host} port=${port} db=${db}`);
if (!['localhost', '127.0.0.1'].includes(host) || port !== '5432' || db !== 'postgres') {
  console.error('ABORT expected localhost:5432/postgres');
  process.exit(2);
}
if (/dincouture|72\.62/.test(connectionString)) {
  console.error('ABORT production marker');
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

async function counts() {
  const r = await client.query(`
    SELECT
      (SELECT count(*)::int FROM journal_entries) AS je,
      (SELECT count(*)::int FROM journal_entry_lines) AS jel,
      (SELECT count(*)::int FROM payments) AS pay
  `);
  return r.rows[0];
}

// Harness (localhost only)
const harness = fs.readFileSync(path.join(root, 'scripts/qa/import-fx-w3-local-harness.sql'), 'utf8');
await client.query(harness);
ok('0 harness applied');

const before = await counts();
console.log('[W3-LIVE] before', before);

const companyId = randomUUID();
const branchId = randomUUID();
const userId = randomUUID();
const agentId = randomUUID();
const cashId = randomUUID();
const clearingId = randomUUID();

await client.query(`INSERT INTO companies (id, name) VALUES ($1, 'W3 Live QA Co')`, [companyId]);
await client.query(`INSERT INTO branches (id, company_id, name) VALUES ($1,$2,'Main')`, [branchId, companyId]);
await client.query(
  `INSERT INTO users (id, auth_user_id, company_id, role) VALUES ($1,$1,$2,'admin')`,
  [userId, companyId]
);
await client.query(
  `INSERT INTO contacts (id, company_id, name, type) VALUES ($1,$2,'W3 Agent','money_exchange')`,
  [agentId, companyId]
);
await client.query(
  `INSERT INTO accounts (id, company_id, code, name, type, is_active, is_group)
   VALUES ($1,$3,'1010','W3 Demo Cash','cash',true,false),
          ($2,$3,'1215','W3 Agent FX Advance Clearing','asset',true,false)`,
  [cashId, clearingId, companyId]
);
await client.query(
  `INSERT INTO settings (company_id, key, value) VALUES ($1, 'accounting_settings', $2::jsonb)`,
  [
    companyId,
    JSON.stringify({
      multiCurrencyEnabled: true,
      fxSettlementAccountingEnabled: false,
      agentFxAdvanceClearingAccountId: clearingId,
      activeCurrencies: [
        { code: 'USD', label: 'USD' },
        { code: 'CNY', label: 'RMB' },
      ],
    }),
  ]
);

await client.query(`SELECT set_config('app.company_id', $1, false)`, [companyId]);
await client.query(`SELECT set_config('app.user_role', 'admin', false)`, []);
await client.query(`SELECT set_config('app.user_id', $1, false)`, [userId]);

const cap = (await client.query(`SELECT import_fx_w3_capability() AS c`)).rows[0].c;
if (cap?.installed) ok('1 import_fx_w3_capability installed', JSON.stringify(cap));
else fail('1 import_fx_w3_capability installed', JSON.stringify(cap));

const createOp = randomUUID();
const created = (
  await client.query(
    `SELECT create_import_fx_case(
      p_company_id := $1,
      p_branch_id := $2,
      p_arrangement_type := 'PATH_21_AGENT_DUAL_CREDIT',
      p_agent_contact_id := $3,
      p_planned_source_currency := 'USD',
      p_planned_settlement_currency := 'CNY',
      p_planned_usd_amount := 15000,
      p_expected_pkr_per_usd := 287.5,
      p_funding_mode := 'ADVANCE',
      p_expected_advance_amount_pkr := 150000,
      p_client_operation_id := $4
    ) AS r`,
    [companyId, branchId, agentId, createOp]
  )
).rows[0].r;

if (created?.case_id || created?.id) {
  ok('2 create case', created.case_no || created.case_id || created.id);
} else {
  fail('2 create case', JSON.stringify(created));
}

const caseId = created.case_id || created.id;
if (!caseId) {
  console.error('No case id — abort');
  await client.end();
  process.exit(1);
}

try {
  const conf = (
    await client.query(
      `SELECT confirm_import_fx_case_stage($1,$2,'ARRANGEMENT',NULL,false,NULL,$3) AS r`,
      [companyId, caseId, randomUUID()]
    )
  ).rows[0].r;
  if (conf?.success === false) fail('3 confirm ARRANGEMENT', JSON.stringify(conf));
  else ok('3 confirm ARRANGEMENT', conf?.operational_status || JSON.stringify(conf).slice(0, 100));
} catch (e) {
  fail('3 confirm ARRANGEMENT', e.message);
}

const advOp = randomUUID();
let post;
try {
  post = (
    await client.query(
      `SELECT post_import_fx_agent_advance(
        $1,$2,$3,CURRENT_DATE,150000,$4,'QA-ADV','live qa',$5,$6
      ) AS r`,
      [companyId, branchId, caseId, cashId, advOp, userId]
    )
  ).rows[0].r;
} catch (e) {
  fail('4 post agent advance', e.message);
  post = null;
}

if (post?.success && post?.posts_journal === true && post?.journal_entry_id) {
  ok('4 post agent advance', `je=${post.journal_entry_id} amount=${post.amount_pkr}`);
} else if (post) {
  fail('4 post agent advance', JSON.stringify(post));
}

const afterPost = await counts();
const dJe = afterPost.je - before.je;
const dJel = afterPost.jel - before.jel;
const dPay = afterPost.pay - before.pay;
if (dJe === 1 && dJel === 2 && dPay === 0) ok('5 JE delta after advance', `je=${dJe} jel=${dJel} pay=${dPay}`);
else fail('5 JE delta after advance', `je=${dJe} jel=${dJel} pay=${dPay} expected 1/2/0`);

const acct = (
  await client.query(`SELECT accounting_status, operational_status FROM import_fx_cases WHERE id = $1`, [
    caseId,
  ])
).rows[0];
if (acct?.accounting_status === 'PARTIALLY_POSTED') ok('6 accounting_status PARTIALLY_POSTED');
else fail('6 accounting_status PARTIALLY_POSTED', JSON.stringify(acct));

const replay = (
  await client.query(
    `SELECT post_import_fx_agent_advance(
      $1,$2,$3,CURRENT_DATE,150000,$4,'QA-ADV','live qa',$5,$6
    ) AS r`,
    [companyId, branchId, caseId, cashId, advOp, userId]
  )
).rows[0].r;
if (replay?.idempotent_replay === true) ok('7 advance idempotent replay');
else fail('7 advance idempotent replay', JSON.stringify(replay));

const afterReplay = await counts();
if (afterReplay.je === afterPost.je && afterReplay.jel === afterPost.jel) {
  ok('8 replay creates no extra JE');
} else fail('8 replay creates no extra JE', JSON.stringify({ afterPost, afterReplay }));

// Reverse
if (post?.event_id) {
  try {
    const rev = (
      await client.query(`SELECT reverse_import_fx_agent_advance($1,$2,$3,$4) AS r`, [
        companyId,
        post.event_id,
        randomUUID(),
        userId,
      ])
    ).rows[0].r;
    if (rev?.success) ok('9 reverse advance', JSON.stringify(rev).slice(0, 120));
    else fail('9 reverse advance', JSON.stringify(rev));
  } catch (e) {
    fail('9 reverse advance', e.message);
  }
} else {
  fail('9 reverse advance', 'no event_id');
}

const final = await counts();
console.log('[W3-LIVE] final', final);
console.log('[W3-LIVE] net vs before', {
  je: final.je - before.je,
  jel: final.jel - before.jel,
  pay: final.pay - before.pay,
});

const pass = results.filter((r) => r.pass).length;
const failN = results.filter((r) => !r.pass).length;
console.log(`\n=== W3 LIVE RPC QA SUMMARY ===\npass=${pass} fail=${failN}`);
await client.end();
process.exit(failN ? 1 : 0);
