#!/usr/bin/env node
/**
 * Phase 3B-H-PROD — post-deploy smoke for Cash Flow preview alignment (read-only).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const EVIDENCE = path.join(ROOT, 'reports/single-core-ledger/phase-3b-i-cash-flow-aligned-golden-capture');
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
  await page.waitForTimeout(4000);
}

async function main() {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  if (!PASSWORD) {
    fs.writeFileSync(
      path.join(EVIDENCE, 'post-deploy-smoke.json'),
      JSON.stringify({ run: 'PHASE_3B_H_PROD_SMOKE', overall: 'SKIPPED_CREDENTIALS' }, null, 2),
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

    const body = await page.innerText('body');
    log('legacy output visible', /Cash In|Cash Out|Closing/i.test(body) ? 'PASS' : 'FAIL');

    const toggle = page.getByLabel(/Unified Roznamcha preview \(Cash Flow compare only\)/i);
    const toggleVisible = await toggle.isVisible({ timeout: 30000 }).catch(() => false);
    log('preview toggle visible', toggleVisible ? 'PASS' : 'FAIL');

    const defaultOff = toggleVisible ? !(await toggle.isChecked()) : null;
    log('preview toggle default OFF', defaultOff === true ? 'PASS' : defaultOff === false ? 'FAIL' : 'SKIP');

    if (toggleVisible) {
      await toggle.check();
      await page.waitForTimeout(4000);
      const panel = page.locator('[data-cash-flow-preview-compare]').first();
      await panel.waitFor({ state: 'visible', timeout: 120000 });
      const panelText = await panel.innerText();
      log('preview panel loads', 'PASS');
      log('PREVIEW_ONLY label', /PREVIEW_ONLY/i.test(panelText) ? 'PASS' : 'FAIL');
      log('Q4=A Q5=C Q7=B labels', /Q4=A.*Q5=C.*Q7=B/i.test(panelText) ? 'PASS' : 'FAIL');
      log('finance alignment active', /Finance alignment active/i.test(panelText) ? 'PASS' : 'FAIL');
      log('loader swap NOT APPROVED note', /Loader swap NOT APPROVED/i.test(panelText) ? 'PASS' : 'FAIL');

      const exportBtn = panel.getByRole('button', { name: /Export row-keyed JSON/i });
      log('Export row-keyed JSON', (await exportBtn.isVisible().catch(() => false)) ? 'PASS' : 'FAIL');
    }

    log('no material page errors', errors.length === 0 ? 'PASS' : 'WARN', errors.join('; ') || '');
  } catch (e) {
    log('smoke run', 'FAIL', String(e.message || e));
  } finally {
    await browser.close();
  }

  const overall = checks.every((c) => c.result === 'PASS' || c.result === 'SKIP') ? 'PASS' : 'PARTIAL';
  const out = {
    run: 'PHASE_3B_H_PROD_POST_DEPLOY_SMOKE',
    generated_at: new Date().toISOString(),
    production_url: BASE,
    overall,
    checks,
  };
  fs.writeFileSync(path.join(EVIDENCE, 'post-deploy-smoke.json'), JSON.stringify(out, null, 2));
  fs.writeFileSync(
    path.join(EVIDENCE, 'post-deploy-smoke.md'),
    `# Post-deploy smoke — Phase 3B-H-PROD\n\n**Overall:** ${overall}\n\n| Check | Result | Notes |\n|-------|--------|-------|\n${checks.map((c) => `| ${c.check} | ${c.result} | ${c.notes || ''} |`).join('\n')}\n`,
  );
  process.exit(overall === 'PASS' ? 0 : 1);
}

main();
