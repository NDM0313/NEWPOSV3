#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 1) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (!process.env[key]) process.env[key] = val;
  }
}
loadDotEnv(path.join(ROOT, '.env.qa.local'));
const EMAIL = process.env.QA_BROWSER_EMAIL_CHINA || 'din@yahoo.com';
const PASSWORD = process.env.QA_BROWSER_PASSWORD_CHINA || process.env.QA_BROWSER_PASSWORD || '';
const BASE = 'https://erp.dincouture.pk';

async function addProduct(page) {
  await page.locator('button:has-text("Search by name, SKU")').first().click({ timeout: 30000 });
  await page.waitForTimeout(1000);
  const cmdInput = page.locator('[cmdk-input], input[placeholder="Search by name, SKU, or numeric code..."]').first();
  await cmdInput.waitFor({ state: 'visible', timeout: 15000 });
  await cmdInput.fill('a');
  await page.waitForTimeout(2000);
  await page.locator('[cmdk-item]').first().click();
  await page.waitForTimeout(1500);
  const varSection = page.locator('text=Select Variation:').first().locator('..').locator('button');
  if (await varSection.first().isVisible({ timeout: 3000 }).catch(() => false)) {
    await varSection.first().click();
    await page.waitForTimeout(800);
  }
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 120000 });
await page.fill('input[type="email"]', EMAIL);
await page.fill('input[type="password"]', PASSWORD);
await page.click('button[type="submit"]');
await page.waitForTimeout(8000);
await page.getByRole('button', { name: /Create New/i }).click();
await page.getByRole('menuitem', { name: /New Purchase/i }).click();
await page.getByText('New Purchase Order').first().waitFor({ state: 'visible', timeout: 60000 });
await page.waitForTimeout(2000);

await page.evaluate(() => {
  const combo = [...document.querySelectorAll('[role="combobox"]')].find(
    (c) => c.offsetParent && /Select Supplier/i.test(c.textContent || ''),
  );
  combo?.click();
});
await page.getByPlaceholder('Search supplier...').fill('a');
await page.waitForTimeout(1000);
await page.getByRole('option').first().click();
await page.waitForTimeout(1000);

await addProduct(page);

const saveBtn = page.getByRole('button', { name: /^Save$/ }).first();
const t0 = Date.now();
await saveBtn.click();
await page.waitForFunction(() => {
  const saving = [...document.querySelectorAll('button')].some(
    (b) => b.offsetParent && /Saving/i.test(b.textContent || ''),
  );
  return !saving;
}, { timeout: 120000 });
const ms = Date.now() - t0;
const toasts = await page.locator('[data-sonner-toast]').allTextContents();
console.log(JSON.stringify({ saveMs: ms, toasts }, null, 2));
await browser.close();
