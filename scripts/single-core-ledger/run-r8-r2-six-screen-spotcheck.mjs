#!/usr/bin/env node
/**
 * Read-only post-R8-R2 production spot-check for six approved main-loader screens.
 * Navigation mirrors phase-216 monitoring helpers. Does not mutate flags/GL/goldens/kill.
 */
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { readVisibleMainLoaderAttr, waitForTrialBalanceTotals } from './unifiedLedgerBrowserQaHelpers.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const envLocal = path.join(ROOT, '.env.local');
if (fs.existsSync(envLocal)) dotenv.config({ path: envLocal });

const BASE = process.env.QA_BROWSER_BASE_URL || 'https://erp.dincouture.pk';
const EMAIL = process.env.QA_BROWSER_EMAIL_CHINA || process.env.QA_BROWSER_EMAIL || 'din@yahoo.com';
const PASSWORD = process.env.QA_BROWSER_PASSWORD_CHINA || process.env.QA_BROWSER_PASSWORD || '';
const GOTO_MS = Number(process.env.QA_BROWSER_GOTO_TIMEOUT_MS || 120000);
const OUT_DIR = path.join(ROOT, 'reports/r8-r2-production-verification-20260717');

async function login(page) {
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: GOTO_MS });
  const emailInput = page.locator('input[type="email"], input[name="email"]').first();
  await emailInput.waitFor({ state: 'visible', timeout: 90000 });
  await emailInput.fill(EMAIL);
  await page.locator('input[type="password"]').first().fill(PASSWORD);
  await page.getByRole('button', { name: /sign in|log in|login/i }).first().click();
  await page.getByText(/DIN CHINA/i).first().waitFor({ timeout: 120000 });
  await page.waitForTimeout(2000);
}

