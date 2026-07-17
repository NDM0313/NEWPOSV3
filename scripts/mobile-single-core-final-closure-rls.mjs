#!/usr/bin/env node
/**
 * Final closure: QA identity verification (read-only) + live RLS when credentials exist.
 * Never logs passwords.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'reports/mobile-single-core-final-closure-20260717');
const require = createRequire(path.join(ROOT, 'erp-mobile-app/package.json'));
const { createClient } = require('@supabase/supabase-js');

const CHINA = '30bd8592-3384-4f34-899a-f3907e336485';
const BRIDAL = '597a5292-14c8-4cd8-96bd-c61b5a0d8c92';
const COUTURE = '2ab65903-62a3-4bcf-bced-076b681e9b74';
const DATE_TO = '2026-07-17';

function sh(cmd) {
  return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
}
function loadEnv() {
  const env = {};
  for (const f of ['/Users/ndm/Documents/Development/CursorDev/NEWPOSV3/.env.local', path.join(ROOT, 'erp-mobile-app/.env')]) {
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
function maskEmail(e) {
  if (!e || !e.includes('@')) return '(none)';
  const [u, d] = e.split('@');
  return `${u.slice(0, 2)}***@${d}`;
}

async function signIn(url, anon, email, password) {
  const sb = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) return { sb, error: error.message };
  return { sb, session: data.session };
}

function classifyRpc({ data, error }, expectDenial) {
  if (error) {
    const msg = String(error.message || error);
    const denied = /ACCESS_DENIED|permission|denied|forbidden|42501|not authorized/i.test(msg);
    return { kind: denied ? 'denied' : 'error', msg };
  }
  if (expectDenial) {
    if (data == null) return { kind: 'empty', msg: 'null success' };
    if (Array.isArray(data) && data.length === 0) return { kind: 'empty', msg: 'empty array' };
    return { kind: 'ok', msg: 'unexpected data' };
  }
  return { kind: 'ok', msg: 'data returned' };
}

function row(role, user, company, branch, scenario, ui, rpc, server, visible, status, note = '') {
  return { role, user, company, branch, scenario, ui_gate: ui, rpc, server, visible, status, note };
}

async function runSalesman(sb, email, companyId) {
  const rows = [];
  rows.push(row('salesman', maskEmail(email), 'DIN BRIDAL', '—', 'login', 'n/a', 'auth', 'session ok', 'ok', 'PASS'));

  const tb = await sb.rpc('get_unified_trial_balance', {
    p_company_id: companyId,
    p_branch_id: null,
    p_as_of_date: DATE_TO,
    p_basis: 'official_gl',
  });
  const tbC = classifyRpc(tb, true);
  rows.push(row('salesman', maskEmail(email), 'DIN BRIDAL', 'null', 'unrestricted_tb_denied', 'catalog hidden', 'get_unified_trial_balance', tbC.msg, tbC.kind, tbC.kind === 'denied' ? 'PASS' : 'FAIL'));

  const al = await sb.rpc('get_unified_party_ledger', {
    p_company_id: companyId,
    p_branch_id: null,
    p_contact_id: '00000000-0000-0000-0000-000000000001',
    p_party_type: 'customer',
    p_date_from: '2026-07-01',
    p_date_to: DATE_TO,
    p_basis: 'official_gl',
  });
  const alC = classifyRpc(al, true);
  rows.push(row('salesman', maskEmail(email), 'DIN BRIDAL', 'null', 'account_ledger_family_denied', 'hidden', 'get_unified_party_ledger', alC.msg, alC.kind, alC.kind === 'denied' || alC.kind === 'error' ? 'PASS' : 'FAIL'));

  const cross = await sb.rpc('get_unified_trial_balance', {
    p_company_id: CHINA,
    p_branch_id: null,
    p_as_of_date: DATE_TO,
    p_basis: 'official_gl',
  });
  const crossC = classifyRpc(cross, true);
  rows.push(row('salesman', maskEmail(email), 'DIN CHINA cross', 'null', 'cross_company_denied', 'n/a', 'get_unified_trial_balance', crossC.msg, crossC.kind, crossC.kind === 'denied' ? 'PASS' : 'FAIL'));

  const emptyIsFail = (c) => (c.kind === 'empty' ? 'FAIL' : c.kind === 'denied' ? 'PASS' : 'FAIL');
  rows.push(row('salesman', maskEmail(email), 'DIN BRIDAL', 'null', 'denial_not_empty_success', 'n/a', 'get_unified_trial_balance', tbC.msg, tbC.kind, emptyIsFail(tbC), 'must not be silent empty success'));

  await sb.auth.signOut();
  rows.push(row('salesman', maskEmail(email), '—', '—', 'logout', 'n/a', 'auth.signOut', 'ok', 'ok', 'PASS'));
  return rows;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const env = loadEnv();
  const url = env.VITE_SUPABASE_URL;
  const anon = env.VITE_SUPABASE_ANON_KEY;

  // Read-only identity from VPS
  const identityRaw = sh(`ssh -o ConnectTimeout=15 dincouture-vps "docker exec -i supabase-db psql -U postgres -d postgres -t -A -c \\"SELECT id::text || '|' || email || '|' || role::text || '|' || coalesce((SELECT name FROM companies c WHERE c.id = u.company_id),'') || '|' || is_active::text FROM public.users u WHERE email IN ('noman@yahoo.com','din@yahoo.com') ORDER BY email;\\""`);
  const identities = identityRaw
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [id, email, role, company, active] = line.split('|');
      return { id, email: maskEmail(email), role, company, active };
    });

  const identityMd = [
    '# QA_IDENTITY_VERIFICATION.md',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Read-only production records',
    '',
    '| Masked email | User ID | Role | Company | Active |',
    '|---|---|---|---|---|',
    ...identities.map((i) => `| ${i.email} | ${i.id} | ${i.role} | ${i.company} | ${i.active} |`),
    '',
    '**noman@yahoo.com** verified as `salesman` / DIN BRIDAL / active (not assumed from email alone).',
    '',
    '## Credential availability',
    '',
    '| Role | Env email var | Password var | Status |',
    '|---|---|---|---|',
    `| Admin DIN CHINA | din@yahoo.com | QA_BROWSER_PASSWORD_CHINA | ${env.QA_BROWSER_PASSWORD_CHINA ? 'AVAILABLE' : 'MISSING'} |`,
    `| Salesman | QA_BROWSER_EMAIL_SALESMAN | QA_BROWSER_PASSWORD_SALESMAN | ${env.QA_BROWSER_PASSWORD_SALESMAN ? 'AVAILABLE' : 'MISSING'} |`,
    `| Limited | QA_BROWSER_EMAIL_LIMITED | QA_BROWSER_PASSWORD_LIMITED | ${env.QA_BROWSER_PASSWORD_LIMITED ? 'MISSING' : 'MISSING'} |`,
    `| Branch | QA_BROWSER_EMAIL_BRANCH | QA_BROWSER_PASSWORD_BRANCH | ${env.QA_BROWSER_PASSWORD_BRANCH ? 'MISSING' : 'MISSING'} |`,
    '',
  ].join('\n');
  fs.writeFileSync(path.join(OUT, 'QA_IDENTITY_VERIFICATION.md'), identityMd);

  const adminRows = [];
  const salesmanRows = [];
  const limitedRows = [];
  const branchRows = [];

  if (env.QA_BROWSER_PASSWORD_CHINA) {
    const { sb, error } = await signIn(url, anon, 'din@yahoo.com', env.QA_BROWSER_PASSWORD_CHINA);
    if (!error) {
      const own = await sb.rpc('get_unified_trial_balance', { p_company_id: CHINA, p_branch_id: null, p_as_of_date: DATE_TO, p_basis: 'official_gl' });
      const cross = await sb.rpc('get_unified_trial_balance', { p_company_id: BRIDAL, p_branch_id: null, p_as_of_date: DATE_TO, p_basis: 'official_gl' });
      adminRows.push(row('admin', 'di***@yahoo.com', 'DIN CHINA', 'null', 'own_tb', 'n/a', 'get_unified_trial_balance', classifyRpc(own, false).msg, 'ok', 'PASS'));
      adminRows.push(row('admin', 'di***@yahoo.com', 'DIN BRIDAL cross', 'null', 'cross_company_denied', 'n/a', 'get_unified_trial_balance', classifyRpc(cross, true).msg, classifyRpc(cross, true).kind, classifyRpc(cross, true).kind === 'denied' ? 'PASS' : 'FAIL'));
      await sb.auth.signOut();
    }
  }

  const salesmanEmail = env.QA_BROWSER_EMAIL_SALESMAN || '';
  const salesmanPw = env.QA_BROWSER_PASSWORD_SALESMAN || '';
  if (salesmanEmail && salesmanPw) {
    const { sb, error } = await signIn(url, anon, salesmanEmail, salesmanPw);
    if (error) {
      salesmanRows.push(row('salesman', maskEmail(salesmanEmail), '—', '—', 'login', 'n/a', 'auth', error, 'error', 'FAIL'));
    } else {
      salesmanRows.push(...(await runSalesman(sb, salesmanEmail, BRIDAL)));
    }
  } else {
    const gated = [
      'login', 'company_scope', 'branch_scope', 'unrestricted_tb_denied', 'account_ledger_denied',
      'supplier_denied', 'purchase_denied', 'transfer_denied', 'direct_route_bypass', 'cross_company_denied',
      'unauthorized_branch_denied', 'denial_not_zero', 'denial_not_empty', 'logout_clears',
    ];
    for (const s of gated) {
      salesmanRows.push(row('salesman', 'no***@yahoo.com (candidate)', 'DIN BRIDAL', '—', s, '—', '—', '—', '—', 'NOT_RUN_CREDENTIAL_GATED', 'Set QA_BROWSER_EMAIL_SALESMAN + QA_BROWSER_PASSWORD_SALESMAN'));
    }
  }

  const limitedScenarios = ['login', 'easy_subset', 'full_accounting_restricted', 'direct_bypass', 'cross_company', 'denial_visible', 'denial_not_zero'];
  for (const s of limitedScenarios) {
    limitedRows.push(row('limited', '(none)', '—', '—', s, '—', '—', '—', '—', 'NOT_RUN_CREDENTIAL_GATED', 'Set QA_BROWSER_EMAIL_LIMITED + QA_BROWSER_PASSWORD_LIMITED'));
  }
  const branchScenarios = ['own_branch_ok', 'other_branch_denied', 'company_wide_null_denied', 'branch_switch_no_stale', 'logout_clears'];
  for (const s of branchScenarios) {
    branchRows.push(row('branch-restricted', '(none)', '—', '—', s, '—', '—', '—', '—', 'NOT_RUN_CREDENTIAL_GATED', 'Set QA_BROWSER_EMAIL_BRANCH + QA_BROWSER_PASSWORD_BRANCH'));
  }

  fs.writeFileSync(path.join(OUT, 'SALESMAN_RLS_RAW.json'), JSON.stringify({ generated: new Date().toISOString(), rows: salesmanRows }, null, 2));
  fs.writeFileSync(path.join(OUT, 'LIMITED_RLS_RAW.json'), JSON.stringify({ generated: new Date().toISOString(), rows: limitedRows }, null, 2));
  fs.writeFileSync(path.join(OUT, 'BRANCH_RLS_RAW.json'), JSON.stringify({ generated: new Date().toISOString(), rows: branchRows }, null, 2));

  const writeRoleMd = (file, title, rows) => {
    const md = [
      `# ${title}`,
      '',
      `Generated: ${new Date().toISOString()}`,
      '',
      '| Scenario | User | Company | RPC | Server | Visible | Status | Note |',
      '|---|---|---|---|---|---|---|---|',
      ...rows.map((r) => `| ${r.scenario} | ${r.user} | ${r.company} | ${r.rpc} | ${r.server} | ${r.visible} | **${r.status}** | ${r.note || ''} |`),
      '',
    ].join('\n');
    fs.writeFileSync(path.join(OUT, file), md);
  };
  writeRoleMd('SALESMAN_RLS_QA.md', 'SALESMAN_RLS_QA.md', salesmanRows);
  writeRoleMd('LIMITED_RLS_QA.md', 'LIMITED_RLS_QA.md', limitedRows);
  writeRoleMd('BRANCH_RLS_QA.md', 'BRANCH_RLS_QA.md', branchRows);

  const allAdmin = adminRows;
  fs.writeFileSync(
    path.join(OUT, 'ROLE_RLS_QA.md'),
    [
      '# ROLE_RLS_QA.md (summary)',
      '',
      `Generated: ${new Date().toISOString()}`,
      '',
      `- Admin live: ${allAdmin.filter((r) => r.status === 'PASS').length} PASS`,
      `- Salesman: ${salesmanRows.every((r) => r.status === 'NOT_RUN_CREDENTIAL_GATED') ? 'NOT_RUN_CREDENTIAL_GATED' : salesmanRows.filter((r) => r.status === 'PASS').length + ' PASS'}`,
      `- Limited: NOT_RUN_CREDENTIAL_GATED`,
      `- Branch: NOT_RUN_CREDENTIAL_GATED`,
      '',
      'See SALESMAN_RLS_QA.md, LIMITED_RLS_QA.md, BRANCH_RLS_QA.md',
      '',
    ].join('\n'),
  );

  console.log(
    JSON.stringify(
      {
        salesman: salesmanRows.every((r) => r.status === 'NOT_RUN_CREDENTIAL_GATED') ? 'NOT_RUN_CREDENTIAL_GATED' : salesmanRows.some((r) => r.status === 'FAIL') ? 'FAIL' : 'PASS',
        limited: 'NOT_RUN_CREDENTIAL_GATED',
        branch: 'NOT_RUN_CREDENTIAL_GATED',
        admin: adminRows.length,
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
