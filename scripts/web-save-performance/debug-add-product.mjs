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
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 120000 });
await page.fill('input[type="email"]', EMAIL);
await page.fill('input[type="password"]', PASSWORD);
await page.click('button[type="submit"]');
await page.waitForTimeout(8000);
await page.goto(`${BASE}/?view=sales`, { waitUntil: 'networkidle', timeout: 120000 });
await page.getByRole('button', { name: /Create New/i }).click();
await page.getByRole('menuitem', { name: /New Invoice/i }).click();
await page.waitForTimeout(3000);
await page.getByRole('button', { name: /Search products by name, SKU/i }).first().click();
await page.getByPlaceholder(/Search by name, SKU, or numeric code/i).fill('a');
await page.waitForTimeout(2500);
const cmdkCount = await page.locator('[cmdk-item]').count();
console.log('cmdk items:', cmdkCount);
if (cmdkCount > 0) await page.locator('[cmdk-item]').first().click();
await page.waitForTimeout(2000);
const varBtn = page.locator('button').filter({ hasText: /Size|Color|variation/i }).first();
if (await varBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
  await varBtn.click();
  await page.waitForTimeout(500);
}
const inlineVar = page.locator('[data-inline-variation], button').filter({ hasText: /^[A-Z0-9]/ }).first();
const useSearchVisible = await page.getByText('Use search to add items').isVisible().catch(() => false);
const toasts = await page.locator('[data-sonner-toast]').allTextContents().catch(() => []);
const rows = await page.locator('input[type="number"]').count();
console.log(JSON.stringify({ useSearchVisible, toasts, qtyInputs: rows }, null, 2));
await browser.close();
