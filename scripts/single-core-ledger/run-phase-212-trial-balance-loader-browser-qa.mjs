#!/usr/bin/env node
/**
 * Phase 2.12 — Trial Balance loader browser QA.
 * Modes: baseline | candidate | rollback | soak-t0 | soak-mid | soak-final
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const EVIDENCE = path.join(ROOT, 'reports/single-core-ledger/phase-2-12-trial-balance-loader');
const MODE = (process.argv[2] || 'baseline').toLowerCase();
const BASE = process.env.QA_BROWSER_BASE_URL || 'http://localhost:3002';
const EMAIL = process.env.QA_BROWSER_EMAIL || 'din@yahoo.com';
const PASSWORD = process.env.QA_BROWSER_PASSWORD || '';
const MR_JALIL = 216300;
const TOL = 0.01;
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
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 120000 });
  await page.fill('input[type="email"], input[name="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(5000);
}

async function setWideRange(page) {
  const today = new Date().toISOString().slice(0, 10);
  await page.evaluate(({ todayIso }) => {
    localStorage.setItem('erp-global-filters', JSON.stringify({
      dateRangeType: 'customRange', customStartDate: '2000-01-01', customEndDate: todayIso, branchId: null,
    }));
  }, { todayIso: today });
}

async function openTrialBalance(page) {
  await setWideRange(page);
  await page.goto(`${BASE}/?view=reports&financial=trial-balance`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForTimeout(4000);
  const financialTab = page.getByRole('button', { name: /^Financial$/ });
  if (await financialTab.isVisible().catch(() => false)) {
    await financialTab.click();
    await page.waitForTimeout(2000);
  }
  const tbTab = page.getByRole('button', { name: /^Trial Balance$/ });
  if (await tbTab.isVisible().catch(() => false)) {
    await tbTab.click();
    await page.waitForTimeout(2000);
  }
  await page.waitForFunction(
    () => {
      if (document.querySelector('[data-trial-balance-main-loader]')) return true;
      return /Total Debit:/i.test(document.body.innerText);
    },
    null,
    { timeout: 180000 },
  );
  await page.waitForTimeout(3000);
}

async function readTrialBalanceTotals(page) {
  const body = await page.innerText('body');
  const debitM = body.match(/Total Debit:\s*Rs\.?\s*([\d,]+\.?\d*)/i);
  const creditM = body.match(/Total Credit:\s*Rs\.?\s*([\d,]+\.?\d*)/i);
  const diffM = body.match(/Difference:\s*Rs\.?\s*([\d,]+\.?\d*)/i);
  return {
    totalDebit: debitM ? parsePkr(debitM[1]) : NaN,
    totalCredit: creditM ? parsePkr(creditM[1]) : NaN,
    difference: diffM ? parsePkr(diffM[1]) : NaN,
  };
}

async function readClosingBalance(page) {
  const labels = page.getByText('Closing Balance', { exact: true });
  const count = await labels.count();
  let best = NaN;
  for (let i = 0; i < count; i += 1) {
    const card = labels.nth(i).locator('..');
    const txt = await card.textContent().catch(() => '');
    const n = parsePkr(txt || '');
    if (Number.isFinite(n) && (Number.isNaN(best) || Math.abs(n) > Math.abs(best))) best = n;
  }
  if (!Number.isFinite(best)) {
    const body = await page.innerText('body');
    const m = body.match(/Closing Balance[\s\n\r]+Rs\.?\s*([\d,]+\.?\d*)/i);
    if (m) best = parsePkr(m[1]);
  }
  return best;
}

async function verifyLedgerV2Unified(page) {
  await page.goto(`${BASE}/reports/ledger-statement-center-v2`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForTimeout(3000);
  const tabBtn = page.locator('button').filter({ hasText: /^Account Statements$/ });
  if (await tabBtn.count()) await tabBtn.first().click();
  await page.getByRole('button', { name: /load mr jalil/i }).click({ timeout: 120000 });
  await page.waitForTimeout(8000);
  const loader = await page.locator('[data-ledger-v2-main-loader]').first().getAttribute('data-ledger-v2-main-loader');
  const closing = await readClosingBalance(page);
  log('Ledger V2 main loader still unified', loader === 'unified' ? 'PASS' : 'FAIL', `actual=${loader}`);
  log('Ledger V2 MR JALIL 216300', Math.abs(closing - MR_JALIL) <= TOL ? 'PASS' : 'FAIL', `closing=${closing}`);
}

async function verifyAccountStatementUnified(page) {
  await setWideRange(page);
  await page.goto(`${BASE}/?view=accounting`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForTimeout(4000);
  await page.getByRole('button', { name: /^Account Statements$/ }).click({ timeout: 60000 });
  await page.waitForTimeout(2000);
  await page.getByRole('button', { name: /Advanced \(effective \/ audit\)/i }).click({ timeout: 30000 });
  await page.waitForTimeout(3000);
  const mrBtn = page.getByRole('button', { name: /load mr jalil/i });
  if (await mrBtn.isVisible().catch(() => false)) await mrBtn.click();
  await page.waitForTimeout(8000);
  const loader = await page.locator('[data-account-statement-main-loader]').first().getAttribute('data-account-statement-main-loader');
  const closing = await readClosingBalance(page);
  log('Account Statement main loader still unified', loader === 'unified' ? 'PASS' : 'FAIL', `actual=${loader}`);
  log('Account Statement MR JALIL 216300', Math.abs(closing - MR_JALIL) <= TOL ? 'PASS' : 'FAIL', `closing=${closing}`);
}

async function verifyPilotBatch(page) {
  await page.goto(`${BASE}/admin/unified-ledger-tieout`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForTimeout(4000);
  await page.getByRole('tab', { name: /Pilot Batch/i }).click({ timeout: 60000 });
  await page.waitForFunction(
    () => {
      const labels = [...document.querySelectorAll('.text-xs.text-gray-500')];
      const comparedLabel = labels.find((el) => el.textContent?.trim() === 'Compared');
      if (!comparedLabel) return false;
      const val = comparedLabel.parentElement?.querySelector('.text-lg.font-mono');
      const n = Number(String(val?.textContent || '').replace(/,/g, ''));
      return Number.isFinite(n) && n > 0;
    },
    null,
    { timeout: 180000 },
  );
  const body = await page.innerText('body');
  const passM = body.match(/Pass\s*\n?\s*(\d+)/i) || body.match(/Passed[\s:]*(\d+)/i);
  const failM = body.match(/Fail\s*\n?\s*(\d+)/i) || body.match(/Failed[\s:]*(\d+)/i);
  const pass = passM ? Number(passM[1]) : NaN;
  const fail = failM ? Number(failM[1]) : NaN;
  log('Admin Compare Pilot Batch 9/9', pass === 9 && fail === 0 ? 'PASS' : 'FAIL', `pass=${pass} fail=${fail}`);
}

async function runTrialBalanceChecks(page, expectedLoader) {
  await openTrialBalance(page);
  const mainLoader = await page.locator('[data-trial-balance-main-loader]').first().getAttribute('data-trial-balance-main-loader');
  log(`Trial Balance main loader (${MODE})`, mainLoader === expectedLoader ? 'PASS' : 'FAIL', `expected=${expectedLoader} actual=${mainLoader}`);

  const totals = await readTrialBalanceTotals(page);
  const balanced = Number.isFinite(totals.totalDebit) && Number.isFinite(totals.totalCredit)
    && Math.abs(totals.totalDebit - totals.totalCredit) <= TOL;
  log('Trial Balance debit = credit', balanced ? 'PASS' : 'FAIL',
    `debit=${totals.totalDebit} credit=${totals.totalCredit} diff=${totals.totalDebit - totals.totalCredit}`);

  const toggle = page.getByRole('checkbox', { name: /unified engine preview \(compare only\)/i });
  if (await toggle.isVisible().catch(() => false)) {
    await toggle.setChecked(true);
    await page.waitForTimeout(6000);
    const compareSource = await page.locator('[data-trial-balance-preview-compare-source]').first().getAttribute('data-trial-balance-preview-compare-source');
    const expectedCompare = expectedLoader === 'unified' ? 'legacy_shadow' : 'unified_compare';
    log('preview compare source', compareSource === expectedCompare ? 'PASS' : 'FAIL', `expected=${expectedCompare} actual=${compareSource}`);
    await toggle.setChecked(false);
  }

  fs.mkdirSync(path.join(EVIDENCE, 'screenshots'), { recursive: true });
  await page.screenshot({ path: path.join(EVIDENCE, 'screenshots', `212-${MODE}-trial-balance.png`), fullPage: true });

  return {
    ok: mainLoader === expectedLoader && balanced,
    mainLoader,
    totals,
  };
}

function loadGolden() {
  const goldenPath = path.join(EVIDENCE, 'trial-balance-legacy-golden.json');
  if (!fs.existsSync(goldenPath)) return null;
  return JSON.parse(fs.readFileSync(goldenPath, 'utf8'));
}

function compareToGolden(totals) {
  const golden = loadGolden();
  if (!golden) {
    log('unified totals match legacy golden', 'WAIVED', 'no golden file yet');
    return true;
  }
  const debitMatch = Math.abs(totals.totalDebit - golden.totalDebit) <= TOL;
  const creditMatch = Math.abs(totals.totalCredit - golden.totalCredit) <= TOL;
  log('unified totals match legacy golden', debitMatch && creditMatch ? 'PASS' : 'FAIL',
    `golden debit=${golden.totalDebit} credit=${golden.totalCredit}`);
  return debitMatch && creditMatch;
}

async function main() {
  if (!PASSWORD) {
    console.error('Set QA_BROWSER_PASSWORD');
    process.exit(1);
  }
  const soakModes = ['soak-t0', 'soak-mid', 'soak-final'];
  const expectedLoader = MODE === 'candidate' || soakModes.includes(MODE) ? 'unified' : 'legacy';
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await login(page);
    log('admin login', 'PASS');
    const tb = await runTrialBalanceChecks(page, expectedLoader);
    if (MODE === 'baseline') {
      fs.mkdirSync(EVIDENCE, { recursive: true });
      fs.writeFileSync(path.join(EVIDENCE, 'trial-balance-legacy-golden.json'), JSON.stringify({
        capturedAt: new Date().toISOString(),
        mode: 'baseline',
        baseUrl: BASE,
        totalDebit: tb.totals.totalDebit,
        totalCredit: tb.totals.totalCredit,
        difference: tb.totals.totalDebit - tb.totals.totalCredit,
        mainLoader: tb.mainLoader,
        filters: { startDate: '2000-01-01', endDate: new Date().toISOString().slice(0, 10), branchId: null, arApMode: 'flat' },
      }, null, 2));
      log('legacy golden captured', 'PASS');
    }
    if (expectedLoader === 'unified') compareToGolden(tb.totals);
    await verifyLedgerV2Unified(page);
    await verifyAccountStatementUnified(page);
    await verifyPilotBatch(page);
    const pass = tb.ok && checks.every((c) => c.result === 'PASS' || c.result === 'WAIVED');
    const mdName = soakModes.includes(MODE)
      ? `production-loader-soak-${MODE.replace('soak-', '')}.md`
      : MODE.startsWith('production')
        ? `production-${MODE}-qa.md`
        : `preview-${MODE}-qa.md`;
    const md = [`# Phase 2.12 Trial Balance loader QA — ${MODE}`, '', `**Overall:** ${pass ? 'PASS' : 'FAIL'}`, '', ...checks.map((c) => `- [${c.result}] ${c.check}${c.notes ? ` — ${c.notes}` : ''}`)].join('\n');
    fs.mkdirSync(EVIDENCE, { recursive: true });
    fs.writeFileSync(path.join(EVIDENCE, mdName), md);
    console.log(`\nPhase 2.12 browser QA (${MODE}): ${pass ? 'PASS' : 'FAIL'}`);
    process.exit(pass ? 0 : 1);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
