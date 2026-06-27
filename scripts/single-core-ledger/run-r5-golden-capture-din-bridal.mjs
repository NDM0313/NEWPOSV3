#!/usr/bin/env node
/**
 * R5a — DIN BRIDAL legacy golden capture (read-only browser).
 * Flags must be OFF — captures legacy main loader values before R5 enablement.
 *
 * Requires:
 *   QA_BROWSER_PASSWORD
 *   QA_BROWSER_EMAIL — DIN BRIDAL user (not din@yahoo.com / DIN CHINA)
 * Optional:
 *   QA_BROWSER_BASE_URL (default https://erp.dincouture.pk)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import {
  parsePkr,
  readClosingBalance,
  readLedgerV2MrJalilClosing,
  readTrialBalanceTotals,
  waitForTrialBalanceTotals,
  withinTol,
} from './unifiedLedgerBrowserQaHelpers.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CONFIG_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), 'r5-company-config.json');
const EVIDENCE = path.join(ROOT, 'reports/single-core-ledger/din-bridal-monitoring/golden-capture');
const FIXTURE_PATH = path.join(ROOT, 'reports/single-core-ledger/din-bridal/golden-fixtures.json');

const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')).companies['din-bridal'];
const BASE = process.env.QA_BROWSER_BASE_URL || 'https://erp.dincouture.pk';
const EMAIL = process.env.QA_BROWSER_EMAIL || config.login_email_default;
const PASSWORD = process.env.QA_BROWSER_PASSWORD || '';
const PARTY_NAME = config.golden_party.name;
const PARTY_SEARCH = config.golden_party.search_pattern;
const COMPANY_ID = config.company_id;

const checks = [];

function log(check, result, notes = '') {
  checks.push({ check, result, notes });
  console.log(`[${result}] ${check}${notes ? ` — ${notes}` : ''}`);
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

async function readRoznamchaSummary(page) {
  await setWideRange(page);
  await page.goto(`${BASE}/?view=accounting`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.getByRole('button', { name: /^Roznamcha$/ }).click({ timeout: 60000 });
  await page.locator('[data-roznamcha-main-loader]').first().waitFor({ timeout: 180000 });
  await page.waitForTimeout(6000);
  const loader = await page.locator('[data-roznamcha-main-loader]').first().getAttribute('data-roznamcha-main-loader');
  const body = await page.innerText('body');
  const cashInM = body.match(/Cash In(?: Today)?[\s\n\r]+(?:Rs\.?\s*)?([\d,]+\.?\d*)/i);
  const cashOutM = body.match(/Cash Out(?: Today)?[\s\n\r]+(?:Rs\.?\s*)?([\d,]+\.?\d*)/i);
  const closingM = body.match(/Closing Balance[\s\n\r]+(?:Rs\.?\s*)?([\d,]+\.?\d*)/i);
  return {
    loader,
    cashIn: cashInM ? parsePkr(cashInM[1]) : NaN,
    cashOut: cashOutM ? parsePkr(cashOutM[1]) : NaN,
    closing: closingM ? parsePkr(closingM[1]) : NaN,
  };
}

async function selectGoldenPartyOnPartyLedger(page) {
  await setWideRange(page);
  await page.goto(`${BASE}/?view=party-ledger`, { waitUntil: 'networkidle', timeout: 120000 });
  const searchBtn = page.getByRole('button', { name: /search|select contact|choose/i }).first();
  if (await searchBtn.isVisible().catch(() => false)) {
    await searchBtn.click().catch(() => {});
  }
  const searchInput = page.getByPlaceholder(/search/i).first();
  if (await searchInput.isVisible().catch(() => false)) {
    await searchInput.fill(PARTY_SEARCH);
    await page.waitForTimeout(1500);
    await page.getByText(PARTY_NAME, { exact: false }).first().click({ timeout: 30000 }).catch(() => {});
  }
  await page.waitForTimeout(5000);
  const plLoader = await page.locator('[data-party-ledger-main-loader]').first().getAttribute('data-party-ledger-main-loader');
  const bodyPl = await page.innerText('body');
  const plM = bodyPl.match(/Current Receivable[\s\n\r]+(?:Rs\.?\s*)?([\d,]+\.?\d*)/i);
  const closing = plM ? parsePkr(plM[1]) : await readClosingBalance(page, { labels: ['Current Receivable', 'Closing balance'] });
  return { loader: plLoader, closing };
}

async function captureAccountStatement(page) {
  await setWideRange(page);
  await page.goto(`${BASE}/?view=accounting`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.getByRole('button', { name: /^Account Statements$/ }).click({ timeout: 60000 });
  const jalilBtn = page.getByRole('button', { name: /load mr jalil/i });
  if (await jalilBtn.isVisible().catch(() => false)) {
    log('company context', 'FAIL', 'DIN CHINA golden button visible — use DIN BRIDAL login email');
    return { loader: null, closing: NaN };
  }
  await page.waitForTimeout(5000);
  const loader = await page.locator('[data-account-statement-main-loader]').first().getAttribute('data-account-statement-main-loader');
  const closing = await readClosingBalance(page);
  return { loader, closing };
}

async function captureLedgerV2(page) {
  await setWideRange(page);
  await page.goto(`${BASE}/reports/ledger-statement-center-v2`, { waitUntil: 'networkidle', timeout: 120000 });
  const tabBtn = page.locator('button').filter({ hasText: /^Account Statements$/ });
  if (await tabBtn.count()) await tabBtn.first().click();
  const jalilBtn = page.getByRole('button', { name: /load mr jalil/i });
  if (await jalilBtn.isVisible().catch(() => false)) {
    return { loader: null, closing: NaN };
  }
  await page.waitForTimeout(5000);
  const loader = await page.locator('[data-ledger-v2-main-loader]').first().getAttribute('data-ledger-v2-main-loader');
  const closing = await readLedgerV2MrJalilClosing(page).catch(() => readClosingBalance(page));
  return { loader, closing };
}

async function captureTrialBalance(page) {
  await setWideRange(page);
  await page.goto(`${BASE}/?view=reports`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.getByRole('button', { name: /^Financial$/ }).click({ timeout: 60000 });
  await page.getByRole('button', { name: /^Trial Balance$/ }).click({ timeout: 60000 });
  await page.locator('[data-trial-balance-main-loader]').first().waitFor({ timeout: 180000 });
  await waitForTrialBalanceTotals(page);
  const loader = await page.locator('[data-trial-balance-main-loader]').first().getAttribute('data-trial-balance-main-loader');
  const { debit, credit } = await readTrialBalanceTotals(page);
  return { loader, debit, credit };
}

async function main() {
  if (!PASSWORD || !EMAIL || EMAIL === 'PENDING_OPERATOR') {
    const msg = [
      '# R5a golden capture — SKIPPED (credentials)',
      '',
      `**Date:** ${new Date().toISOString()}`,
      '',
      'Set before re-run:',
      '- `QA_BROWSER_PASSWORD`',
      `- \`QA_BROWSER_EMAIL\` — DIN BRIDAL user (company_id ` + COMPANY_ID + ')',
      '',
      'Manual capture checklist:',
      `1. Login as DIN BRIDAL user`,
      `2. Party: ${PARTY_NAME} closing on LV2 / AS / PL`,
      '3. Trial Balance debit = credit (all branches, wide range)',
      '4. Roznamcha Cash In / Out / Closing (legacy main loader)',
      '',
      'Existing RPC proxy baselines in `reports/single-core-ledger/din-bridal/golden-fixtures.json`.',
    ].join('\n');
    fs.mkdirSync(EVIDENCE, { recursive: true });
    fs.writeFileSync(path.join(EVIDENCE, 'golden-capture-skipped.md'), msg);
    console.error('SKIP: Set QA_BROWSER_PASSWORD and QA_BROWSER_EMAIL (DIN BRIDAL user)');
    process.exit(0);
  }

  fs.mkdirSync(path.join(EVIDENCE, 'screenshots'), { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const captured = { capturedAt: new Date().toISOString(), company: config.company, company_id: COMPANY_ID, party: PARTY_NAME };

  try {
    await login(page);
    log('login', 'PASS', EMAIL);

    const body = await page.innerText('body');
    if (/DIN CHINA/i.test(body) && !/DIN BRIDAL/i.test(body)) {
      log('company context DIN BRIDAL', 'WARN', 'Page may be DIN CHINA — verify QA_BROWSER_EMAIL is DIN BRIDAL user');
    }

    const pl = await selectGoldenPartyOnPartyLedger(page);
    captured.party_ledger = pl;
    log('Party Ledger legacy loader', pl.loader === 'legacy' || pl.loader === null ? 'PASS' : 'INFO', `loader=${pl.loader} closing=${pl.closing}`);
    await page.screenshot({ path: path.join(EVIDENCE, 'screenshots/party-ledger.png'), fullPage: true });

    const as = await captureAccountStatement(page);
    captured.account_statement = as;
    log('Account Statement', Number.isFinite(as.closing) ? 'PASS' : 'SKIP', `closing=${as.closing}`);

    const lv2 = await captureLedgerV2(page);
    captured.ledger_v2 = lv2;
    log('Ledger V2', Number.isFinite(lv2.closing) ? 'PASS' : 'SKIP', `closing=${lv2.closing}`);

    const tb = await captureTrialBalance(page);
    captured.trial_balance = tb;
    log('Trial Balance debit=credit', withinTol(tb.debit, tb.credit) ? 'PASS' : 'FAIL', `debit=${tb.debit} credit=${tb.credit}`);

    const rz = await readRoznamchaSummary(page);
    captured.roznamcha = rz;
    log('Roznamcha legacy loader', rz.loader === 'legacy' || rz.loader === null ? 'PASS' : 'INFO', `loader=${rz.loader}`);
    log('Roznamcha totals', Number.isFinite(rz.closing) ? 'PASS' : 'SKIP', `in=${rz.cashIn} out=${rz.cashOut} close=${rz.closing}`);
    await page.screenshot({ path: path.join(EVIDENCE, 'screenshots/roznamcha.png'), fullPage: true });

    fs.writeFileSync(path.join(EVIDENCE, 'golden-capture-raw.json'), JSON.stringify(captured, null, 2));

    const existing = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
    const rpcProxy = { ...existing.fixtures };
    const browserPartyClosing = Number.isFinite(pl.closing) ? pl.closing : null;
    const updated = {
      ...existing,
      capture_method: browserPartyClosing != null ? 'legacy_browser_partial' : 'rpc_shadow_only',
      browser_capture_at: captured.capturedAt,
      browser_capture_evidence: 'reports/single-core-ledger/din-bridal-monitoring/golden-capture/',
      fixtures: {
        ...existing.fixtures,
        ...(browserPartyClosing != null ? {
          golden_party_closing_pkr: browserPartyClosing,
          party_ledger_golden_party_closing_pkr: browserPartyClosing,
        } : {}),
        ...(Number.isFinite(tb.debit) ? {
          trial_balance_debit_pkr: tb.debit,
          trial_balance_credit_pkr: tb.credit,
        } : {}),
        ...(Number.isFinite(rz.cashIn) ? { roznamcha_cash_in_pkr: rz.cashIn } : {}),
        ...(Number.isFinite(rz.cashOut) ? { roznamcha_cash_out_pkr: rz.cashOut } : {}),
        ...(Number.isFinite(rz.closing) ? { roznamcha_closing_pkr: rz.closing } : {}),
      },
      rpc_proxy_baseline: rpcProxy,
      notes: [
        ...(existing.notes || []),
        browserPartyClosing != null
          ? `Browser capture ${captured.capturedAt} — party ledger closing updated from legacy UI.`
          : 'Browser capture incomplete — MR REHAN ALI party selection may need manual QA; RPC proxies retained.',
      ],
    };
    fs.writeFileSync(FIXTURE_PATH, JSON.stringify(updated, null, 2));

    const md = [
      '# DIN BRIDAL golden capture',
      '',
      `**Date:** ${captured.capturedAt}`,
      `**Email:** ${EMAIL}`,
      `**Party:** ${PARTY_NAME}`,
      '',
      ...checks.map((c) => `- [${c.result}] ${c.check}${c.notes ? ` — ${c.notes}` : ''}`),
      '',
      '## Captured values',
      '```json',
      JSON.stringify(captured, null, 2),
      '```',
    ].join('\n');
    fs.writeFileSync(path.join(EVIDENCE, 'golden-capture-report.md'), md);

    const ok = checks.filter((c) => c.result === 'FAIL').length === 0;
    console.log(`\nR5a golden capture: ${ok ? 'PASS' : 'PARTIAL'}`);
    process.exit(ok ? 0 : 1);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
