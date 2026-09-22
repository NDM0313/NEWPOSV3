#!/usr/bin/env node
/**
 * Phase 2.11 — Account Statement loader browser QA.
 * Modes: baseline | candidate | rollback
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const EVIDENCE = path.join(ROOT, 'reports/single-core-ledger/phase-2-11-account-statement-loader');
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

async function openAdvancedAccountStatement(page) {
  await setWideRange(page);
  await page.goto(`${BASE}/?view=accounting`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForTimeout(4000);
  await page.getByRole('button', { name: /^Account Statements$/ }).click({ timeout: 60000 });
  await page.waitForTimeout(2000);
  await page.getByRole('button', { name: /Advanced \(effective \/ audit\)/i }).click({ timeout: 30000 });
  await page.waitForTimeout(3000);
}

async function readMainLoader(page) {
  const el = page.locator('[data-account-statement-main-loader]').first();
  return (await el.getAttribute('data-account-statement-main-loader').catch(() => null)) || 'missing';
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

async function runAccountStatementChecks(page, expectedLoader) {
  await openAdvancedAccountStatement(page);
  const mrBtn = page.getByRole('button', { name: /load mr jalil/i });
  if (await mrBtn.isVisible().catch(() => false)) await mrBtn.click();
  await page.waitForTimeout(8000);

  const mainLoader = await readMainLoader(page);
  log(`Account Statement main loader (${MODE})`, mainLoader === expectedLoader ? 'PASS' : 'FAIL', `expected=${expectedLoader} actual=${mainLoader}`);

  const closing = await readClosingBalance(page);
  log('MR JALIL closing 216300', Math.abs(closing - MR_JALIL) <= TOL ? 'PASS' : 'FAIL', `closing=${closing}`);

  const toggle = page.getByRole('checkbox', { name: /unified engine preview \(compare only\)/i });
  if (await toggle.isVisible().catch(() => false)) {
    await toggle.setChecked(true);
    await page.waitForTimeout(5000);
    const compareSource = await page.locator('[data-account-statement-preview-compare-source]').first().getAttribute('data-account-statement-preview-compare-source');
    const expectedCompare = expectedLoader === 'unified' ? 'legacy_shadow' : 'unified_compare';
    log('preview compare source', compareSource === expectedCompare ? 'PASS' : 'FAIL', `expected=${expectedCompare} actual=${compareSource}`);
    await toggle.setChecked(false);
  }

  fs.mkdirSync(path.join(EVIDENCE, 'screenshots'), { recursive: true });
  await page.screenshot({ path: path.join(EVIDENCE, 'screenshots', `211-${MODE}-account-statement.png`), fullPage: true });
  return mainLoader === expectedLoader && Math.abs(closing - MR_JALIL) <= TOL;
}

async function main() {
  if (!PASSWORD) {
    console.error('Set QA_BROWSER_PASSWORD');
    process.exit(1);
  }
  const expectedLoader = MODE === 'candidate' ? 'unified' : 'legacy';
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await login(page);
    log('admin login', 'PASS');
    const asOk = await runAccountStatementChecks(page, expectedLoader);
    await verifyLedgerV2Unified(page);
    const pass = asOk && checks.every((c) => c.result === 'PASS' || c.result === 'WAIVED');
    const md = [`# Phase 2.11 Account Statement loader QA — ${MODE}`, '', `**Overall:** ${pass ? 'PASS' : 'FAIL'}`, '', ...checks.map((c) => `- [${c.result}] ${c.check}${c.notes ? ` — ${c.notes}` : ''}`)].join('\n');
    fs.mkdirSync(EVIDENCE, { recursive: true });
    fs.writeFileSync(path.join(EVIDENCE, `preview-${MODE}-qa.md`), md);
    console.log(`\nPhase 2.11 browser QA (${MODE}): ${pass ? 'PASS' : 'FAIL'}`);
    process.exit(pass ? 0 : 1);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
