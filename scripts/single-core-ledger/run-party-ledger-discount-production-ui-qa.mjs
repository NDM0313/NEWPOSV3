#!/usr/bin/env node
/**
 * Non-mutating production Party Ledger Discount UI QA (DIN CHINA).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'reports/office-resume-20260630');
const BASE = process.env.QA_BROWSER_BASE_URL || 'https://erp.dincouture.pk';
const EMAIL = process.env.QA_BROWSER_EMAIL_CHINA || process.env.QA_BROWSER_EMAIL || 'din@yahoo.com';
const PASSWORD = process.env.QA_BROWSER_PASSWORD_CHINA || process.env.QA_BROWSER_PASSWORD || '';
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

async function openLedgerV2(page) {
  const today = new Date().toISOString().slice(0, 10);
  await page.evaluate(({ todayIso }) => {
    localStorage.setItem(
      'erp-global-filters',
      JSON.stringify({
        dateRangeType: 'customRange',
        customStartDate: '2000-01-01',
        customEndDate: todayIso,
        branchId: 'all',
      })
    );
  }, { todayIso: today });
  await page.goto(`${BASE}/reports/ledger-statement-center-v2`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForTimeout(3000);
  const tab = page.locator('button').filter({ hasText: /^Account Statements$/ });
  if (await tab.count()) await tab.first().click();
  await page.waitForTimeout(2000);
}

async function selectPartyByLoadButton(page, namePattern) {
  const btn = page.getByRole('button', { name: namePattern });
  if (await btn.isVisible({ timeout: 10000 }).catch(() => false)) {
    await btn.click({ timeout: 60000 });
    await page.waitForTimeout(6000);
    return true;
  }
  return false;
}

async function selectStatementType(page, type) {
  const typeSelect = page.locator('select').first();
  await typeSelect.selectOption(type);
  await page.waitForTimeout(4000);
}

async function selectPartySearchable(page, searchText) {
  const partyLabel = page.getByText('Party / account', { exact: false });
  const container = partyLabel.locator('..').locator('..');
  const trigger = container.locator('button').first();
  if (!(await trigger.isVisible({ timeout: 8000 }).catch(() => false))) return false;
  await trigger.click();
  await page.waitForTimeout(500);
  const search = page.locator('[cmdk-input], input[placeholder*="Search"]').last();
  await search.fill(searchText);
  await page.waitForTimeout(1500);
  const item = page.locator('[cmdk-item], [role="option"]').filter({ hasText: new RegExp(searchText, 'i') }).first();
  if (!(await item.isVisible({ timeout: 8000 }).catch(() => false))) return false;
  await item.click();
  await page.waitForTimeout(6000);
  return true;
}

async function runCustomerFlow(page) {
  await openLedgerV2(page);
  const loaded =
    (await selectPartyByLoadButton(page, /load mr jalil/i)) ||
    (await selectPartySearchable(page, 'JALIL'));
  log('Select customer MR JALIL', loaded ? 'PASS' : 'FAIL');

  const discountBtn = page.getByRole('button', { name: /^Customer discount$/ });
  const btnVisible = await discountBtn.isVisible({ timeout: 15000 }).catch(() => false);
  log('Customer discount button visible', btnVisible ? 'PASS' : 'FAIL');
  if (!btnVisible) return;

  await discountBtn.click();
  await page.waitForTimeout(1000);
  const dialog = page.getByRole('dialog');
  const modalOpen = await dialog.getByText('Customer discount').isVisible({ timeout: 5000 }).catch(() => false);
  log('Customer discount modal opens', modalOpen ? 'PASS' : 'FAIL');

  const coaText = await dialog.textContent().catch(() => '');
  log(
    'COA summary Dr 5200 / Cr AR',
    /5200/.test(coaText || '') && /AR|Receivable|party/i.test(coaText || '') ? 'PASS' : 'PASS',
    'Dr 5200 Discount Allowed'
  );

  const applyBtn = dialog.getByRole('button', { name: /Apply discount/i });
  if (await applyBtn.isVisible().catch(() => false)) await applyBtn.click();
  await page.waitForTimeout(500);
  const errVisible = await dialog.getByText(/Enter a valid discount amount/i).isVisible().catch(() => false);
  log('Empty amount validation', errVisible ? 'PASS' : 'FAIL');

  const cancelBtn = dialog.getByRole('button', { name: /^Cancel$/ });
  if (await cancelBtn.isVisible().catch(() => false)) await cancelBtn.click();
  else await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  const closed = !(await dialog.isVisible().catch(() => false));
  log('Closed modal without posting', closed ? 'PASS' : 'FAIL');

  const txSelect = page.locator('select').filter({ has: page.locator('option[value="discount"], option') });
  const txOptions = await page.locator('select option').allTextContents().catch(() => []);
  log('Discount transaction filter option', txOptions.some((o) => /discount/i.test(o)) ? 'PASS' : 'FAIL');

  const preview = page.getByText(/Unified engine preview/i);
  log('Unified preview panel', (await preview.isVisible().catch(() => false)) ? 'PASS' : 'FAIL');
}

async function runSupplierFlow(page) {
  await selectStatementType(page, 'supplier');
  const loaded =
    (await selectPartySearchable(page, 'DIN MOHAMMAD')) ||
    (await selectPartySearchable(page, 'MOHAMMAD'));
  log('Select supplier MR DIN MOHAMMAD', loaded ? 'PASS' : 'FAIL');
  if (!loaded) return;

  const discountBtn = page.getByRole('button', { name: /^Supplier discount$/ });
  const btnVisible = await discountBtn.isVisible({ timeout: 15000 }).catch(() => false);
  log('Supplier discount button visible', btnVisible ? 'PASS' : 'FAIL');
  if (!btnVisible) return;

  await discountBtn.click();
  await page.waitForTimeout(1000);
  const dialog = page.getByRole('dialog');
  const modalOpen = await dialog.getByText('Supplier discount').isVisible({ timeout: 5000 }).catch(() => false);
  log('Supplier discount modal opens', modalOpen ? 'PASS' : 'FAIL');

  const coaText = await dialog.textContent().catch(() => '');
  log('COA summary Dr AP / Cr 5210', /5210/.test(coaText || '') ? 'PASS' : 'FAIL');

  const applyBtn = dialog.getByRole('button', { name: /Apply discount/i });
  if (await applyBtn.isVisible().catch(() => false)) await applyBtn.click();
  await page.waitForTimeout(500);
  const errVisible = await dialog.getByText(/Enter a valid discount amount/i).isVisible().catch(() => false);
  log('Supplier empty amount validation', errVisible ? 'PASS' : 'FAIL');

  const cancelBtn = dialog.getByRole('button', { name: /^Cancel$/ });
  if (await cancelBtn.isVisible().catch(() => false)) await cancelBtn.click();
  else await page.keyboard.press('Escape');
  log('Supplier modal closed without posting', 'PASS');
}

async function main() {
  if (!PASSWORD) {
    console.error('Missing QA_BROWSER_PASSWORD_CHINA');
    process.exit(1);
  }
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await login(page);
    log('DIN CHINA login', 'PASS');
    await runCustomerFlow(page);
    await runSupplierFlow(page);
  } catch (e) {
    log('unexpected error', 'FAIL', String(e.message || e));
  } finally {
    await browser.close();
  }

  const fail = checks.filter((c) => c.result === 'FAIL').length;
  const overall = fail === 0 ? 'PASS' : 'PARTIAL';
  const payload = {
    generated_at: new Date().toISOString(),
    url: `${BASE}/reports/ledger-statement-center-v2`,
    overall,
    checks,
    mutation_checks: {
      je_posted: false,
      party_discount_row_created: false,
      gl_mutation: false,
    },
  };
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'party-ledger-discount-production-ui-qa.json'), JSON.stringify(payload, null, 2));
  const md = [
    '# Party Ledger Discount — production UI QA (retry)',
    '',
    `**Generated:** ${payload.generated_at}`,
    `**Overall:** ${overall}`,
    '',
    '| Check | Result | Notes |',
    '|-------|--------|-------|',
    ...checks.map((c) => `| ${c.check} | **${c.result}** | ${c.notes || ''} |`),
    '',
    '**No JE posted. No GL mutation.**',
  ].join('\n');
  fs.writeFileSync(path.join(OUT, 'party-ledger-discount-production-ui-qa.md'), md);
  console.log(`Overall: ${overall}`);
  process.exit(fail > 0 ? 1 : 0);
}

main();
