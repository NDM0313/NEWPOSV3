#!/usr/bin/env node
/**
 * Phase 2.14 — Roznamcha loader browser QA.
 * Modes: baseline | candidate | rollback | soak-t0 | soak-mid | soak-final
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const EVIDENCE = path.join(ROOT, 'reports/single-core-ledger/phase-2-14-roznamcha-loader');
const MODE = (process.argv[2] || 'baseline').toLowerCase();
const BASE = process.env.QA_BROWSER_BASE_URL || 'https://erp.dincouture.pk';
const EMAIL = process.env.QA_BROWSER_EMAIL || 'din@yahoo.com';
const PASSWORD = process.env.QA_BROWSER_PASSWORD || '';
const MR_JALIL = 216300;
const TB_GOLDEN = 407957271.02;
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
  await page.evaluate(async () => {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((r) => r.unregister()));
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.fill('input[type="email"], input[name="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(5000);
}

async function setWideRange(page) {
  const today = new Date().toISOString().slice(0, 10);
  await page.evaluate(({ todayIso }) => {
    localStorage.setItem('erp-global-filters', JSON.stringify({
      dateRangeType: 'customRange', customStartDate: '2000-01-01', customEndDate: todayIso, branchId: 'all',
    }));
  }, { todayIso: today });
  await page.reload({ waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForTimeout(2000);
}

async function openRoznamcha(page) {
  await setWideRange(page);
  await page.goto(`${BASE}/?view=accounting`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForTimeout(3000);
  await page.getByRole('button', { name: /^Roznamcha$/ }).click({ timeout: 60000 });
  await page.waitForTimeout(3000);
  await page.locator('[data-roznamcha-main-loader]').first().waitFor({ timeout: 180000 });
  await page.waitForTimeout(8000);
}

async function readRoznamchaSummary(page) {
  const body = await page.innerText('body');
  const openingM = body.match(/Opening Balance[\s\n\r]+(?:Rs\.?\s*)?([\d,]+\.?\d*)/i);
  const cashInM = body.match(/Cash In(?: Today)?[\s\n\r]+(?:Rs\.?\s*)?([\d,]+\.?\d*)/i);
  const cashOutM = body.match(/Cash Out(?: Today)?[\s\n\r]+(?:Rs\.?\s*)?([\d,]+\.?\d*)/i);
  const closingM = body.match(/Closing Balance[\s\n\r]+(?:Rs\.?\s*)?([\d,]+\.?\d*)/i);
  return {
    openingBalance: openingM ? parsePkr(openingM[1]) : NaN,
    cashIn: cashInM ? parsePkr(cashInM[1]) : NaN,
    cashOut: cashOutM ? parsePkr(cashOutM[1]) : NaN,
    closingBalance: closingM ? parsePkr(closingM[1]) : NaN,
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
  return best;
}

async function readPartyLedgerClosing(page) {
  await setWideRange(page);
  await page.goto(`${BASE}/?view=party-ledger`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForTimeout(3000);
  const mrBtn = page.getByRole('button', { name: /load mr jalil/i });
  if (await mrBtn.isVisible().catch(() => false)) await mrBtn.click();
  await page.waitForTimeout(8000);
  const body = await page.innerText('body');
  const m = body.match(/Current Receivable[\s\n\r]+(?:Rs\.?\s*)?([\d,]+\.?\d*)/i);
  return m ? parsePkr(m[1]) : NaN;
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

async function verifyPartyLedgerUnified(page) {
  await setWideRange(page);
  await page.goto(`${BASE}/?view=party-ledger`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForTimeout(3000);
  const mrBtn = page.getByRole('button', { name: /load mr jalil/i });
  if (await mrBtn.isVisible().catch(() => false)) await mrBtn.click();
  await page.waitForTimeout(8000);
  const loader = await page.locator('[data-party-ledger-main-loader]').first().getAttribute('data-party-ledger-main-loader');
  const closing = await readPartyLedgerClosing(page);
  log('Party Ledger main loader still unified', loader === 'unified' ? 'PASS' : 'FAIL', `actual=${loader}`);
  log('Party Ledger MR JALIL 216300', Math.abs(closing - MR_JALIL) <= TOL ? 'PASS' : 'FAIL', `closing=${closing}`);
}

async function verifyTrialBalanceUnified(page) {
  await setWideRange(page);
  await page.goto(`${BASE}/?view=reports`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForTimeout(3000);
  await page.getByRole('button', { name: /^Financial$/ }).click({ timeout: 60000 });
  await page.waitForTimeout(2000);
  await page.getByRole('button', { name: /^Trial Balance$/ }).click({ timeout: 60000 });
  await page.waitForTimeout(5000);
  await page.locator('[data-trial-balance-main-loader]').first().waitFor({ timeout: 180000 });
  const loader = await page.locator('[data-trial-balance-main-loader]').first().getAttribute('data-trial-balance-main-loader');
  const body = await page.innerText('body');
  const debitM = body.match(/Total Debit:\s*Rs\.?\s*([\d,]+\.?\d*)/i);
  const creditM = body.match(/Total Credit:\s*Rs\.?\s*([\d,]+\.?\d*)/i);
  const totalDebit = debitM ? parsePkr(debitM[1]) : NaN;
  const totalCredit = creditM ? parsePkr(creditM[1]) : NaN;
  log('Trial Balance main loader still unified', loader === 'unified' ? 'PASS' : 'FAIL', `actual=${loader}`);
  log('Trial Balance debit = credit golden',
    Math.abs(totalDebit - TB_GOLDEN) <= TOL && Math.abs(totalCredit - TB_GOLDEN) <= TOL ? 'PASS' : 'FAIL',
    `debit=${totalDebit} credit=${totalCredit}`);
}

async function verifyPilotBatch(page) {
  await page.goto(`${BASE}/admin/unified-ledger-tieout`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForTimeout(4000);
  await page.getByRole('tab', { name: /Pilot Batch/i }).click({ timeout: 60000 });
  await page.waitForTimeout(500);
  const runBtn = page.getByRole('button', { name: /Run DIN CHINA 9\/9 batch/i });
  if (await runBtn.isVisible().catch(() => false)) await runBtn.click();
  await page.waitForFunction(
    () => {
      const labels = [...document.querySelectorAll('.text-xs.text-gray-500')];
      const comparedLabel = labels.find((el) => el.textContent?.trim() === 'Compared');
      if (!comparedLabel) return false;
      const val = comparedLabel.parentElement?.querySelector('.text-lg.font-mono');
      const n = Number(String(val?.textContent || '').replace(/,/g, ''));
      return Number.isFinite(n) && n >= 9;
    },
    null,
    { timeout: 180000 },
  );
  const body = await page.innerText('body');
  const comparedM = body.match(/Compared[\s\n\r]+([\d,]+)/i);
  const passM = body.match(/Pass[\s\n\r]+([\d,]+)/i);
  const failM = body.match(/Fail[\s\n\r]+([\d,]+)/i);
  const compared = comparedM ? Number(comparedM[1].replace(/,/g, '')) : NaN;
  const passCount = passM ? Number(passM[1].replace(/,/g, '')) : NaN;
  const failCount = failM ? Number(failM[1].replace(/,/g, '')) : NaN;
  log('Admin Compare Pilot Batch 9/9', compared === 9 && passCount === 9 && failCount === 0 ? 'PASS' : 'FAIL', `compared=${compared} pass=${passCount} fail=${failCount}`);
}

async function runRoznamchaChecks(page, expectedLoader) {
  await openRoznamcha(page);
  const mainLoader = await page.locator('[data-roznamcha-main-loader]').first().getAttribute('data-roznamcha-main-loader', { timeout: 60000 });
  log(`Roznamcha main loader (${MODE})`, mainLoader === expectedLoader ? 'PASS' : 'FAIL', `expected=${expectedLoader} actual=${mainLoader}`);

  const summary = await readRoznamchaSummary(page);
  log('Roznamcha summary readable', Number.isFinite(summary.closingBalance) ? 'PASS' : 'FAIL',
    `opening=${summary.openingBalance} in=${summary.cashIn} out=${summary.cashOut} closing=${summary.closingBalance}`);

  const toggle = page.getByRole('checkbox', { name: /unified engine preview \(compare only\)/i });
  if (await toggle.isVisible().catch(() => false)) {
    await toggle.setChecked(true);
    await page.waitForTimeout(6000);
    const compareSource = await page.locator('[data-roznamcha-preview-compare-source]').first().getAttribute('data-roznamcha-preview-compare-source');
    const expectedCompare = expectedLoader === 'unified' ? 'legacy_shadow' : 'unified_compare';
    log('preview compare source', compareSource === expectedCompare ? 'PASS' : 'FAIL', `expected=${expectedCompare} actual=${compareSource}`);
    await toggle.setChecked(false);
  }

  fs.mkdirSync(path.join(EVIDENCE, 'screenshots'), { recursive: true });
  await page.screenshot({ path: path.join(EVIDENCE, 'screenshots', `214-${MODE}-roznamcha.png`), fullPage: true });

  return { ok: mainLoader === expectedLoader && Number.isFinite(summary.closingBalance), mainLoader, summary };
}

function loadGolden() {
  const p = path.join(EVIDENCE, 'roznamcha-legacy-golden.json');
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function compareToGolden(summary) {
  const golden = loadGolden();
  if (!golden) {
    log('Roznamcha totals match legacy golden', 'WAIVED', 'no golden file yet');
    return true;
  }
  const closingMatch = Math.abs(summary.closingBalance - golden.closingBalance) <= TOL;
  const cashInMatch = Math.abs(summary.cashIn - golden.cashIn) <= TOL;
  const cashOutMatch = Math.abs(summary.cashOut - golden.cashOut) <= TOL;
  log('Roznamcha totals match legacy golden', closingMatch && cashInMatch && cashOutMatch ? 'PASS' : 'FAIL',
    `golden closing=${golden.closingBalance} actual=${summary.closingBalance}`);
  return closingMatch && cashInMatch && cashOutMatch;
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
    const rz = await runRoznamchaChecks(page, expectedLoader);
    if (MODE === 'baseline') {
      fs.mkdirSync(EVIDENCE, { recursive: true });
      fs.writeFileSync(path.join(EVIDENCE, 'roznamcha-legacy-golden.json'), JSON.stringify({
        capturedAt: new Date().toISOString(),
        mode: 'baseline',
        baseUrl: BASE,
        dateRange: { from: '2000-01-01', to: new Date().toISOString().slice(0, 10) },
        branchId: 'all',
        accountFilter: 'all',
        includeVoidedReversed: false,
        ...rz.summary,
        mainLoader: rz.mainLoader,
      }, null, 2));
      log('legacy golden captured', 'PASS');
    }
    if (expectedLoader === 'unified') compareToGolden(rz.summary);
    await verifyAccountStatementUnified(page);
    await verifyPartyLedgerUnified(page);
    await verifyTrialBalanceUnified(page);
    await verifyLedgerV2Unified(page);
    await verifyPilotBatch(page);
    const pass = rz.ok && checks.every((c) => c.result === 'PASS' || c.result === 'WAIVED');
    const mdName = soakModes.includes(MODE)
      ? `production-loader-soak-${MODE.replace('soak-', '')}.md`
      : MODE === 'rollback' ? 'rollback-qa.md' : MODE === 'candidate' ? 'candidate-qa.md' : 'baseline-qa.md';
    const md = [`# Phase 2.14 Roznamcha loader QA — ${MODE}`, '', `**Overall:** ${pass ? 'PASS' : 'FAIL'}`, '', ...checks.map((c) => `- [${c.result}] ${c.check}${c.notes ? ` — ${c.notes}` : ''}`)].join('\n');
    fs.mkdirSync(EVIDENCE, { recursive: true });
    fs.writeFileSync(path.join(EVIDENCE, mdName), md);
    console.log(`\nPhase 2.14 browser QA (${MODE}): ${pass ? 'PASS' : 'FAIL'}`);
    process.exit(pass ? 0 : 1);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
