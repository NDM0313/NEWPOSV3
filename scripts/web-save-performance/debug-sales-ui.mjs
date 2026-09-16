#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const out = path.join(ROOT, 'reports/web-sales-purchase-save-performance-deploy-20260705');

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

const EMAIL = process.env.QA_BROWSER_EMAIL_CHINA || process.env.QA_BROWSER_EMAIL || 'din@yahoo.com';
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
await page.waitForTimeout(4000);
const buttons = [...new Set((await page.locator('button').allTextContents()).map((t) => t.trim()).filter(Boolean))];
console.log(JSON.stringify({ buttons: buttons.slice(0, 50), hasAddSale: buttons.some((b) => /add sale/i.test(b)) }, null, 2));
await page.screenshot({ path: path.join(out, 'debug-sales-page.png') });
await browser.close();
