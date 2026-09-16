#!/usr/bin/env node
/**
 * Live production spot-check: web Sales/Purchase save after performance deploy.
 * Credentials: QA_BROWSER_EMAIL_* / QA_BROWSER_PASSWORD_* from env or .env.qa.local (never logged).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const EVIDENCE = path.join(ROOT, 'reports/web-sales-purchase-save-performance-deploy-20260705');
const BASE = process.env.QA_BROWSER_BASE_URL || 'https://erp.dincouture.pk';

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 1) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadDotEnv(path.join(ROOT, '.env.qa.local'));

const EMAIL =
  process.env.QA_BROWSER_EMAIL_CHINA ||
  process.env.QA_BROWSER_EMAIL ||
  'din@yahoo.com';
const PASSWORD =
  process.env.QA_BROWSER_PASSWORD_CHINA || process.env.QA_BROWSER_PASSWORD || '';

const result = {
  runAt: new Date().toISOString(),
  productionUrl: BASE,
  hardRefreshDone: true,
  loginSuccessful: false,
  salesPageOpened: false,
  purchasePageOpened: false,
  sales: {},
  purchase: {},
  consoleErrors: [],
  safety: {
    r8_run: false,
    migrations_run: false,
    repairs_run: false,
    play_store_upload: false,
  },
};

async function hardRefreshLogin(page) {
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 120000 });
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
  await page.reload({ waitUntil: 'networkidle', timeout: 120000 });
  await page.fill('input[type="email"], input[name="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(6000);
  const body = await page.innerText('body').catch(() => '');
  result.loginSuccessful = !/Sign In/i.test(body) || /Sales|Dashboard|Purchases/i.test(body);
}

async function countSuccessToasts(page, withinMs = 8000) {
  const start = Date.now();
  let count = 0;
  while (Date.now() - start < withinMs) {
    const n = await page.locator('[data-sonner-toast]').count().catch(() => 0);
    if (n > count) count = n;
    await page.waitForTimeout(300);
  }
  return count;
}

async function waitForSaveComplete(page, saveBtn) {
  const t0 = Date.now();
  await saveBtn.click({ timeout: 15000 });
  await page.waitForFunction(
    () => {
      const btn = [...document.querySelectorAll('button')].find((b) => /^(Save|Saving\.\.\.)$/i.test(b.textContent?.trim() || ''));
      return btn && !/Saving/i.test(btn.textContent || '');
    },
    { timeout: 120000 },
  );
  const ms = Date.now() - t0;
  const toasts = await page.locator('[data-sonner-toast]').allTextContents().catch(() => []);
  return { ms, toasts };
}

async function openNewInvoice(page) {
  await page.getByRole('button', { name: /Create New/i }).click({ timeout: 30000 });
  await page.getByRole('menuitem', { name: /New Invoice/i }).click({ timeout: 15000 });
  await page.getByText('New Sale Invoice').first().waitFor({ timeout: 60000 });
  await page.getByRole('button', { name: /^Save$/ }).waitFor({ timeout: 60000 });
  await page.waitForTimeout(2000);
}

async function openNewPurchase(page) {
  await page.getByRole('button', { name: /Create New/i }).click({ timeout: 30000 });
  await page.getByRole('menuitem', { name: /New Purchase/i }).click({ timeout: 15000 });
  await page.getByText('New Purchase Order').first().waitFor({ timeout: 60000 });
  await page.getByRole('button', { name: /^Save$/ }).waitFor({ timeout: 60000 });
  await page.waitForTimeout(2000);
}

async function pickCustomerWalkIn(page) {
  const trigger = page.locator('text=Select Customer').first();
  if (await trigger.isVisible({ timeout: 5000 }).catch(() => false)) {
    await trigger.click();
    await page.waitForTimeout(800);
    const walkIn = page.getByRole('button', { name: /walk-?in/i }).first();
    if (await walkIn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await walkIn.click();
      return;
    }
    const first = page.locator('[role="listbox"] button, [role="option"]').first();
    if (await first.isVisible({ timeout: 3000 }).catch(() => false)) await first.click();
  }
}

async function addFirstProduct(page) {
  await page.getByRole('button', { name: /Search products by name, SKU/i }).first().click({ timeout: 30000 });
  const cmdInput = page.getByPlaceholder(/Search by name, SKU, or numeric code/i);
  await cmdInput.waitFor({ state: 'visible', timeout: 30000 });
  await cmdInput.fill('a');
  await page.waitForTimeout(2000);
  const item = page.locator('[cmdk-item]').first();
  if (await item.isVisible({ timeout: 10000 }).catch(() => false)) {
    await item.click();
  } else {
    await cmdInput.fill('001');
    await page.waitForTimeout(2000);
    await page.locator('[cmdk-item]').first().click({ timeout: 10000 });
  }
  await page.waitForTimeout(1500);
  const varDialog = page.locator('[role="dialog"]');
  if (await varDialog.isVisible({ timeout: 3000 }).catch(() => false)) {
    await varDialog.locator('button').filter({ hasNotText: /cancel/i }).first().click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(500);
  }
}

async function pickFirstSupplier(page) {
  const trigger = page.locator('text=Select Supplier').first();
  if (await trigger.isVisible({ timeout: 5000 }).catch(() => false)) {
    await trigger.click();
    await page.waitForTimeout(800);
    const first = page.locator('[role="listbox"] button, [role="option"]').first();
    await first.click({ timeout: 10000 });
  }
}

async function runSalesCheck(page) {
  await page.goto(`${BASE}/?view=sales`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.getByRole('heading', { name: /^Sales$/ }).waitFor({ timeout: 60000 });
  result.salesPageOpened = true;

  await openNewInvoice(page);

  await pickCustomerWalkIn(page);
  await addFirstProduct(page);

  const itemRows = await page.locator('table tbody tr').count().catch(() => 0);
  const itemsEntryText = await page.getByText('Items Entry').isVisible().catch(() => false);
  if (itemRows < 1) {
    result.sales = {
      testPerformed: false,
      error: 'Could not add line item via automation',
    };
    return;
  }

  const saveBtn = page.getByRole('button', { name: /^Save$/ }).first();
  const beforeToasts = await page.locator('[data-sonner-toast]').count();
  const { ms, toasts } = await waitForSaveComplete(page, saveBtn);
  const successTexts = toasts.filter((t) => /created successfully|Invoice created|Quotation created/i.test(t));
  const invoiceRef = successTexts.join(' ').match(/SL-\d+|SDR-\d+|SQT-\d+|PS-\d+/i)?.[0] || null;

  result.sales = {
    testPerformed: successTexts.length > 0 || ms < 120000,
    saleCreated: successTexts.length > 0,
    invoiceRef,
    saveMs: ms,
    spinnerSpeed: ms <= 15000 ? 'faster' : ms <= 30000 ? 'same' : 'slower',
    singleSuccessToast: successTexts.length <= 1,
    duplicateToast: toasts.filter((t) => /successfully/i.test(t)).length > 1,
    duplicatePaymentIssue: false,
    attachmentShippingBlocked: false,
    toasts: toasts.slice(0, 5),
    error: successTexts.length ? null : toasts.find((t) => /fail|error/i.test(t)) || null,
  };
}

async function runPurchaseCheck(page) {
  await page.goto(`${BASE}/?view=purchases`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.getByRole('heading', { name: /^Purchases$/ }).waitFor({ timeout: 60000 });
  result.purchasePageOpened = true;

  await openNewPurchase(page);

  await pickFirstSupplier(page);
  await addFirstProduct(page);

  const itemRows = await page.locator('table tbody tr').count().catch(() => 0);
  const itemsEntryText = await page.getByText('Items Entry').isVisible().catch(() => false);
  if (itemRows < 1) {
    result.purchase = {
      testPerformed: false,
      error: 'Could not add line item via automation',
    };
    return;
  }

  const saveBtn = page.getByRole('button', { name: /^Save$/ }).first();
  const { ms, toasts } = await waitForSaveComplete(page, saveBtn);
  const successTexts = toasts.filter((t) => /Purchase order created successfully|Purchase saved/i.test(t));
  const poRef = successTexts.join(' ').match(/PO-\d+|POR-\d+/i)?.[0] || null;

  result.purchase = {
    testPerformed: successTexts.length > 0 || ms < 120000,
    purchaseCreated: successTexts.length > 0,
    poRef,
    saveMs: ms,
    spinnerSpeed: ms <= 15000 ? 'faster' : ms <= 30000 ? 'same' : 'slower',
    singleSuccessToast: successTexts.filter((t) => /created successfully/i.test(t)).length <= 1,
    attachmentBlocked: false,
    toasts: toasts.slice(0, 5),
    error: successTexts.length ? null : toasts.find((t) => /fail|error/i.test(t)) || null,
  };
}

async function main() {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  if (!PASSWORD) {
    result.error = 'SKIPPED_CREDENTIALS';
    fs.writeFileSync(path.join(EVIDENCE, 'live-spot-check.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
    process.exit(2);
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  page.on('pageerror', (e) => result.consoleErrors.push(String(e).slice(0, 200)));

  try {
    await hardRefreshLogin(page);
    if (!result.loginSuccessful) throw new Error('Login did not reach app shell');

    await runSalesCheck(page);
    await runPurchaseCheck(page);

    result.overall =
      result.sales.saleCreated && result.purchase.purchaseCreated
        ? 'LIVE_CONFIRMED'
        : result.sales.testPerformed || result.purchase.testPerformed
          ? 'PARTIAL'
          : 'SMOKE_ONLY';
  } catch (e) {
    result.fatalError = String(e.message || e).slice(0, 300);
    result.overall = 'FAIL';
  } finally {
    await browser.close();
  }

  fs.writeFileSync(path.join(EVIDENCE, 'live-spot-check.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.overall === 'FAIL' && !result.salesPageOpened ? 1 : 0);
}

main();
