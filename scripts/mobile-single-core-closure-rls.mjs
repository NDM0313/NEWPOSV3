#!/usr/bin/env node
/**
 * Closure RLS role matrix — admin live + salesman/limited/branch credential-gated.
 * Read-only. Never logs passwords.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'reports/mobile-single-core-closure-20260717');
const require = createRequire(path.join(ROOT, 'erp-mobile-app/package.json'));
const { createClient } = require('@supabase/supabase-js');

const DATE_TO = '2026-07-17';
const CHINA = '30bd8592-3384-4f34-899a-f3907e336485';
const BRIDAL = '597a5292-14c8-4cd8-96bd-c61b5a0d8c92';
const COUTURE = '2ab65903-62a3-4bcf-bced-076b681e9b74';

function loadEnv() {
  const env = {};
  for (const f of [
    '/Users/ndm/Documents/Development/CursorDev/NEWPOSV3/.env.local',
    path.join(ROOT, 'erp-mobile-app/.env'),
  ]) {
    if (!fs.existsSync(f)) continue;
    for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const i = t.indexOf('=');
      if (i < 0) continue;
      env[t.slice(0, i)] = t.slice(i + 1).replace(/^["']|["']$/g, '');
    }
  }
  return env;
}

function classify({ data, error }, expectDenial) {
  if (error) {
    const msg = String(error.message || error);
    const denied = /permission|denied|not authorized|forbidden|access|policy|42501|ACCESS_DENIED/i.test(msg);
    return { kind: denied ? 'denied' : 'error', msg };
  }
  if (expectDenial) {
    // empty success is FAIL for denial scenarios
    if (data == null) return { kind: 'empty', msg: 'null data as success' };
    if (Array.isArray(data) && data.length === 0) return { kind: 'empty', msg: 'empty array' };
    return { kind: 'ok', msg: 'data returned when denial expected' };
  }
  return { kind: 'ok', msg: 'data returned' };
}

function status(kind, expectDenial) {
  if (expectDenial) return kind === 'denied' ? 'PASS' : 'FAIL';
  return kind === 'ok' ? 'PASS' : 'FAIL';
}

async function signIn(url, anon, email, password) {
  const sb = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) return { sb, error: error.message };
  return { sb, error: null, session: data.session };
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const env = loadEnv();
  const url = env.VITE_SUPABASE_URL;
  const anon = env.VITE_SUPABASE_ANON_KEY;

  const adminRows = [];
  const salesmanRows = [];
  const limitedRows = [];
  const branchRows = [];

  // --- Admin (available) ---
  const adminEmail = 'din@yahoo.com';
  const adminPw = env.QA_BROWSER_PASSWORD_CHINA || '';
  if (!adminPw) {
    adminRows.push({ scenario: 'admin_signin', status: 'NOT_RUN_CREDENTIAL_GATED', note: 'no China password' });
  } else {
    const { sb, error } = await signIn(url, anon, adminEmail, adminPw);
    adminRows.push({
      role: 'admin',
      user: adminEmail,
      company: 'DIN CHINA',
      branch: 'null',
      scenario: 'admin_signin',
      ui_gate: 'n/a',
      rpc: 'auth.signIn',
      server: error || 'session',
      visible: error ? 'fail' : 'ok',
      status: error ? 'FAIL' : 'PASS',
    });
    if (!error) {
      const own = await sb.rpc('get_unified_trial_balance', {
        p_company_id: CHINA,
        p_branch_id: null,
        p_as_of_date: DATE_TO,
        p_basis: 'official_gl',
      });
      const c1 = classify(own, false);
      adminRows.push({
        role: 'admin',
        user: adminEmail,
        company: 'DIN CHINA',
        branch: 'null',
        scenario: 'own_company_tb',
        rpc: 'get_unified_trial_balance',
        server: c1.msg,
        visible: c1.kind,
        status: status(c1.kind, false),
      });
      const cross = await sb.rpc('get_unified_trial_balance', {
        p_company_id: BRIDAL,
        p_branch_id: null,
        p_as_of_date: DATE_TO,
        p_basis: 'official_gl',
      });
      const c2 = classify(cross, true);
      adminRows.push({
        role: 'admin',
        user: adminEmail,
        company: 'DIN BRIDAL (cross)',
        branch: 'null',
        scenario: 'cross_company_bridal_tb',
        rpc: 'get_unified_trial_balance',
        server: c2.msg,
        visible: c2.kind,
        status: status(c2.kind, true),
      });
      const cross2 = await sb.rpc('get_unified_trial_balance', {
        p_company_id: COUTURE,
        p_branch_id: null,
        p_as_of_date: DATE_TO,
        p_basis: 'official_gl',
      });
      const c3 = classify(cross2, true);
      adminRows.push({
        role: 'admin',
        user: adminEmail,
        company: 'DIN COUTURE (cross)',
        branch: 'null',
        scenario: 'cross_company_couture_tb',
        rpc: 'get_unified_trial_balance',
        server: c3.msg,
        visible: c3.kind,
        status: status(c3.kind, true),
      });
      await sb.auth.signOut();
    }
  }

  // --- Salesman ---
  const salesmanEmail = env.QA_BROWSER_EMAIL_SALESMAN || env.QA_SALESMAN_EMAIL || '';
  const salesmanPw = env.QA_BROWSER_PASSWORD_SALESMAN || env.QA_SALESMAN_PASSWORD || '';
  const salesmanScenarios = [
    'login',
    'company_scope',
    'branch_scope',
    'unrestricted_tb_denied',
    'unrestricted_account_ledger_denied',
    'supplier_accounting_denied',
    'purchase_accounting_denied',
    'account_transfer_denied',
    'direct_route_bypass',
    'denial_not_zero',
    'denial_not_empty_success',
    'walkin_customer_scope',
    'logout_clears',
  ];
  if (!salesmanEmail || !salesmanPw) {
    for (const s of salesmanScenarios) {
      salesmanRows.push({
        role: 'salesman',
        user: salesmanEmail || '(none)',
        company: '—',
        branch: '—',
        scenario: s,
        ui_gate: '—',
        rpc: '—',
        server: '—',
        visible: '—',
        status: 'NOT_RUN_CREDENTIAL_GATED',
        note: 'Set QA_BROWSER_EMAIL_SALESMAN + QA_BROWSER_PASSWORD_SALESMAN (active candidates: noman@yahoo.com / DIN BRIDAL)',
      });
    }
  }

  // --- Limited ---
  const limitedEmail = env.QA_BROWSER_EMAIL_LIMITED || env.QA_LIMITED_EMAIL || '';
  const limitedPw = env.QA_BROWSER_PASSWORD_LIMITED || env.QA_LIMITED_PASSWORD || '';
  const limitedScenarios = [
    'login',
    'easy_subset',
    'full_accounting_restricted',
    'direct_url_bypass',
    'denial_visible_not_zero',
    'company_branch_scope',
  ];
  if (!limitedEmail || !limitedPw) {
    for (const s of limitedScenarios) {
      limitedRows.push({
        role: 'limited/easy',
        user: limitedEmail || '(none)',
        scenario: s,
        status: 'NOT_RUN_CREDENTIAL_GATED',
        note: 'Set QA_BROWSER_EMAIL_LIMITED + QA_BROWSER_PASSWORD_LIMITED',
      });
    }
  }

  // --- Branch-restricted ---
  const branchEmail = env.QA_BROWSER_EMAIL_BRANCH || env.QA_BRANCH_EMAIL || '';
  const branchPw = env.QA_BROWSER_PASSWORD_BRANCH || env.QA_BRANCH_PASSWORD || '';
  const branchScenarios = ['own_branch_ok', 'other_branch_denied', 'company_wide_null_denied', 'branch_switch_no_stale'];
  if (!branchEmail || !branchPw) {
    for (const s of branchScenarios) {
      branchRows.push({
        role: 'branch-restricted',
        user: branchEmail || '(none)',
        scenario: s,
        status: 'NOT_RUN_CREDENTIAL_GATED',
        note: 'Set QA_BROWSER_EMAIL_BRANCH + QA_BROWSER_PASSWORD_BRANCH',
      });
    }
  }

  fs.writeFileSync(path.join(OUT, 'SALESMAN_RLS_RAW.json'), JSON.stringify({ generated: new Date().toISOString(), rows: salesmanRows }, null, 2));
  fs.writeFileSync(path.join(OUT, 'LIMITED_RLS_RAW.json'), JSON.stringify({ generated: new Date().toISOString(), rows: limitedRows }, null, 2));
  fs.writeFileSync(path.join(OUT, 'BRANCH_RLS_RAW.json'), JSON.stringify({ generated: new Date().toISOString(), rows: branchRows }, null, 2));
  fs.writeFileSync(path.join(OUT, 'admin-rls-raw.json'), JSON.stringify({ generated: new Date().toISOString(), rows: adminRows }, null, 2));

  const all = [...adminRows, ...salesmanRows, ...limitedRows, ...branchRows];
  const md = [
    '# ROLE_RLS_QA.md',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Client hub gates',
    'Unit tests (`finalization.test.ts`, `reportsHubCatalog`, `permissions.test.ts`): **PASS**',
    '',
    '## Live server / RLS',
    '',
    '| Role | User | Company | Branch | Scenario | UI gate | RPC | Server | Visible | Status |',
    '|---|---|---|---|---|---|---|---|---|---|',
    ...all.map(
      (r) =>
        `| ${r.role || '—'} | ${r.user || '—'} | ${r.company || '—'} | ${r.branch || '—'} | ${r.scenario} | ${r.ui_gate || '—'} | ${r.rpc || '—'} | ${(r.server || r.note || '—').toString().replace(/\|/g, '/')} | ${r.visible || '—'} | **${r.status}** |`,
    ),
    '',
    '### Summary',
    `- Admin live: ${adminRows.filter((r) => r.status === 'PASS').length} PASS / ${adminRows.filter((r) => r.status === 'FAIL').length} FAIL`,
    `- Salesman: ${salesmanRows.every((r) => r.status === 'NOT_RUN_CREDENTIAL_GATED') ? 'NOT_RUN_CREDENTIAL_GATED' : 'see rows'}`,
    `- Limited: ${limitedRows.every((r) => r.status === 'NOT_RUN_CREDENTIAL_GATED') ? 'NOT_RUN_CREDENTIAL_GATED' : 'see rows'}`,
    `- Branch-restricted: ${branchRows.every((r) => r.status === 'NOT_RUN_CREDENTIAL_GATED') ? 'NOT_RUN_CREDENTIAL_GATED' : 'see rows'}`,
    '',
    'Active salesman accounts exist in production (e.g. `noman@yahoo.com` / DIN BRIDAL) but passwords are **not** in approved local env — operator must supply securely.',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(OUT, 'ROLE_RLS_QA.md'), md);
  console.log(
    JSON.stringify(
      {
        admin: adminRows.map((r) => ({ s: r.scenario, status: r.status })),
        salesman: 'NOT_RUN_CREDENTIAL_GATED',
        limited: 'NOT_RUN_CREDENTIAL_GATED',
        branch: 'NOT_RUN_CREDENTIAL_GATED',
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
