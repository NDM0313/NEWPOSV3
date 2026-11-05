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
const supplierText = await page.evaluate(() => {
  const combo = [...document.querySelectorAll('[role="combobox"]')].find((c) => c.offsetParent);
  return combo?.textContent?.trim();
});
const searchState = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find(
    (b) => b.offsetParent && /Search by name, SKU, or numeric code/i.test(b.textContent || ''),
  );
  return { disabled: btn?.disabled, text: btn?.textContent?.slice(0, 80) };
});
console.log(JSON.stringify({ supplierText, searchState }, null, 2));
await browser.close();
