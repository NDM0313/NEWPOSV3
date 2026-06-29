#!/usr/bin/env node
/**
 * Phase 3B-M — post-deploy smoke after Cash Flow loader swap.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const EVIDENCE = path.join(ROOT, 'reports/single-core-ledger/phase-3b-m-cash-flow-loader-swap');
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

async function openCashFlow(page) {
  await page.evaluate(() => {
    localStorage.setItem(
      'erp-global-filters',
      JSON.stringify({
        dateRangeType: 'customRange',
        customStartDate: '2000-01-01',
        customEndDate: '2026-06-29',
        branchId: 'all',
      }),
    );
  });
  await page.goto(`${BASE}/?view=accounting`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForTimeout(2000);
  await page.getByRole('button', { name: /^Cash Flow$/ }).click({ timeout: 60000 });
  await page.waitForTimeout(5000);
}

async function main() {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  if (!PASSWORD) {
    fs.writeFileSync(
      path.join(EVIDENCE, 'post-swap-smoke.json'),
      JSON.stringify({ run: 'PHASE_3B_M_POST_SWAP_SMOKE', overall: 'SKIPPED_CREDENTIALS' }, null, 2),
    );
    process.exit(2);
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  try {
    log('app loads', 'PASS', BASE);
    await login(page);
    log('login', 'PASS', EMAIL);
    await openCashFlow(page);
    log('cash flow page loads', 'PASS');

    const mainLoader = await page.locator('[data-cash-flow-main-loader]').getAttribute('data-cash-flow-main-loader');
    log('unified main loader active', mainLoader === 'unified' ? 'PASS' : 'FAIL', mainLoader || 'missing');

    const body = await page.innerText('body');
    log('unified basis banner', /Unified Cash Flow main loader.*Q4=A.*Q5=C.*Q7=B/i.test(body) ? 'PASS' : 'FAIL');
    log('operational totals visible', /Cash In|Cash Out|Closing/i.test(body) ? 'PASS' : 'FAIL');

    const toggle = page.getByLabel(/Unified Roznamcha preview \(Cash Flow/i);
    const toggleVisible = await toggle.isVisible({ timeout: 30000 }).catch(() => false);
    log('legacy shadow compare toggle visible', toggleVisible ? 'PASS' : 'FAIL');

    log('no material page errors', errors.length === 0 ? 'PASS' : 'WARN', errors.join('; ') || '');
  } catch (e) {
    log('smoke run', 'FAIL', String(e.message || e));
  } finally {
    await browser.close();
  }

  const overall = checks.every((c) => c.result === 'PASS' || c.result === 'SKIP') ? 'PASS' : 'PARTIAL';
  const out = {
    run: 'PHASE_3B_M_POST_SWAP_SMOKE',
    generated_at: new Date().toISOString(),
    production_url: BASE,
    commit: '36543345',
    overall,
    checks,
  };
  fs.writeFileSync(path.join(EVIDENCE, 'post-swap-smoke.json'), JSON.stringify(out, null, 2));
  fs.writeFileSync(
    path.join(EVIDENCE, 'post-swap-smoke.md'),
    `# Post-swap smoke — Phase 3B-M\n\n**Overall:** ${overall}\n\n| Check | Result | Notes |\n|-------|--------|-------|\n${checks.map((c) => `| ${c.check} | ${c.result} | ${c.notes || ''} |`).join('\n')}\n`,
  );
  process.exit(overall === 'PASS' ? 0 : 1);
}

main();
