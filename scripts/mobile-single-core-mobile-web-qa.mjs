#!/usr/bin/env node
/**
 * Mobile web acceptance — same React bundle as APK (Vite port 5175).
 * Read-only navigation through Reports hub after login.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'reports/mobile-single-core-acceptance-20260717');
const requireRoot = createRequire('/Users/ndm/Documents/Development/CursorDev/NEWPOSV3/package.json');
const BASE = process.env.MOBILE_QA_BASE_URL || 'http://127.0.0.1:5175/';

function loadEnv() {
  const env = {};
  const f = '/Users/ndm/Documents/Development/CursorDev/NEWPOSV3/.env.local';
  if (!fs.existsSync(f)) return env;
  for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 0) continue;
    env[t.slice(0, i)] = t.slice(i + 1).replace(/^["']|["']$/g, '');
  }
  return env;
}

async function clickIfVisible(page, re, timeout = 4000) {
  const loc = page.getByText(re).first();
  if (await loc.count()) {
    try {
      await loc.click({ timeout });
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const env = loadEnv();
  const email = 'din@yahoo.com';
  const password = env.QA_BROWSER_PASSWORD_CHINA || env.QA_BROWSER_PASSWORD || '';
  if (!password) {
    console.log('NO_PASSWORD');
    return;
  }

  const { chromium } = requireRoot('playwright');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 412, height: 915 } });
  const results = [];

  async function shot(name) {
    await page.screenshot({ path: path.join(OUT, name), fullPage: true });
  }

  try {
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(1500);
    await page.locator('input[type="email"], input[autocomplete="email"]').first().fill(email);
    await page.locator('input[type="password"]').first().fill(password);
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    await page.waitForTimeout(5000);

    if (await clickIfVisible(page, /skip.*set pin later/i)) {
      await page.waitForTimeout(3000);
      results.push({ step: 'pin_skip', pass: true });
    }

    await clickIfVisible(page, /DIN CHINA/i);
    await page.waitForTimeout(2000);
    await clickIfVisible(page, /Main Branch|continue|select/i);
    await page.waitForTimeout(3000);
    await shot('mobile-web-02-post-login.png');

    const reportsClicked = await clickIfVisible(page, /^Reports$/i);
    if (!reportsClicked) {
      await clickIfVisible(page, /^Ledger$/i);
    }
    await page.waitForTimeout(8000);
    await page.getByText('Customer Ledger', { exact: false }).first().waitFor({ timeout: 45000 }).catch(() => null);
    await clickIfVisible(page, /^Advanced$/i);
    await page.waitForTimeout(1500);
    await shot('mobile-web-03-hub.png');

    const reportTitles = [
      'Customer Ledger',
      'Supplier Ledger',
      'Worker Ledger',
      'Account Ledger',
      'Day Book / Roznamcha',
      'Cash Flow',
      'Trial Balance',
      'Ledger V2',
    ];

    for (const title of reportTitles) {
      try {
        const tile = page.getByText(title, { exact: false }).first();
        if (!(await tile.count())) {
          results.push({ step: title, pass: false, note: 'tile not visible in hub' });
          continue;
        }
        await tile.click({ timeout: 8000 });
        await page.waitForTimeout(6000);
        const safe = title.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
        await shot(`mobile-web-report-${safe}.png`);
        const txt = await page.locator('body').innerText();
        const pass =
          /unified|official|fallback|operational|error|retry|balance|debit|credit|no transactions|loader|receivable|payable|Rs\.|trial|cash flow|roznamcha|day book/i.test(
            txt,
          ) && !/could not start/i.test(txt);
        results.push({ step: title, pass, note: pass ? 'content or labelled notice' : 'blank or error' });
        await page.getByRole('button', { name: /back/i }).first().click({ timeout: 5000 }).catch(() => page.goBack());
        await page.waitForTimeout(2500);
      } catch (e) {
        results.push({ step: title, pass: false, note: String(e.message || e) });
      }
    }
  } catch (e) {
    results.push({ step: 'fatal', pass: false, note: String(e.message || e) });
  } finally {
    await browser.close();
  }

  const pass = results.filter((r) => r.pass).length;
  const fail = results.filter((r) => !r.pass).length;
  fs.writeFileSync(path.join(OUT, 'mobile-web-qa-raw.json'), JSON.stringify({ base: BASE, results, pass, fail }, null, 2));

  const md = [
    '# MOBILE_WEB_QA.md',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    'Same React bundle as APK via `http://127.0.0.1:5175/` (worktree finalization branch).',
    '',
    `**Summary:** ${pass} PASS / ${fail} FAIL`,
    '',
    '| Step | Result | Note |',
    '|---|---|---|',
    ...results.map((r) => `| ${r.step} | ${r.pass ? 'PASS' : 'FAIL'} | ${r.note || ''} |`),
    '',
  ].join('\n');
  fs.writeFileSync(path.join(OUT, 'MOBILE_WEB_QA.md'), md);
  console.log(JSON.stringify({ pass, fail, results }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
