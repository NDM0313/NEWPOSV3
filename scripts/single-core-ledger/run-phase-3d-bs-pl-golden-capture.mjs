#!/usr/bin/env node
/**
 * Phase 3D — BS/P&L candidate golden capture from production preview UI (read-only).
 * Evidence only — CANDIDATE_ONLY / NOT FINANCE APPROVED.
 *
 * Requires per-company QA_BROWSER_PASSWORD_* (same as monitoring).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { parsePkr } from './unifiedLedgerBrowserQaHelpers.mjs';
import {
  PROFILE_ORDER,
  resolveThreeCompanyProfileCredentials,
} from './monitoringCredentials.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PROFILES_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), 'monitoring-company-profiles.json');
const EVIDENCE = path.join(ROOT, 'reports/single-core-ledger/phase-3d-bs-pl-golden-capture');
const SCREENSHOTS = path.join(EVIDENCE, 'screenshots');
const EXPORTS = path.join(EVIDENCE, 'exports');
const BASE = process.env.QA_BROWSER_BASE_URL || 'https://erp.dincouture.pk';

const profilesRaw = JSON.parse(fs.readFileSync(PROFILES_PATH, 'utf8'));

function slug(profileId) {
  return profileId.replace(/-/g, '-');
}

function companyFilePrefix(profileId) {
  return profileId;
}

async function login(page, email, password) {
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
  await page.fill('input[type="email"], input[name="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(5000);
}

async function setWideRange(page) {
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
  await page.reload({ waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForTimeout(2000);
}

async function openFinancialReport(page, reportLabel) {
  await setWideRange(page);
  await page.goto(`${BASE}/?view=reports`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForTimeout(3000);
  await page.getByRole('button', { name: /^Financial$/ }).click({ timeout: 60000 });
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: new RegExp(`^${reportLabel}$`) }).click({ timeout: 60000 });
  await page.waitForTimeout(4000);
}

async function readFlexRow(root, label) {
  const row = root.locator('p.flex.justify-between').filter({ hasText: new RegExp(`^${label}$`) });
  const count = await row.count();
  for (let i = 0; i < count; i += 1) {
    const val = await row.nth(i).locator('span.tabular-nums').textContent().catch(() => null);
    const n = parsePkr(val || '');
    if (Number.isFinite(n)) return n;
  }
  return NaN;
}

async function readSectionCompare(panel, sectionTitle) {
  const section = panel.locator('div.rounded-lg.border').filter({
    has: panel.getByText(sectionTitle, { exact: true }),
  }).first();
  return {
    totalAssets: await readFlexRow(section, 'Total Assets'),
    liabilitiesAndEquity: await readFlexRow(section, 'Liabilities + Equity'),
    difference: await readFlexRow(section, 'A − \\(L+E\\)'.replace(/\\\\/g, '')) ||
      await readFlexRow(section, 'A − (L+E)'),
    revenue: await readFlexRow(section, 'Revenue'),
    costOfSales: await readFlexRow(section, 'Cost of Sales'),
    netProfit: await readFlexRow(section, 'Net Profit'),
  };
}

async function readDeltas(panel) {
  const text = await panel.innerText();
  const deltas = {};
  for (const key of ['Assets', 'Liabilities', 'Equity', 'L+E', 'Revenue', 'COGS', 'Expenses', 'Net Profit']) {
    const re = new RegExp(`${key.replace('+', '\\+')} Δ\\s*([\\d,.-]+)`, 'i');
    const m = text.match(re);
    deltas[key] = m ? parsePkr(m[1]) : null;
  }
  const pass = /Section totals match/i.test(text);
  const fail = /differences detected/i.test(text);
  return { deltas, pass: pass && !fail, comparePass: pass };
}

async function captureBalanceSheet(page, prefix, availability) {
  await openFinancialReport(page, 'Balance Sheet');
  const body = await page.innerText('body');
  const asOfM = body.match(/As at (\d{4}-\d{2}-\d{2})/i) || body.match(/As at\s+(\d{4}-\d{2}-\d{2})/);
  const asOfDate = asOfM ? asOfM[1] : new Date().toISOString().slice(0, 10);

  const checkbox = page.getByLabel(/Unified TB preview \(Balance Sheet compare only\)/i);
  const toggleVisible = await checkbox.isVisible({ timeout: 30000 }).catch(() => false);
  availability.balanceSheetToggleVisible = toggleVisible;
  const defaultOff = toggleVisible ? !(await checkbox.isChecked()) : null;
  availability.balanceSheetToggleDefaultOff = defaultOff;

  let legacyMain = {};
  const leM = body.match(/Total Liabilities \+ Equity[\s\n\r]+(?:Rs\.?\s*)?([\d,.-]+)/i);
  const assetsM = body.match(/Total Assets[\s\n\r]+(?:Rs\.?\s*)?([\d,.-]+)/i);
  legacyMain.totalLiabilitiesAndEquity = leM ? parsePkr(leM[1]) : NaN;
  legacyMain.totalAssets = assetsM ? parsePkr(assetsM[1]) : NaN;

  if (!toggleVisible) {
    return { status: 'BLOCKED', asOfDate, error: 'preview toggle not visible', legacyMain };
  }

  await checkbox.check();
  await page.waitForTimeout(2000);
  const panel = page.locator('[data-balance-sheet-preview-compare]').first();
  await panel.waitFor({ state: 'visible', timeout: 180000 });
  await page.waitForTimeout(3000);

  const legacy = await readSectionCompare(panel, 'Legacy (main)');
  const preview = await readSectionCompare(panel, 'Unified preview');
  const { deltas, pass } = await readDeltas(panel);
  const panelText = await panel.innerText();

  const screenshotPath = path.join(SCREENSHOTS, `${prefix}-balance-sheet-preview.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });

  let exportJson = null;
  const downloadPromise = page.waitForEvent('download', { timeout: 15000 }).catch(() => null);
  await panel.getByRole('button', { name: /Export compare JSON/i }).click().catch(() => {});
  const download = await downloadPromise;
  if (download) {
    const exportPath = path.join(EXPORTS, `${prefix}-balance-sheet-preview.json`);
    await download.saveAs(exportPath);
    try {
      exportJson = JSON.parse(fs.readFileSync(exportPath, 'utf8'));
    } catch {
      exportJson = { note: 'download saved but parse failed' };
    }
  } else {
    exportJson = {
      phase: '3D',
      screen: 'balance_sheet',
      asOfDate,
      legacy,
      preview,
      deltas,
      pass,
      note: 'CANDIDATE_ONLY — NOT FINANCE APPROVED — DOM scrape fallback',
      capturedAt: new Date().toISOString(),
    };
    fs.writeFileSync(
      path.join(EXPORTS, `${prefix}-balance-sheet-preview.json`),
      JSON.stringify(exportJson, null, 2),
    );
  }

  return {
    status: 'CAPTURED',
    asOfDate,
    branchScope: 'All Branches',
    legacy,
    preview,
    deltas,
    pass,
    retainedEarningsWarning: /retained earnings|P&L rollup/i.test(panelText),
    needsAccountingRuleConfirmation: /NEEDS_ACCOUNTING_RULE|NEEDS_RULE_CONFIRMATION/i.test(panelText),
    accountingRuleNotes: exportJson?.accountingRuleNotes ?? [],
    screenshot: `screenshots/${prefix}-balance-sheet-preview.png`,
    export: `exports/${prefix}-balance-sheet-preview.json`,
    approvalStatus: 'CANDIDATE_ONLY — NOT FINANCE APPROVED',
  };
}

async function captureProfitLoss(page, prefix, availability) {
  await openFinancialReport(page, 'Profit & Loss');
  const body = await page.innerText('body');
  const periodM = body.match(/Period:\s*(\d{4}-\d{2}-\d{2})\s+to\s+(\d{4}-\d{2}-\d{2})/i);
  const startDate = periodM ? periodM[1] : '2000-01-01';
  const endDate = periodM ? periodM[2] : new Date().toISOString().slice(0, 10);

  const checkbox = page.getByLabel(/Unified TB preview \(P&L compare only\)/i);
  const toggleVisible = await checkbox.isVisible({ timeout: 30000 }).catch(() => false);
  availability.profitLossToggleVisible = toggleVisible;
  availability.profitLossToggleDefaultOff = toggleVisible ? !(await checkbox.isChecked()) : null;

  if (!toggleVisible) {
    return { status: 'BLOCKED', startDate, endDate, error: 'preview toggle not visible' };
  }

  await checkbox.check();
  await page.waitForTimeout(2000);
  const panel = page.locator('[data-profit-loss-preview-compare], [data-balance-sheet-preview-compare]')
    .filter({ hasText: /P&L|Profit/i })
    .first();
  const plPanel = page.locator('div').filter({ hasText: 'Unified TB preview compare (P&L)' }).first();
  await plPanel.waitFor({ state: 'visible', timeout: 180000 });
  await page.waitForTimeout(3000);

  const legacy = await readSectionCompare(plPanel, 'Legacy (main)');
  const preview = await readSectionCompare(plPanel, 'Unified preview');
  const { deltas, pass } = await readDeltas(plPanel);
  const panelText = await plPanel.innerText();

  const screenshotPath = path.join(SCREENSHOTS, `${prefix}-profit-loss-preview.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });

  let exportJson = null;
  const downloadPromise = page.waitForEvent('download', { timeout: 15000 }).catch(() => null);
  await plPanel.getByRole('button', { name: /Export compare JSON/i }).click().catch(() => {});
  const download = await downloadPromise;
  if (download) {
    const exportPath = path.join(EXPORTS, `${prefix}-profit-loss-preview.json`);
    await download.saveAs(exportPath);
    try {
      exportJson = JSON.parse(fs.readFileSync(exportPath, 'utf8'));
    } catch {
      exportJson = { note: 'download saved but parse failed' };
    }
  } else {
    exportJson = {
      phase: '3D',
      screen: 'profit_loss',
      startDate,
      endDate,
      legacy,
      preview,
      deltas,
      pass,
      note: 'CANDIDATE_ONLY — NOT FINANCE APPROVED — DOM scrape fallback',
      capturedAt: new Date().toISOString(),
    };
    fs.writeFileSync(
      path.join(EXPORTS, `${prefix}-profit-loss-preview.json`),
      JSON.stringify(exportJson, null, 2),
    );
  }

  return {
    status: 'CAPTURED',
    startDate,
    endDate,
    branchScope: 'All Branches',
    legacy,
    preview,
    deltas,
    pass,
    cogsHeuristicWarning: /COGS heuristic|heuristic/i.test(panelText),
    needsRuleConfirmation: /NEEDS_RULE_CONFIRMATION|NEEDS_ACCOUNTING_RULE/i.test(panelText),
    accountingRuleNotes: exportJson?.accountingRuleNotes ?? [],
    screenshot: `screenshots/${prefix}-profit-loss-preview.png`,
    export: `exports/${prefix}-profit-loss-preview.json`,
    approvalStatus: 'CANDIDATE_ONLY — NOT FINANCE APPROVED',
  };
}

async function main() {
  fs.mkdirSync(SCREENSHOTS, { recursive: true });
  fs.mkdirSync(EXPORTS, { recursive: true });

  const credCheck = PROFILE_ORDER.map((id) => resolveThreeCompanyProfileCredentials(id, profilesRaw));
  const missing = credCheck.filter((c) => !c.ok);
  if (missing.length) {
    const out = {
      status: 'SKIPPED_CREDENTIALS_NOT_CONFIGURED',
      missing: missing.map((m) => m.profileId),
      capturedAt: new Date().toISOString(),
    };
    fs.writeFileSync(path.join(EVIDENCE, 'capture-raw.json'), JSON.stringify(out, null, 2));
    console.error('Missing credentials:', missing.map((m) => m.profileId).join(', '));
    process.exit(2);
  }

  const browser = await chromium.launch({ headless: true });
  const results = {
    phase: '3D',
    run: 'BS/P&L candidate golden capture',
    productionUrl: BASE,
    capturedAt: new Date().toISOString(),
    approvalStatus: 'CANDIDATE_ONLY — NOT FINANCE APPROVED',
    companies: {},
  };

  for (const creds of credCheck) {
    const profile = profilesRaw.profiles[creds.profileId];
    const prefix = companyFilePrefix(creds.profileId);
    console.log(`\n=== ${profile.company} (${creds.email}) ===`);
    const context = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
    const page = await context.newPage();
    const availability = {
      balanceSheetLoads: false,
      profitLossLoads: false,
      balanceSheetToggleVisible: false,
      profitLossToggleVisible: false,
      balanceSheetToggleDefaultOff: null,
      profitLossToggleDefaultOff: null,
      previewLabelsPresent: false,
    };

    try {
      await login(page, creds.email, creds.password);
      const bs = await captureBalanceSheet(page, prefix, availability);
      availability.balanceSheetLoads = bs.status === 'CAPTURED';
      const pl = await captureProfitLoss(page, prefix, availability);
      availability.profitLossLoads = pl.status === 'CAPTURED';
      availability.previewLabelsPresent =
        (bs.status === 'CAPTURED' || pl.status === 'CAPTURED');

      results.companies[creds.profileId] = {
        company: profile.company,
        companyId: profile.company_id,
        userEmail: creds.email,
        availability,
        balanceSheet: bs,
        profitLoss: pl,
      };
      console.log(`BS: ${bs.status} pass=${bs.pass} | PL: ${pl.status} pass=${pl.pass}`);
    } catch (e) {
      results.companies[creds.profileId] = {
        company: profile.company,
        error: String(e.message || e),
        status: 'NEEDS_MANUAL_RETRY',
      };
      console.error(`FAIL ${profile.company}:`, e.message || e);
    } finally {
      await context.close();
    }
  }

  await browser.close();
  fs.writeFileSync(path.join(EVIDENCE, 'capture-raw.json'), JSON.stringify(results, null, 2));
  console.log('\nWrote capture-raw.json');
  const allBlocked = Object.values(results.companies).every(
    (c) => c.balanceSheet?.status === 'BLOCKED' && c.profitLoss?.status === 'BLOCKED',
  );
  process.exit(allBlocked ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
