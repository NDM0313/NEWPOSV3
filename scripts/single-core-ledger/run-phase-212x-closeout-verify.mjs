#!/usr/bin/env node
/**
 * Phase 2.12X closeout — read-only production verification (no flag changes).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const EVIDENCE = path.join(ROOT, 'reports/single-core-ledger/phase-2-12-trial-balance-loader');
const BASE = process.env.QA_BROWSER_BASE_URL || 'https://erp.dincouture.pk';
const EMAIL = process.env.QA_BROWSER_EMAIL || 'din@yahoo.com';
const PASSWORD = process.env.QA_BROWSER_PASSWORD || '';
const MR_JALIL = 216300;
const TB_TOTAL = 407957271.02;
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
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(5000);
}

async function setAllBranchesWide(page) {
  const today = new Date().toISOString().slice(0, 10);
  await page.evaluate(({ todayIso }) => {
    localStorage.setItem('erp-global-filters', JSON.stringify({
      dateRangeType: 'customRange', customStartDate: '2000-01-01', customEndDate: todayIso, branchId: 'all',
    }));
  }, { todayIso: today });
  await page.reload({ waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForTimeout(2000);
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

async function readStatCardValue(page, label) {
  const cards = page.locator('div.rounded-lg.border').filter({ has: page.getByText(label, { exact: true }) });
  const count = await cards.count().catch(() => 0);
  let best = NaN;
  for (let i = 0; i < count; i += 1) {
    const valueText = await cards.nth(i).locator('.text-lg.font-mono').first().textContent().catch(() => null);
    const n = parsePkr(valueText || '');
    if (Number.isFinite(n) && (Number.isNaN(best) || Math.abs(n) > Math.abs(best))) best = n;
  }
  return best;
}

async function main() {
  if (!PASSWORD) {
    console.error('Set QA_BROWSER_PASSWORD');
    process.exit(1);
  }
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await login(page);
    log('admin login', 'PASS');
    await setAllBranchesWide(page);

    // Account Statement (first — matches soak script order)
    await page.goto(`${BASE}/?view=accounting`, { waitUntil: 'networkidle', timeout: 120000 });
    await page.waitForTimeout(4000);
    await page.getByRole('button', { name: /^Account Statements$/ }).click({ timeout: 60000 });
    await page.getByRole('button', { name: /Advanced \(effective \/ audit\)/i }).click({ timeout: 30000 });
    await page.getByRole('button', { name: /load mr jalil/i }).click({ timeout: 120000 });
    await page.waitForTimeout(8000);
    const asLoader = await page.locator('[data-account-statement-main-loader]').first().getAttribute('data-account-statement-main-loader');
    const asClosing = await readClosingBalance(page);
    log('Account Statement main loader unified', asLoader === 'unified' ? 'PASS' : 'FAIL', `actual=${asLoader}`);
    log('Account Statement MR JALIL 216300', Math.abs(asClosing - MR_JALIL) <= TOL ? 'PASS' : 'FAIL', `closing=${asClosing}`);

    // Trial Balance
    await setAllBranchesWide(page);
    await page.goto(`${BASE}/?view=reports`, { waitUntil: 'networkidle', timeout: 120000 });
    await page.getByRole('button', { name: /^Financial$/ }).click({ timeout: 60000 });
    await page.getByRole('button', { name: /^Trial Balance$/ }).click({ timeout: 60000 });
    await page.locator('[data-trial-balance-main-loader]').first().waitFor({ timeout: 180000 });
    await page.waitForTimeout(5000);
    const tbLoader = await page.locator('[data-trial-balance-main-loader]').first().getAttribute('data-trial-balance-main-loader');
    log('Trial Balance main loader unified', tbLoader === 'unified' ? 'PASS' : 'FAIL', `actual=${tbLoader}`);
    const body = await page.innerText('body');
    const debitM = body.match(/Total Debit:\s*Rs\.?\s*([\d,]+\.?\d*)/i);
    const creditM = body.match(/Total Credit:\s*Rs\.?\s*([\d,]+\.?\d*)/i);
    const debit = debitM ? parsePkr(debitM[1]) : NaN;
    const credit = creditM ? parsePkr(creditM[1]) : NaN;
    log('Trial Balance debit = credit', Math.abs(debit - credit) <= TOL ? 'PASS' : 'FAIL', `debit=${debit} credit=${credit}`);
    log('Trial Balance total 407957271.02', Math.abs(debit - TB_TOTAL) <= TOL && Math.abs(credit - TB_TOTAL) <= TOL ? 'PASS' : 'FAIL', `debit=${debit}`);

    // Ledger V2 (last — same order as Phase 2.12 soak)
    await page.goto(`${BASE}/reports/ledger-statement-center-v2`, { waitUntil: 'networkidle', timeout: 120000 });
    await page.waitForTimeout(3000);
    const tabBtn = page.locator('button').filter({ hasText: /^Account Statements$/ });
    if (await tabBtn.count()) await tabBtn.first().click();
    await page.getByRole('button', { name: /load mr jalil/i }).click({ timeout: 120000 });
    await page.waitForTimeout(8000);
    const lv2Loader = await page.locator('[data-ledger-v2-main-loader]').first().getAttribute('data-ledger-v2-main-loader');
    const lv2Closing = await readClosingBalance(page);
    log('Ledger V2 main loader unified', lv2Loader === 'unified' ? 'PASS' : 'FAIL', `actual=${lv2Loader}`);
    log('Ledger V2 MR JALIL 216300', Math.abs(lv2Closing - MR_JALIL) <= TOL ? 'PASS' : 'FAIL', `closing=${lv2Closing}`);

    // Pilot batch
    await page.goto(`${BASE}/admin/unified-ledger-tieout`, { waitUntil: 'networkidle', timeout: 120000 });
    await page.getByRole('tab', { name: /Pilot Batch/i }).click({ timeout: 60000 });
    const runBtn = page.getByRole('button', { name: /Run DIN CHINA 9\/9 batch/i });
    if (await runBtn.isVisible().catch(() => false)) await runBtn.click();
    await page.waitForFunction(
      () => {
        const labels = [...document.querySelectorAll('.text-xs.text-gray-500')];
        const el = labels.find((l) => l.textContent?.trim() === 'Compared');
        const n = Number(String(el?.parentElement?.querySelector('.text-lg.font-mono')?.textContent || '').replace(/,/g, ''));
        return Number.isFinite(n) && n >= 9;
      },
      null,
      { timeout: 180000 },
    );
    const compared = await readStatCardValue(page, 'Compared');
    const passCount = await readStatCardValue(page, 'Pass');
    const failCount = await readStatCardValue(page, 'Fail');
    log('Admin Compare Pilot Batch 9/9', compared === 9 && passCount === 9 && failCount === 0 ? 'PASS' : 'FAIL', `compared=${compared} pass=${passCount} fail=${failCount}`);

    const pass = checks.every((c) => c.result === 'PASS');
    const md = [
      '# Phase 2.12X closeout — production screen verification',
      '',
      `**Date:** ${new Date().toISOString()}`,
      `**Overall:** ${pass ? 'PASS' : 'FAIL'}`,
      '',
      ...checks.map((c) => `- [${c.result}] ${c.check}${c.notes ? ` — ${c.notes}` : ''}`),
    ].join('\n');
    fs.mkdirSync(EVIDENCE, { recursive: true });
    fs.writeFileSync(path.join(EVIDENCE, 'phase-212x-closeout-screen-verify.md'), md);
    console.log(`\nCloseout screen verify: ${pass ? 'PASS' : 'FAIL'}`);
    process.exit(pass ? 0 : 1);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