async function openAccountingTab(page, tabName) {
  await page.goto(`${BASE}/?view=accounting`, { waitUntil: 'domcontentloaded', timeout: GOTO_MS });
  await page.waitForLoadState('networkidle', { timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(2000);
  const tab = page.getByRole('button', { name: new RegExp(`^${tabName}$`) });
  await tab.first().waitFor({ state: 'visible', timeout: 90000 });
  await tab.first().click({ timeout: 60000 });
  await page.waitForTimeout(3000);
}

async function collectConsole(page, fn) {
  const errors = [];
  const onConsole = (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  };
  const onPageError = (err) => errors.push(String(err));
  page.on('console', onConsole);
  page.on('pageerror', onPageError);
  try {
    return { result: await fn(), errors };
  } finally {
    page.off('console', onConsole);
    page.off('pageerror', onPageError);
  }
}

function materialConsole(errors) {
  // Align with phase-216: transient HTTP 502 alone is noise; flag rpc/supabase/unified/assert failures.
  return errors.filter((t) => /rpc|supabase|unified|legacy main loader retired|assertUnified|ReferenceError/i.test(t));
}

async function checkOne(page, screen) {
  const { result, errors } = await collectConsole(page, async () => {
    await screen.run(page);
    const loader = await readVisibleMainLoaderAttr(page, screen.loaderAttr).catch(async () =>
      page.locator(`[${screen.loaderAttr}]`).first().getAttribute(screen.loaderAttr),
    );
    const body = await page.innerText('body');
    const companyScope = /DIN CHINA/i.test(body);
    const filters = /date|from|to|period|branch|company|filter|fy|financial|1 Oct 2025/i.test(body);
    const dataOk = screen.dataRe.test(body) && !/legacy main loader retired/i.test(body);
    const failClosed = /legacy main loader retired|Main loader source must be unified/i.test(body);
    return { loader, companyScope, filters, dataOk, failClosed, snip: body.replace(/\s+/g, ' ').slice(0, 220) };
  });
  const consoleMaterial = materialConsole(errors);
  const pass =
    result.loader === 'unified' &&
    result.dataOk &&
    result.companyScope &&
    !result.failClosed &&
    consoleMaterial.length === 0;
  console.log(
    `[${pass ? 'PASS' : 'FAIL'}] ${screen.name} loader=${result.loader} data=${result.dataOk} filters=${result.filters} scope=${result.companyScope} consoleMat=${consoleMaterial.length}`,
  );
  if (!pass) console.log('  snip:', result.snip);
  if (consoleMaterial.length) console.log('  console:', consoleMaterial.slice(0, 3).join(' || '));
  return {
    id: screen.id,
    name: screen.name,
    routeOk: true,
    loaderValue: result.loader,
    loaderUnified: result.loader === 'unified',
    dataHint: result.dataOk,
    filtersHint: result.filters,
    companyScopeHint: result.companyScope,
    failClosed: result.failClosed,
    consoleErrors: consoleMaterial,
    pass,
  };
}

const SCREENS = [
  {
    id: 'roznamcha',
    name: 'Roznamcha',
    loaderAttr: 'data-roznamcha-main-loader',
    dataRe: /Cash In|Cash Out|Closing|Roznamcha/i,
    run: async (page) => {
      await openAccountingTab(page, 'Roznamcha');
      await page.locator('[data-roznamcha-main-loader]').first().waitFor({ timeout: 180000 });
      await page.waitForTimeout(8000);
    },
  },
  {
    id: 'account_statement',
    name: 'Account Statement',
    loaderAttr: 'data-account-statement-main-loader',
    dataRe: /Closing balance|Account Statements|Current Receivable|Opening/i,
    run: async (page) => {
      await openAccountingTab(page, 'Account Statements');
      await page.getByRole('button', { name: /Advanced \(effective \/ audit\)/i }).click({ timeout: 30000 }).catch(() => {});
      await page.getByRole('button', { name: /load mr jalil/i }).click({ timeout: 120000 });
      await page.locator('[data-account-statement-main-loader]').first().waitFor({ timeout: 180000 });
      await page.waitForTimeout(8000);
    },
  },
  {
    id: 'cash_flow',
    name: 'Cash Flow',
    loaderAttr: 'data-cash-flow-main-loader',
    dataRe: /Cash Flow|Operating|Cash In|Cash Out|Opening/i,
    run: async (page) => {
      await openAccountingTab(page, 'Cash Flow');
      await page.locator('[data-cash-flow-main-loader]').first().waitFor({ timeout: 180000 });
      await page.waitForTimeout(10000);
    },
  },
  {
    id: 'trial_balance',
    name: 'Trial Balance',
    loaderAttr: 'data-trial-balance-main-loader',
    dataRe: /Trial Balance|Total Debit|Total Credit|Debit|Credit/i,
    run: async (page) => {
      await page.goto(`${BASE}/?view=reports`, { waitUntil: 'domcontentloaded', timeout: GOTO_MS });
      await page.waitForTimeout(3000);
      await page.getByRole('button', { name: /^Financial$/ }).click({ timeout: 60000 });
      await page.waitForTimeout(2000);
      await page.getByRole('button', { name: /^Trial Balance$/ }).click({ timeout: 60000 });
      await page.locator('[data-trial-balance-main-loader]').first().waitFor({ timeout: 180000 });
      await waitForTrialBalanceTotals(page).catch(() => {});
      await page.waitForTimeout(5000);
    },
  },
  {
    id: 'party_ledger',
    name: 'Party Ledger',
    loaderAttr: 'data-party-ledger-main-loader',
    dataRe: /Party Ledger|Current Receivable|Closing|Load MR JALIL/i,
    run: async (page) => {
      await page.goto(`${BASE}/?view=party-ledger`, { waitUntil: 'domcontentloaded', timeout: GOTO_MS });
      await page.getByRole('button', { name: /load mr jalil/i }).click({ timeout: 120000 }).catch(() => {});
      await page.locator('[data-party-ledger-main-loader]').first().waitFor({ timeout: 180000 });
      await page.waitForTimeout(8000);
    },
  },
  {
    id: 'ledger_v2',
    name: 'Ledger V2',
    loaderAttr: 'data-ledger-v2-main-loader',
    dataRe: /Closing balance|Current Receivable|Account Statements|Statement/i,
    run: async (page) => {
      await page.goto(`${BASE}/reports/ledger-statement-center-v2`, { waitUntil: 'domcontentloaded', timeout: GOTO_MS });
      await page.waitForTimeout(3000);
      const tabBtn = page.locator('button').filter({ hasText: /^Account Statements$/ });
      if (await tabBtn.count()) await tabBtn.first().click();
      await page.getByRole('button', { name: /load mr jalil/i }).click({ timeout: 120000 });
      await page.getByText(/Closing balance|Current Receivable/i).first().waitFor({ timeout: 120000 }).catch(() => {});
      await page.locator('[data-ledger-v2-main-loader]').first().waitFor({ timeout: 180000 });
      await page.waitForTimeout(8000);
    },
  },
];

async function main() {
  if (!PASSWORD) {
    console.error('Set QA_BROWSER_PASSWORD_CHINA (or QA_BROWSER_PASSWORD)');
    process.exit(1);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  console.log(`=== R8-R2 six-screen spot-check ===`);
  console.log(`BASE=${BASE} email=${EMAIL} gotoTimeoutMs=${GOTO_MS}`);
  await login(page);

  const buildCommit = await page.evaluate(async () => {
    try {
      const scripts = [...document.querySelectorAll('script[src*="/assets/index-"]')];
      const src = scripts[0]?.getAttribute('src');
      if (!src) return null;
      const js = await (await fetch(src)).text();
      const m = js.match(/VITE_BUILD_COMMIT["']?\s*[:=]\s*["']([a-f0-9]+)/);
      return m?.[1] || null;
    } catch {
      return null;
    }
  });
  console.log(`buildCommit=${buildCommit || 'n/a'}`);

  const results = [];
  for (const screen of SCREENS) {
    try {
      results.push(await checkOne(page, screen));
    } catch (err) {
      console.log(`[FAIL] ${screen.name} exception: ${err?.message || err}`);
      results.push({
        id: screen.id,
        name: screen.name,
        routeOk: false,
        loaderValue: null,
        loaderUnified: false,
        dataHint: false,
        filtersHint: false,
        companyScopeHint: false,
        consoleErrors: [String(err?.message || err)],
        pass: false,
      });
    }
  }
  await browser.close();

  const payload = {
    generatedAt: new Date().toISOString(),
    base: BASE,
    email: EMAIL,
    gotoTimeoutMs: GOTO_MS,
    buildCommit,
    overall: results.every((r) => r.pass) ? 'PASS' : 'FAIL',
    results,
  };
  fs.writeFileSync(path.join(OUT_DIR, 'six-screen-spotcheck.json'), JSON.stringify(payload, null, 2));
  fs.writeFileSync(
    path.join(OUT_DIR, 'six-screen-spotcheck.md'),
    [
      '# R8-R2 six-screen production spot-check',
      '',
      `**Generated:** ${payload.generatedAt}`,
      `**Overall:** ${payload.overall}`,
      `**VITE_BUILD_COMMIT (from bundle):** ${payload.buildCommit || 'n/a'}`,
      `**Goto timeout:** ${GOTO_MS}ms (preserved; same as monitoring)`,
      '',
      '| Screen | Loader | Data | Filters | Company scope | Console | Result |',
      '|---|---|---|---|---|---|---|',
      ...results.map(
        (r) =>
          `| ${r.name} | ${r.loaderValue || 'missing'} | ${r.dataHint ? 'OK' : 'FAIL'} | ${r.filtersHint ? 'OK' : 'n/a'} | ${r.companyScopeHint ? 'OK' : 'FAIL'} | ${r.consoleErrors.length} | ${r.pass ? 'PASS' : 'FAIL'} |`,
      ),
      '',
    ].join('\n'),
  );
  console.log(`OVERALL ${payload.overall}`);
  if (payload.overall !== 'PASS') process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
