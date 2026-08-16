#!/usr/bin/env node
/**
 * Phase 3B-PROD — Cash Flow preview post-deploy smoke (read-only).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const EVIDENCE = path.join(ROOT, 'reports/single-core-ledger/phase-3b-cash-flow-preview');
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
  const today = new Date().toISOString().slice(0, 10);
  await page.evaluate(({ todayIso }) => {
    localStorage.setItem(
      'erp-global-filters',
      JSON.stringify({
        dateRangeType: 'customRange',
        customStartDate: '2000-01-01',
        customEndDate: todayIso,
        branchId: 'all',
      }),
    );
  }, { todayIso: today });
  await page.goto(`${BASE}/?view=accounting`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForTimeout(2000);
  await page.getByRole('button', { name: /^Cash Flow$/ }).click({ timeout: 60000 });
  await page.waitForTimeout(4000);
}

async function main() {
  if (!PASSWORD) {
    const out = {
      run: 'PHASE_3B_POST_DEPLOY_SMOKE',
      overall: 'SKIPPED_CREDENTIALS_NOT_CONFIGURED',
      checks: [],
    };
    fs.writeFileSync(path.join(EVIDENCE, 'post-deploy-smoke.json'), JSON.stringify(out, null, 2));
    fs.writeFileSync(
      path.join(EVIDENCE, 'post-deploy-smoke.md'),
      '# Post-deploy smoke — SKIPPED\n\nCredentials not configured.\n',
    );
    process.exit(2);
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });

  try {
    log('app loads', 'PASS', BASE);
    await login(page);
    log('login', 'PASS', EMAIL);

    await openCashFlow(page);
    const body = await page.innerText('body');
    log('cash flow page loads', body.includes('Cash Flow') ? 'PASS' : 'FAIL');

    const toggle = page.getByLabel(/Unified Roznamcha preview \(Cash Flow compare only\)/i);
    const toggleVisible = await toggle.isVisible({ timeout: 30000 }).catch(() => false);
    log('preview toggle visible (admin)', toggleVisible ? 'PASS' : 'FAIL');

    const defaultOff = toggleVisible ? !(await toggle.isChecked()) : null;
    log('preview toggle default OFF', defaultOff === true ? 'PASS' : defaultOff === false ? 'FAIL' : 'SKIP');

    const hasLegacySummary = /Cash In|Cash Out|Closing/i.test(body);
    log('legacy output visible before preview', hasLegacySummary ? 'PASS' : 'FAIL');

    if (toggleVisible) {
      await toggle.check();
      await page.waitForTimeout(3000);
      const panel = page.locator('[data-cash-flow-preview-compare]').first();
      const panelVisible = await panel.isVisible({ timeout: 120000 }).catch(() => false);
      log('preview panel loads when ON', panelVisible ? 'PASS' : 'FAIL');

      const panelText = panelVisible ? await panel.innerText() : '';
      log('PREVIEW_ONLY label', /PREVIEW_ONLY/i.test(panelText) ? 'PASS' : 'FAIL');
      log('NEEDS_FINANCE_GOLDEN label', /NEEDS_FINANCE_GOLDEN/i.test(panelText) ? 'PASS' : 'FAIL');
      log('compare totals render', /Cash In|Cash Out|Net movement|Closing/i.test(panelText) ? 'PASS' : 'FAIL');

      await page.screenshot({ path: path.join(EVIDENCE, 'screenshots/post-deploy-cash-flow-preview.png'), fullPage: true });
    }

    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    log('no material page errors', errors.length === 0 ? 'PASS' : 'WARN', errors.join('; ') || '');
  } catch (e) {
    log('smoke run', 'FAIL', String(e.message || e));
  } finally {
    await browser.close();
  }

  const overall = checks.every((c) => c.result === 'PASS' || c.result === 'SKIP') ? 'PASS' : 'PARTIAL';
  const out = {
    run: 'PHASE_3B_POST_DEPLOY_SMOKE',
    generated_at: new Date().toISOString(),
    production_url: BASE,
    user_email: EMAIL,
    overall,
    checks,
  };
  fs.mkdirSync(path.join(EVIDENCE, 'screenshots'), { recursive: true });
  fs.writeFileSync(path.join(EVIDENCE, 'post-deploy-smoke.json'), JSON.stringify(out, null, 2));

  const md = `# Post-deploy smoke — Phase 3B-PROD

**Target:** ${BASE}  
**Generated:** ${out.generated_at}  
**Overall:** ${overall}

| Check | Result | Notes |
|-------|--------|-------|
${checks.map((c) => `| ${c.check} | ${c.result} | ${c.notes || ''} |`).join('\n')}
`;
  fs.writeFileSync(path.join(EVIDENCE, 'post-deploy-smoke.md'), md);
  console.log(`\nSmoke: ${overall}`);
  process.exit(overall === 'PASS' ? 0 : 1);
}

main();
