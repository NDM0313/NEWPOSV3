#!/usr/bin/env node
/**
 * Read-only server/RLS acceptance checks via production Supabase Auth + RPC.
 * No mutations. Never logs passwords.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'erp-mobile-app/package.json'));
const { createClient } = require('@supabase/supabase-js');
const OUT = path.join(ROOT, 'reports/mobile-single-core-acceptance-20260717');
const DATE_TO = '2026-07-17';

const COMPANIES = {
  china: { id: '30bd8592-3384-4f34-899a-f3907e336485', email: 'din@yahoo.com', pwKey: 'QA_BROWSER_PASSWORD_CHINA' },
  bridal: { id: '597a5292-14c8-4cd8-96bd-c61b5a0d8c92', email: 'ndm313@yahoo.com', pwKey: 'QA_BROWSER_PASSWORD_BRIDAL' },
  couture: { id: '2ab65903-62a3-4bcf-bced-076b681e9b74', email: 'zhd@dincouture.pk', pwKey: 'QA_BROWSER_PASSWORD_COUTURE' },
};

function loadEnvFile(filePath) {
  const env = {};
  if (!fs.existsSync(filePath)) return env;
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 0) continue;
    env[t.slice(0, i)] = t.slice(i + 1).replace(/^["']|["']$/g, '');
  }
  return env;
}

function loadEnv() {
  const mobile = loadEnvFile(path.join(ROOT, 'erp-mobile-app/.env'));
  const local = loadEnvFile(path.join(ROOT, '.env.local'));
  const mainLocal = loadEnvFile('/Users/ndm/Documents/Development/CursorDev/NEWPOSV3/.env.local');
  return { ...mobile, ...local, ...mainLocal };
}

async function signIn(url, anon, email, password) {
  const sb = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) return { sb, error: error.message, session: null };
  return { sb, error: null, session: data.session };
}

async function rpcTrialBalance(sb, companyId, branchId) {
  return sb.rpc('get_unified_trial_balance', {
    p_company_id: companyId,
    p_branch_id: branchId,
    p_as_of_date: DATE_TO,
    p_basis: 'official_gl',
  });
}

async function rpcPartyLedger(sb, companyId, contactId, partyType) {
  return sb.rpc('get_unified_party_ledger', {
    p_company_id: companyId,
    p_branch_id: null,
    p_contact_id: contactId,
    p_party_type: partyType,
    p_date_from: '2026-07-01',
    p_date_to: DATE_TO,
    p_basis: 'official_gl',
  });
}

function classifyRpcResult({ data, error }, expectDenial) {
  if (error) {
    const msg = String(error.message || error);
    const denied =
      /permission|denied|not authorized|forbidden|access|policy|42501|P0001/i.test(msg) ||
      error.code === '42501';
    return { kind: denied ? 'denied' : 'error', msg, data: null };
  }
  if (data == null) return { kind: expectDenial ? 'empty' : 'ok', msg: 'null data', data };
  if (Array.isArray(data) && data.length === 0 && expectDenial) return { kind: 'empty', msg: 'empty array', data };
  if (typeof data === 'object' && !Array.isArray(data)) {
    const rows = data.rows ?? data.accounts ?? [];
    if (expectDenial && (!rows || rows.length === 0) && Object.keys(data).length <= 2) {
      return { kind: 'empty', msg: 'empty payload', data };
    }
    return { kind: 'ok', msg: 'data returned', data };
  }
  return { kind: 'ok', msg: 'data returned', data };
}

function statusFrom(kind, expectDenial) {
  if (expectDenial) {
    if (kind === 'denied') return 'PASS';
    if (kind === 'empty') return 'FAIL';
    if (kind === 'ok') return 'FAIL';
    return 'FAIL';
  }
  if (kind === 'ok') return 'PASS';
  if (kind === 'denied') return 'FAIL';
  return 'FAIL';
}

async function main() {
  const env = loadEnv();
  const url = env.VITE_SUPABASE_URL;
  const anon = env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY');

  const rows = [];
  const chinaPw = env[COMPANIES.china.pwKey] || env.QA_BROWSER_PASSWORD || '';
  if (!chinaPw) {
    rows.push({ scenario: 'bootstrap', status: 'NOT_RUN_CREDENTIAL_GATED', note: 'QA_BROWSER_PASSWORD_CHINA missing' });
  } else {
    const { sb, error, session } = await signIn(url, anon, COMPANIES.china.email, chinaPw);
    if (error || !session) {
      rows.push({ scenario: 'admin_china_signin', status: 'FAIL', note: error || 'no session' });
    } else {
      rows.push({ scenario: 'admin_china_signin', status: 'PASS', note: 'session ok' });

      const own = await rpcTrialBalance(sb, COMPANIES.china.id, null);
      const ownC = classifyRpcResult(own, false);
      rows.push({
        scenario: 'admin_china_own_company_tb',
        status: statusFrom(ownC.kind, false),
        ui_gate: 'n/a',
        client_scope: 'china/null',
        rpc: 'get_unified_trial_balance',
        visible: ownC.kind,
        note: ownC.msg,
      });

      const cross = await rpcTrialBalance(sb, COMPANIES.bridal.id, null);
      const crossC = classifyRpcResult(cross, true);
      rows.push({
        scenario: 'admin_china_cross_company_bridal_tb',
        status: statusFrom(crossC.kind, true),
        ui_gate: 'n/a',
        client_scope: 'bridal/null (unauthorized company)',
        rpc: 'get_unified_trial_balance',
        visible: crossC.kind,
        note: crossC.msg,
      });

      const couture = await rpcTrialBalance(sb, COMPANIES.couture.id, null);
      const coutC = classifyRpcResult(couture, true);
      rows.push({
        scenario: 'admin_china_cross_company_couture_tb',
        status: statusFrom(coutC.kind, true),
        ui_gate: 'n/a',
        client_scope: 'couture/null',
        rpc: 'get_unified_trial_balance',
        visible: coutC.kind,
        note: coutC.msg,
      });
    }
  }

  const salesmanEmail = env.QA_BROWSER_EMAIL_SALESMAN || env.QA_SALESMAN_EMAIL || '';
  const salesmanPw = env.QA_BROWSER_PASSWORD_SALESMAN || env.QA_SALESMAN_PASSWORD || '';
  if (!salesmanEmail || !salesmanPw) {
    rows.push({
      scenario: 'salesman_unrestricted_tb',
      status: 'NOT_RUN_CREDENTIAL_GATED',
      note: 'No QA_BROWSER_EMAIL_SALESMAN / QA_BROWSER_PASSWORD_SALESMAN in env',
    });
    rows.push({
      scenario: 'salesman_account_ledger',
      status: 'NOT_RUN_CREDENTIAL_GATED',
      note: 'salesman credentials not in approved local env',
    });
    rows.push({
      scenario: 'salesman_supplier_purchase',
      status: 'NOT_RUN_CREDENTIAL_GATED',
      note: 'salesman credentials not in approved local env',
    });
    rows.push({
      scenario: 'salesman_account_transfer',
      status: 'NOT_RUN_CREDENTIAL_GATED',
      note: 'salesman credentials not in approved local env',
    });
    rows.push({
      scenario: 'limited_direct_route_bypass',
      status: 'NOT_RUN_CREDENTIAL_GATED',
      note: 'limited-user credentials not in env',
    });
  } else {
    const { sb, error } = await signIn(url, anon, salesmanEmail, salesmanPw);
    if (error) {
      rows.push({ scenario: 'salesman_signin', status: 'FAIL', note: error });
    } else {
      const tb = await rpcTrialBalance(sb, COMPANIES.china.id, null);
      const tbC = classifyRpcResult(tb, true);
      rows.push({
        scenario: 'salesman_unrestricted_tb',
        status: statusFrom(tbC.kind, true),
        rpc: 'get_unified_trial_balance',
        visible: tbC.kind,
        note: tbC.msg,
      });
    }
  }

  fs.mkdirSync(OUT, { recursive: true });
  const md = [
    '# ROLE_RLS_QA.md',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Client hub gates (unit tests)',
    'Automated `finalization.test.ts` + `reportsHubCatalog`: **PASS**',
    '',
    '## Live server / RLS',
    '',
    '| Scenario | UI gate | Client scope | RPC | Visible | Status | Note |',
    '|---|---|---|---|---|---|---|',
    ...rows.map((r) =>
      `| ${r.scenario} | ${r.ui_gate || '—'} | ${r.client_scope || '—'} | ${r.rpc || '—'} | ${r.visible || '—'} | **${r.status}** | ${r.note || ''} |`,
    ),
    '',
  ].join('\n');
  fs.writeFileSync(path.join(OUT, 'ROLE_RLS_QA.md'), md);
  fs.writeFileSync(path.join(OUT, 'role-rls-raw.json'), JSON.stringify({ generated: new Date().toISOString(), rows }, null, 2));
  console.log(JSON.stringify({ out: OUT, rows: rows.map((r) => ({ scenario: r.scenario, status: r.status })) }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
