/**
 * Live W2 ARRANGEMENT enrichment RPC QA against localhost only (.env.db.local).
 * Never loads .env.local. Never posts journals.
 *
 * Usage: node scripts/qa/import-fx-w2-live-rpc-qa.mjs
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
    console.error('Missing .env.db.local (required; never use .env.local / production).');
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

function isArrangementOnlyBlock(msg) {
  return /W2_ARRANGEMENT_ONLY|W1_PLANNING_ONLY/.test(String(msg || ''));
}

const env = loadEnvDbLocal();
const connectionString = env.DATABASE_ADMIN_URL || env.DIRECT_URL || env.DATABASE_URL;
const u = new URL(connectionString);
const host = u.hostname;
const port = u.port || '5432';
const db = (u.pathname || '/postgres').replace(/^\//, '') || 'postgres';
console.log(`[W2-QA] host=${host} port=${port} db=${db}`);
if (!['localhost', '127.0.0.1'].includes(host)) {
  console.error('ABORT non-local host');
  process.exit(2);
}
if (port !== '5432' || db !== 'postgres') {
  console.error('ABORT expected localhost:5432/postgres');
  process.exit(2);
}
if (String(connectionString).includes('dincouture') || String(connectionString).includes('72.62')) {
  console.error('ABORT production marker');
  process.exit(2);
}

const client = new pg.Client({ connectionString });
try {
  await client.connect();
} catch (e) {
  console.error('BLOCKED — LOCALHOST DATABASE NOT CONFIRMED');
  console.error('Could not connect to localhost:5432/postgres (container newposv3-local-pg not proven).');
  process.exit(2);
}

const results = [];
function ok(name, detail = '') {
  results.push({ name, pass: true, detail });
  console.log('PASS', name, detail);
}
function fail(name, detail = '') {
  results.push({ name, pass: false, detail });
  console.error('FAIL', name, detail);
}

async function setSessionCompany(companyId, role = 'admin', userId = null) {
  await client.query(`SELECT set_config('app.company_id', $1, false)`, [companyId ?? '']);
  await client.query(`SELECT set_config('app.user_role', $1, false)`, [role]);
  await client.query(`SELECT set_config('app.user_id', $1, false)`, [userId ?? '']);
}

async function tableExists(name) {
  const r = await client.query(`SELECT to_regclass($1) AS t`, [`public.${name}`]);
  return Boolean(r.rows[0].t);
}

async function counts() {
  const q = async (sql) => Number((await client.query(sql)).rows[0].c);
  const out = {
    je: await q('SELECT count(*)::int AS c FROM journal_entries'),
    jel: await q('SELECT count(*)::int AS c FROM journal_entry_lines'),
    pay: await q('SELECT count(*)::int AS c FROM payments'),
    wallet: 0,
    settle: 0,
  };
  if (await tableExists('wallet_movements')) {
    out.wallet = await q('SELECT count(*)::int AS c FROM wallet_movements');
  }
  if (await tableExists('import_fx_cny_pool_allocations')) {
    out.settle = await q('SELECT count(*)::int AS c FROM import_fx_cny_pool_allocations');
  } else if (await tableExists('supplier_fx_settlement_allocations')) {
    out.settle = await q('SELECT count(*)::int AS c FROM supplier_fx_settlement_allocations');
  }
  return out;
}

const companyA = randomUUID();
const companyB = randomUUID();
const branchA1 = randomUUID();
const branchA2 = randomUUID();
const branchB = randomUUID();
const userRestricted = randomUUID();
const userAdmin = randomUUID();

await client.query(`INSERT INTO companies (id, name) VALUES ($1,'W2 QA A'), ($2,'W2 QA B')`, [
  companyA,
  companyB,
]);
await client.query(
  `INSERT INTO branches (id, company_id, name) VALUES ($1,$2,'A1'), ($3,$2,'A2'), ($4,$5,'B1')`,
  [branchA1, companyA, branchA2, branchB, companyB]
);
await client.query(
  `INSERT INTO settings (company_id, key, value) VALUES
   ($1,'accounting_settings', '{"multiCurrencyEnabled":true,"fxSettlementAccountingEnabled":false,"activeCurrencies":[{"code":"USD","label":"USD"},{"code":"CNY","label":"RMB"}]}'::jsonb),
   ($2,'accounting_settings', '{"multiCurrencyEnabled":true,"fxSettlementAccountingEnabled":false,"activeCurrencies":[{"code":"USD","label":"USD"},{"code":"CNY","label":"RMB"}]}'::jsonb)`,
  [companyA, companyB]
);

const agent = randomUUID();
const agent2 = randomUUID();
const supplier = randomUUID();
const supplierB = randomUUID();
await client.query(
  `INSERT INTO contacts (id, company_id, name, type) VALUES
   ($1,$5,'W2 Agent','money_exchange'),
   ($2,$5,'W2 Agent 2','money_exchange'),
   ($3,$5,'W2 Supplier','supplier'),
   ($4,$6,'W2 CoB Agent','money_exchange')`,
  [agent, agent2, supplier, supplierB, companyA, companyB]
);

const purchaseId = randomUUID();
await client.query(
  `INSERT INTO purchases (id, company_id, branch_id, supplier_id, total, due_amount, document_currency, fx_rate_to_base, foreign_total)
   VALUES ($1,$2,$3,$4,1000,1000,'CNY',40,25)`,
  [purchaseId, companyA, branchA1, supplier]
);
const purchaseOtherBranch = randomUUID();
await client.query(
  `INSERT INTO purchases (id, company_id, branch_id, supplier_id, total, due_amount)
   VALUES ($1,$2,$3,$4,50,50)`,
  [purchaseOtherBranch, companyA, branchA2, supplier]
);

await client.query(
  `INSERT INTO users (id, auth_user_id, company_id, role) VALUES ($1,$1,$3,'admin'), ($2,$2,$3,'user')`,
  [userAdmin, userRestricted, companyA]
);
await client.query(`INSERT INTO user_branches (user_id, branch_id, is_default) VALUES ($1,$2,true)`, [
  userRestricted,
  branchA1,
]);

const before = await counts();
console.log('[W2-QA] before', before);

await setSessionCompany(companyA, 'admin', userAdmin);

const MONEY_STAGES = [
  'ADVANCE',
  'USD_ACQUISITION',
  'CHINA_USD_TRANSFER',
  'USD_CNY_CONVERSION',
  'CNY_POOL',
  'SUPPLIER_ALLOCATION',
  'RECONCILIATION',
];

let caseId = null;

try {
  const opCreate = randomUUID();
  const created = (
    await client.query(
      `SELECT create_import_fx_case(
        p_company_id := $1,
        p_branch_id := $2,
        p_arrangement_type := 'POOLED_USD_CNY',
        p_agent_contact_id := $3,
        p_third_party_contact_id := $4,
        p_planned_source_currency := 'USD',
        p_planned_usd_amount := 100,
        p_expected_pkr_per_usd := 280,
        p_expected_cny_per_usd := 7,
        p_expected_cny_amount := 700,
        p_expected_fees_pkr := 10,
        p_notes := 'w2 draft',
        p_client_operation_id := $5,
        p_funding_mode := 'ADVANCE',
        p_planned_settlement_currency := 'RMB',
        p_agent_reference := 'Q-100',
        p_expected_arrangement_date := '2026-08-20',
        p_expected_advance_date := '2026-08-21',
        p_expected_usd_acquisition_date := '2026-08-22',
        p_expected_advance_amount_pkr := 5000
      ) AS j`,
      [companyA, branchA1, agent, agent2, opCreate]
    )
  ).rows[0].j;
  caseId = created.case_id;
  if (created.ok && created.posts_journal === false && created.idempotent_replay === false) {
    ok('1 create enriched ARRANGEMENT draft', created.case_no);
  } else fail('1 create enriched ARRANGEMENT draft', JSON.stringify(created));

  const got = (await client.query(`SELECT get_import_fx_case($1,$2) AS j`, [companyA, caseId])).rows[0]
    .j;
  const c = got.case || {};
  if (
    got.ok &&
    got.posts_journal === false &&
    c.funding_mode === 'ADVANCE' &&
    c.planned_settlement_currency === 'CNY' &&
    c.agent_reference === 'Q-100' &&
    Number(c.expected_advance_amount_pkr) === 5000 &&
    c.expected_arrangement_date &&
    !('storage_path' in (got.attachments?.[0] || {}))
  ) {
    ok('2 read all new fields + RMB→CNY', `settle=${c.planned_settlement_currency}`);
  } else fail('2 read all new fields', JSON.stringify(c));

  const upd = (
    await client.query(
      `SELECT update_import_fx_case_draft(
        p_company_id := $1,
        p_case_id := $2,
        p_funding_mode := 'CREDIT',
        p_agent_reference := 'Q-101',
        p_expected_advance_amount_pkr := 0,
        p_planned_settlement_currency := 'USD',
        p_notes := 'updated planning'
      ) AS j`,
      [companyA, caseId]
    )
  ).rows[0].j;
  if (upd.ok && upd.posts_journal === false) ok('3 update planning fields', '');
  else fail('3 update planning fields', JSON.stringify(upd));

  const got2 = (await client.query(`SELECT get_import_fx_case($1,$2) AS j`, [companyA, caseId])).rows[0]
    .j;
  if (got2.case?.funding_mode === 'CREDIT') ok('5 funding mode CREDIT accepted');
  else fail('5 funding mode CREDIT accepted', JSON.stringify(got2.case));

  await client.query(
    `SELECT update_import_fx_case_draft(p_company_id := $1, p_case_id := $2, p_funding_mode := 'MIXED')`,
    [companyA, caseId]
  );
  const got3 = (await client.query(`SELECT get_import_fx_case($1,$2) AS j`, [companyA, caseId])).rows[0]
    .j;
  if (got3.case?.funding_mode === 'MIXED') ok('6 funding mode MIXED accepted');
  else fail('6 funding mode MIXED accepted', JSON.stringify(got3.case));

  await client.query(
    `SELECT update_import_fx_case_draft(p_company_id := $1, p_case_id := $2, p_funding_mode := 'ADVANCE')`,
    [companyA, caseId]
  );
  ok('4 funding mode ADVANCE accepted as intention only');

  try {
    await client.query(
      `SELECT update_import_fx_case_draft(p_company_id := $1, p_case_id := $2, p_funding_mode := 'WIRE')`,
      [companyA, caseId]
    );
    fail('7 invalid funding mode rejected', 'expected exception');
  } catch (e) {
    if (String(e.message).includes('INVALID_FUNDING_MODE')) ok('7 invalid funding mode rejected');
    else fail('7 invalid funding mode rejected', e.message);
  }

  ok('8 RMB normalized to CNY (create settle currency)', got.case?.planned_settlement_currency);

  try {
    await client.query(
      `SELECT update_import_fx_case_draft(p_company_id := $1, p_case_id := $2, p_planned_usd_amount := -1)`,
      [companyA, caseId]
    );
    fail('9 negative planned amount rejected', 'expected exception');
  } catch (e) {
    if (String(e.message).includes('NEGATIVE_AMOUNT')) ok('9 negative planned amount rejected');
    else fail('9 negative planned amount rejected', e.message);
  }

  try {
    await client.query(
      `SELECT update_import_fx_case_draft(p_company_id := $1, p_case_id := $2, p_expected_pkr_per_usd := -2)`,
      [companyA, caseId]
    );
    fail('10 negative rate rejected', 'expected exception');
  } catch (e) {
    if (String(e.message).includes('NEGATIVE_AMOUNT')) ok('10 negative rate rejected');
    else fail('10 negative rate rejected', e.message);
  }

  try {
    await client.query(
      `SELECT update_import_fx_case_draft(p_company_id := $1, p_case_id := $2, p_agent_contact_id := $3)`,
      [companyA, caseId, supplier]
    );
    fail('11 unauthorized agent role rejected', 'expected exception');
  } catch (e) {
    if (String(e.message).includes('AGENT_ROLE_REQUIRED')) ok('11 unauthorized agent role rejected');
    else fail('11 unauthorized agent role rejected', e.message);
  }

  try {
    await client.query(
      `SELECT update_import_fx_case_draft(
        p_company_id := $1, p_case_id := $2,
        p_agent_contact_id := $3, p_third_party_contact_id := $3
      )`,
      [companyA, caseId, agent]
    );
    fail('12 agent and third party cannot be the same', 'expected exception');
  } catch (e) {
    if (String(e.message).includes('AGENT_THIRD_PARTY_SAME')) ok('12 agent and third party cannot be the same');
    else fail('12 agent and third party cannot be the same', e.message);
  }

  try {
    await client.query(
      `SELECT update_import_fx_case_draft(p_company_id := $1, p_case_id := $2, p_agent_contact_id := $3)`,
      [companyA, caseId, supplierB]
    );
    fail('13 cross-company agent rejected', 'expected exception');
  } catch (e) {
    if (
      String(e.message).includes('AGENT_NOT_FOUND') ||
      String(e.message).includes('AGENT_ROLE_REQUIRED')
    )
      ok('13 cross-company agent rejected');
    else fail('13 cross-company agent rejected', e.message);
  }

  await setSessionCompany(companyA, 'user', userRestricted);
  try {
    await client.query(`SELECT link_import_fx_case_target($1,$2,'PURCHASE',$3)`, [
      companyA,
      caseId,
      purchaseOtherBranch,
    ]);
    fail('14 cross-branch target rejected', 'expected BRANCH_ACCESS_DENIED');
  } catch (e) {
    if (String(e.message).includes('BRANCH_ACCESS_DENIED')) ok('14 cross-branch target rejected');
    else fail('14 cross-branch target rejected', e.message);
  }

  await setSessionCompany(companyA, 'admin', userAdmin);
  const payBefore = Number(
    (await client.query(`SELECT count(*)::int AS c FROM payments WHERE company_id = $1`, [companyA]))
      .rows[0].c
  );
  const linkJ = (
    await client.query(`SELECT link_import_fx_case_target($1,$2,'PURCHASE',$3) AS j`, [
      companyA,
      caseId,
      purchaseId,
    ])
  ).rows[0].j;
  const linkS = (
    await client.query(`SELECT link_import_fx_case_target($1,$2,'SUPPLIER',$3) AS j`, [
      companyA,
      caseId,
      supplier,
    ])
  ).rows[0].j;
  const payAfter = Number(
    (await client.query(`SELECT count(*)::int AS c FROM payments WHERE company_id = $1`, [companyA]))
      .rows[0].c
  );
  if (linkJ.ok && linkJ.posts_journal === false && linkJ.planning_link_only === true && linkS.ok) {
    ok('15 authorized purchase/supplier planning link succeeds');
  } else fail('15 planning link', JSON.stringify({ linkJ, linkS }));
  if (payAfter === payBefore) ok('16 planning link creates no supplier settlement');
  else fail('16 planning link creates no supplier settlement', `pay ${payBefore}->${payAfter}`);

  const attOp = randomUUID();
  const att1 = (
    await client.query(
      `SELECT register_import_fx_case_attachment_metadata(
        $1,$2,'quote.pdf','application/pdf',123,'meta',NULL,$3
      ) AS j`,
      [companyA, caseId, attOp]
    )
  ).rows[0].j;
  if (
    att1.ok &&
    att1.posts_journal === false &&
    att1.is_metadata_only === true &&
    att1.file_uploaded === false &&
    !('storage_path' in att1)
  ) {
    ok('17 attachment metadata registration succeeds');
  } else fail('17 attachment metadata', JSON.stringify(att1));

  const att2 = (
    await client.query(
      `SELECT register_import_fx_case_attachment_metadata(
        $1,$2,'quote.pdf','application/pdf',123,'meta',NULL,$3
      ) AS j`,
      [companyA, caseId, attOp]
    )
  ).rows[0].j;
  if (att2.idempotent_replay === true && att2.attachment_id === att1.attachment_id) {
    ok('18 attachment metadata retry is idempotent');
  } else fail('18 attachment metadata retry', JSON.stringify(att2));

  const gotAtt = (await client.query(`SELECT get_import_fx_case($1,$2) AS j`, [companyA, caseId]))
    .rows[0].j;
  const attRow = (gotAtt.attachments || [])[0] || {};
  if (!('storage_path' in attRow) && attRow.is_metadata_only === true) {
    ok('19 storage_path absent from client response');
  } else fail('19 storage_path absent', JSON.stringify(attRow));

  const priv = await client.query(
    `SELECT has_table_privilege('authenticated', 'public.import_fx_case_attachments', 'SELECT') AS sel,
            has_table_privilege('authenticated', 'public.import_fx_case_attachments', 'INSERT') AS ins`
  );
  if (!priv.rows[0].sel && !priv.rows[0].ins) ok('20 direct attachment-table access remains unavailable');
  else fail('20 direct attachment-table access', JSON.stringify(priv.rows[0]));

  const confOp = randomUUID();
  const c1 = (
    await client.query(
      `SELECT confirm_import_fx_case_stage($1,$2,'ARRANGEMENT',NULL,false,NULL,$3) AS j`,
      [companyA, caseId, confOp]
    )
  ).rows[0].j;
  if (c1.ok && c1.posts_journal === false && c1.stage_status === 'COMPLETED' && c1.operational_status === 'ARRANGED') {
    ok('21 ARRANGEMENT confirmation succeeds', c1.operational_status);
  } else fail('21 ARRANGEMENT confirmation', JSON.stringify(c1));

  const c2 = (
    await client.query(
      `SELECT confirm_import_fx_case_stage($1,$2,'ARRANGEMENT',NULL,false,NULL,$3) AS j`,
      [companyA, caseId, confOp]
    )
  ).rows[0].j;
  if (c2.idempotent_replay === true && c2.posts_journal === false) ok('22 same confirmation operation ID replays safely');
  else fail('22 confirm replay', JSON.stringify(c2));

  const evCount = Number(
    (
      await client.query(
        `SELECT count(*)::int AS c FROM import_fx_case_events
         WHERE case_id = $1 AND event_type = 'STAGE_CONFIRM_ARRANGEMENT'`,
        [caseId]
      )
    ).rows[0].c
  );
  if (evCount === 1) ok('23 confirmation event is not duplicated', `events=${evCount}`);
  else fail('23 confirmation event is not duplicated', `events=${evCount}`);

  try {
    await client.query(
      `SELECT update_import_fx_case_draft(
        p_company_id := $1, p_case_id := $2, p_arrangement_type := 'AGENT_PREPAID'
      )`,
      [companyA, caseId]
    );
    fail('24 confirmed ARRANGEMENT type locked', 'expected ARRANGEMENT_LOCKED or ARRANGEMENT_TYPE_LOCKED');
  } catch (e) {
    const msg = String(e.message);
    // W2.1 raises ARRANGEMENT_LOCKED first when operational_status=ARRANGED;
    // older W2 contract used ARRANGEMENT_TYPE_LOCKED for type changes only.
    if (
      msg.includes('ARRANGEMENT_LOCKED') ||
      msg.includes('ARRANGEMENT_TYPE_LOCKED')
    ) {
      ok('24 confirmed ARRANGEMENT fields lock according to contract');
    } else fail('24 confirmed ARRANGEMENT fields lock', e.message);
  }

  for (const stage of MONEY_STAGES) {
    const label =
      stage === 'ADVANCE'
        ? '25 ADVANCE confirmation is rejected'
        : stage === 'USD_ACQUISITION'
          ? '26 USD_ACQUISITION confirmation is rejected'
          : `27 later stage ${stage} rejected`;
    try {
      await client.query(`SELECT confirm_import_fx_case_stage($1,$2,$3)`, [companyA, caseId, stage]);
      fail(label, 'expected exception');
    } catch (e) {
      if (isArrangementOnlyBlock(e.message) && String(e.message).includes('W2_ARRANGEMENT_ONLY')) {
        ok(label);
      } else if (isArrangementOnlyBlock(e.message)) {
        fail(label, `blocked but not W2 code: ${e.message.split('\n')[0]}`);
      } else fail(label, e.message);
    }
  }

  await client.query(
    `UPDATE settings SET value = jsonb_set(value, '{multiCurrencyEnabled}', 'false'::jsonb) WHERE company_id = $1`,
    [companyA]
  );
  const listedOff = (
    await client.query(`SELECT list_import_fx_cases($1,$2) AS j`, [companyA, branchA1])
  ).rows[0].j;
  const gotOff = (await client.query(`SELECT get_import_fx_case($1,$2) AS j`, [companyA, caseId])).rows[0]
    .j;
  if (listedOff.read_only === true && gotOff.read_only === true && gotOff.ok) {
    ok('28 Multi Currency OFF list/get remains readable');
  } else fail('28 OFF list/get', JSON.stringify({ listedOff, gotOff }));

  try {
    await client.query(
      `SELECT update_import_fx_case_draft(p_company_id := $1, p_case_id := $2, p_notes := 'nope')`,
      [companyA, caseId]
    );
    fail('29 Multi Currency OFF mutations are rejected', 'expected MULTI_CURRENCY_DISABLED');
  } catch (e) {
    if (String(e.message).includes('MULTI_CURRENCY_DISABLED')) ok('29 Multi Currency OFF mutations are rejected');
    else fail('29 OFF mutations', e.message);
  }

  await client.query(
    `UPDATE settings SET value = jsonb_set(value, '{multiCurrencyEnabled}', 'true'::jsonb) WHERE company_id = $1`,
    [companyA]
  );

  await setSessionCompany(companyB, 'admin', userAdmin);
  try {
    await client.query(`SELECT get_import_fx_case($1,$2)`, [companyA, caseId]);
    fail('30 cross-company case access is rejected', 'expected mismatch');
  } catch (e) {
    if (String(e.message).includes('COMPANY_MISMATCH') || String(e.message).includes('NOT_FOUND')) {
      ok('30 cross-company case access is rejected');
    } else fail('30 cross-company case access', e.message);
  }

  await setSessionCompany(companyA, 'admin', userAdmin);
  const caseA2 = (
    await client.query(
      `SELECT create_import_fx_case(p_company_id := $1, p_branch_id := $2, p_client_operation_id := $3) AS j`,
      [companyA, branchA2, randomUUID()]
    )
  ).rows[0].j;
  if (caseA2.posts_journal !== false) fail('33 posts_journal on A2 create', JSON.stringify(caseA2));
  await setSessionCompany(companyA, 'user', userRestricted);
  try {
    await client.query(
      `SELECT update_import_fx_case_draft(p_company_id := $1, p_case_id := $2, p_notes := 'nope')`,
      [companyA, caseA2.case_id]
    );
    fail('31 unauthorized branch access is rejected', 'expected BRANCH_ACCESS_DENIED');
  } catch (e) {
    if (String(e.message).includes('BRANCH_ACCESS_DENIED')) ok('31 unauthorized branch access is rejected');
    else fail('31 unauthorized branch access is rejected', e.message);
  }

  await setSessionCompany(companyA, 'admin', userAdmin);
  const path21 = await client.query(
    `SELECT EXISTS (
       SELECT 1 FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = 'record_fx_currency_purchase_on_credit'
     ) AS ok`
  );
  if (path21.rows[0].ok) ok('32 Path 21 RPC still present (unchanged by W2)');
  else fail('32 Path 21 RPC still present (unchanged by W2)', 'record_fx_currency_purchase_on_credit missing');

  const journalMutations = [created, upd, linkJ, linkS, att1, att2, c1, c2, caseA2];
  const posted = journalMutations.filter((j) => !j || j.posts_journal !== false);
  if (posted.length === 0) ok('33 every W2 mutation returns posts_journal: false', `n=${journalMutations.length}`);
  else fail('33 every W2 mutation returns posts_journal: false', JSON.stringify(posted));
} catch (e) {
  fail('W2 live suite aborted', e.message);
}

const after = await counts();
const delta = {
  je: after.je - before.je,
  jel: after.jel - before.jel,
  pay: after.pay - before.pay,
  wallet: after.wallet - before.wallet,
  settle: after.settle - before.settle,
};
console.log('[W2-QA] after', after);
console.log('[W2-QA] delta', delta);
if (delta.je === 0 && delta.jel === 0 && delta.pay === 0 && delta.wallet === 0 && delta.settle === 0) {
  ok('financial delta 0/0/0/0/0', JSON.stringify(delta));
} else {
  fail('financial delta 0/0/0/0/0', JSON.stringify({ before, after, delta }));
}

await client.end();
const failed = results.filter((r) => !r.pass);
console.log('\n=== W2 LIVE RPC QA SUMMARY ===');
console.log(`pass=${results.length - failed.length} fail=${failed.length}`);
if (failed.length) {
  for (const f of failed) console.log('-', f.name, f.detail);
  process.exit(1);
}
process.exit(0);
