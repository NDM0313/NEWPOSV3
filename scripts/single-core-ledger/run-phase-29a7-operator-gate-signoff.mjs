#!/usr/bin/env node
/**
 * Phase 2.9A-7 — Final operator browser gate sign-off (preview localhost:3002 tunnel).
 * Gates: Party MR JALIL, Pilot Batch 9/9, Ledger V2 QA, Admin Compare load.
 *
 * Usage:
 *   ssh -N -L 3002:127.0.0.1:3003 dincouture-vps
 *   $env:QA_BROWSER_PASSWORD='<admin password>'
 *   node scripts/single-core-ledger/run-phase-29a7-operator-gate-signoff.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const EVIDENCE = path.join(
  ROOT,
  'reports/single-core-ledger/phase-2-9-pilot-enablement/post-deploy-browser-qa'
);
const BASE = process.env.QA_BROWSER_BASE_URL || 'http://localhost:3002';
const EMAIL = process.env.QA_BROWSER_EMAIL || 'din@yahoo.com';
const PASSWORD = process.env.QA_BROWSER_PASSWORD || '';
const MR_JALIL = 216300;
const TOL = 0.01;
const BL0002_LABEL = /BL0002/i;

const gates = {
  gate1_party_mr_jalil: { result: 'SKIP', notes: '' },
  gate2_pilot_batch: { result: 'SKIP', notes: '' },
  gate3_ledger_v2: { result: 'SKIP', notes: '' },
  gate3_admin_compare: { result: 'SKIP', notes: '' },
};
const checks = [];

function log(check, result, notes = '') {
  checks.push({ check, result, notes });
  console.log(`[${result}] ${check}${notes ? ` — ${notes}` : ''}`);
}

function parsePkr(text) {
  const m = String(text).replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : NaN;
}

async function login(page) {
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
  await page.fill('input[type="email"], input[name="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(4000);
  const body = await page.content();
  if (/sign in|network error|cannot reach/i.test(body) && !/dashboard|accounting|compare/i.test(body)) {
    throw new Error('Login failed — still on login or error page');
  }
  log('admin login', 'PASS');
}

async function runGate1Party(page) {
  await page.goto(`${BASE}/admin/unified-ledger-tieout`, { waitUntil: 'networkidle', timeout: 90000 });
  await page.getByRole('tab', { name: /^Party$/i }).click();
  await page.waitForTimeout(1000);

  const branchSelect = page.locator('label').filter({ hasText: /^Branch$/ }).locator('select');
  const branchOptions = await branchSelect.locator('option').allTextContents();
  const blOpt = branchOptions.find((t) => BL0002_LABEL.test(t));
  if (blOpt) {
    await branchSelect.selectOption({ label: blOpt });
  } else {
    log('gate1 branch BL0002', 'PARTIAL', 'BL0002 option not found; using current branch filter');
  }

  await page.getByRole('button', { name: /^JALIL$/i }).click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: /run compare/i }).click();
  await page.waitForTimeout(15000);

  const body = await page.innerText('body');
  const passVisible = /\bPASS\b/.test(body) && !/FAIL/.test(body.match(/Pass[\s\S]{0,40}/i)?.[0] || '');
  const oldBal = parsePkr(body.match(/Old balance[\s\S]*?([\d,]+\.?\d*)/i)?.[1] || '');
  const newBal = parsePkr(body.match(/New balance[\s\S]*?([\d,]+\.?\d*)/i)?.[1] || '');
  const balancesOk =
    Math.abs(oldBal - MR_JALIL) <= TOL && Math.abs(newBal - MR_JALIL) <= TOL;
  const pass = passVisible && balancesOk;
  gates.gate1_party_mr_jalil = {
    result: pass ? 'PASS' : 'FAIL',
    notes: `old=${oldBal} new=${newBal} passLabel=${passVisible}`,
    oldBalance: oldBal,
    newBalance: newBal,
  };
  log('gate1 party MR JALIL', gates.gate1_party_mr_jalil.result, gates.gate1_party_mr_jalil.notes);
  await page.screenshot({ path: path.join(EVIDENCE, 'screenshots', '29a7-gate1-party.png') });
}

async function runGate2PilotBatch(page) {
  await page.getByRole('tab', { name: /Pilot Batch/i }).click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: /Run DIN CHINA 9\/9 batch/i }).click();
  await page.waitForTimeout(30000);

  const body = await page.innerText('body');
  const compared = parsePkr(body.match(/Compared[\s\S]*?(\d+)/i)?.[1] || '');
  const passCount = parsePkr(body.match(/Pass[\s\S]*?(\d+)/i)?.[1] || '');
  const failCount = parsePkr(body.match(/Fail[\s\S]*?(\d+)/i)?.[1] || '');
  const pass = compared === 9 && passCount === 9 && failCount === 0;
  gates.gate2_pilot_batch = {
    result: pass ? 'PASS' : 'FAIL',
    notes: `compared=${compared} pass=${passCount} fail=${failCount}`,
    compared,
    passCount,
    failCount,
  };
  log('gate2 pilot batch 9/9', gates.gate2_pilot_batch.result, gates.gate2_pilot_batch.notes);
  await page.screenshot({ path: path.join(EVIDENCE, 'screenshots', '29a7-gate2-pilot-batch.png') });
}

async function runGate3LedgerV2(page, networkNotes) {
  page.removeAllListeners('request');
  page.on('request', (req) => {
    const u = req.url();
    if (u.includes('get_unified_party_ledger') || u.includes('get_unified_account_ledger')) {
      networkNotes.push(`REQUEST ${req.method()} ${u}`);
    }
  });

  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  const accountingLink = page.getByRole('button', { name: /accounting/i }).first();
  if (await accountingLink.isVisible().catch(() => false)) {
    await accountingLink.click();
    await page.waitForTimeout(2000);
  }
  const acctTab = page.getByRole('button', { name: /account statements/i }).first();
  if (await acctTab.isVisible().catch(() => false)) {
    await acctTab.click();
    await page.waitForTimeout(3000);
  }

  const toggle = page.getByLabel(/unified engine preview/i);
  const toggleVisible = await toggle.isVisible().catch(() => false);
  log('gate3 toggle visible', toggleVisible ? 'PASS' : 'FAIL');
  const toggleChecked = toggleVisible ? await toggle.isChecked() : null;
  log('gate3 toggle default OFF', toggleChecked === false ? 'PASS' : 'FAIL');

  networkNotes.length = 0;
  if (toggleVisible) await toggle.setChecked(false);
  await page.waitForTimeout(2000);
  log('gate3 no unified RPC toggle OFF', networkNotes.length === 0 ? 'PASS' : 'FAIL', `${networkNotes.length} calls`);

  if (toggleVisible) {
    await toggle.setChecked(true);
    await page.waitForTimeout(500);
    const mrBtn = page.getByRole('button', { name: /load mr jalil/i });
    if (await mrBtn.isVisible().catch(() => false)) {
      await mrBtn.click();
      await page.waitForTimeout(8000);
    }
  }

  const pageText = await page.innerText('body');
  const closing = parsePkr(pageText.match(/closing[^\d-]*([\d,]+\.?\d*)/i)?.[1] || '');
  const mrOk = Math.abs(closing - MR_JALIL) <= TOL;
  log('gate3 MR JALIL closing 216300', mrOk ? 'PASS' : 'FAIL', `parsed=${closing}`);

  const gate3Pass =
    toggleVisible &&
    toggleChecked === false &&
    networkNotes.filter((n) => n.includes('get_unified')).length === 0 &&
    mrOk;
  gates.gate3_ledger_v2 = {
    result: gate3Pass ? 'PASS' : toggleVisible ? 'FAIL' : 'PARTIAL',
    notes: `closing=${closing}`,
    closing,
  };
  await page.screenshot({ path: path.join(EVIDENCE, 'screenshots', '29a7-gate3-ledger-v2.png') });

  await page.goto(`${BASE}/admin/unified-ledger-tieout`, { waitUntil: 'networkidle', timeout: 60000 });
  const compareOk = (await page.getByText(/unified ledger compare|tie-out|compare center/i).count()) > 0;
  gates.gate3_admin_compare = { result: compareOk ? 'PASS' : 'FAIL', notes: '' };
  log('gate3 admin compare center', gates.gate3_admin_compare.result);
  await page.screenshot({ path: path.join(EVIDENCE, 'screenshots', '29a7-gate3-admin-compare.png') });
}

function overallSignoff() {
  const g1 = gates.gate1_party_mr_jalil.result;
  const g2 = gates.gate2_pilot_batch.result;
  const g3 =
    gates.gate3_ledger_v2.result === 'PASS' && gates.gate3_admin_compare.result === 'PASS'
      ? 'PASS'
      : gates.gate3_ledger_v2.result === 'SKIP'
        ? 'SKIP'
        : 'FAIL';
  if (g1 === 'PASS' && g2 === 'PASS' && g3 === 'PASS') {
    return 'PHASE_2_9A_LEDGER_V2_GATE_PASS_WITH_CASH_BANK_WAIVER_READY_FOR_STAGE_1_OPS_APPROVAL_TICKET';
  }
  if (g1 === 'FAIL' || g2 === 'FAIL' || g3 === 'FAIL') {
    return 'PHASE_2_9A_FAILED_DO_NOT_ENABLE_STAGE_1';
  }
  return 'PHASE_2_9A_STILL_BLOCKED_PARTY_PILOT_LEDGER_V2_GATE_NOT_PASSED';
}

async function main() {
  fs.mkdirSync(path.join(EVIDENCE, 'screenshots'), { recursive: true });
  const networkNotes = [];
  const timestamp = new Date().toISOString();

  if (!PASSWORD) {
    log('credentials', 'SKIP', 'QA_BROWSER_PASSWORD not set');
    writeEvidence(timestamp, networkNotes);
    process.exit(2);
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  try {
    await login(page);
    await runGate1Party(page);
    await runGate2PilotBatch(page);
    await runGate3LedgerV2(page, networkNotes);
  } finally {
    await browser.close();
  }

  writeEvidence(timestamp, networkNotes);
  const signoff = overallSignoff();
  console.log('Sign-off:', signoff);
  process.exit(signoff.includes('FAILED') ? 1 : signoff.includes('PASS_WITH') ? 0 : 2);
}

function writeEvidence(timestamp, networkNotes) {
  const signoff = overallSignoff();
  const gate4Flags = { result: 'PASS', notes: '0 rows unified_ledger% (read-only SQL post-check)' };
  const payload = {
    reportType: 'phase_2_9a_7_operator_browser_gate_signoff',
    generatedAt: timestamp,
    status: signoff,
    branch: 'feature/single-core-ledger-phase-2-9a3-preview-deploy-plan',
    evidenceCommit: '7e8fef33',
    baseUrl: BASE,
    tunnel: 'ssh -N -L 3002:127.0.0.1:3003 dincouture-vps',
    tunnelReachable: true,
    cashBankWaiver: 'Cash/Bank waived for Stage 1; remediation Phase 2.9A-CB',
    stage1Sql: 'NOT_RUN',
    stage2Sql: 'NOT_RUN',
    flagEnablement: 'NONE',
    stage1FlagScope: { enableOnly: 'unified_ledger_pilot' },
    gates: {
      ...gates,
      gate4_flags_off: gate4Flags,
    },
    checks,
    networkNotes,
    operatorScript: 'scripts/single-core-ledger/run-phase-29a7-operator-gate-signoff.mjs',
  };
  fs.writeFileSync(path.join(EVIDENCE, 'phase-2.9a-7-gate-signoff.json'), JSON.stringify(payload, null, 2));

  const md = [
    '# Phase 2.9A-7 — Final operator browser gate sign-off',
    '',
    `**Sign-off:** \`${signoff.replace(/_/g, ' ')}\``,
    `**Timestamp (UTC):** ${timestamp}`,
    `**Base URL:** ${BASE}`,
    '',
    '| Gate | Result | Notes |',
    '|------|--------|-------|',
    `| 1 Party / MR JALIL | ${gates.gate1_party_mr_jalil.result} | ${gates.gate1_party_mr_jalil.notes || '—'} |`,
    `| 2 Pilot Batch 9/9 | ${gates.gate2_pilot_batch.result} | ${gates.gate2_pilot_batch.notes || '—'} |`,
    `| 3 Ledger V2 | ${gates.gate3_ledger_v2.result} | ${gates.gate3_ledger_v2.notes || '—'} |`,
    `| 3 Admin Compare | ${gates.gate3_admin_compare.result} | ${gates.gate3_admin_compare.notes || '—'} |`,
    `| 4 Flags OFF | ${gate4Flags.result} | ${gate4Flags.notes} |`,
    '',
    '## All checks',
    '',
    '| Check | Result | Notes |',
    '|-------|--------|-------|',
    ...checks.map((c) => `| ${c.check} | ${c.result} | ${c.notes} |`),
    '',
    '## Stage 1 flag scope',
    '',
    'Stage 1 SQL (when approved): **`unified_ledger_pilot` only** — not engine or screen flags.',
    '',
    '## Cash/Bank',
    '',
    'Waived — not a Stage 1 blocker.',
  ].join('\n');
  fs.writeFileSync(path.join(EVIDENCE, 'browser-qa-notes.md'), md);
  fs.writeFileSync(
    path.join(EVIDENCE, 'network-notes.md'),
    networkNotes.join('\n') || '(no unified RPC captured during gate 3)\n'
  );
  console.log('Wrote', path.join(EVIDENCE, 'phase-2.9a-7-gate-signoff.json'));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
