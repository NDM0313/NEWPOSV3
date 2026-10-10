#!/usr/bin/env node
/**
 * Phase 3B-I — aligned Cash Flow candidate golden re-capture (read-only).
 * Evidence only — CANDIDATE_ONLY / NOT FINANCE APPROVED.
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
const EVIDENCE = path.join(ROOT, 'reports/single-core-ledger/phase-3b-i-cash-flow-aligned-golden-capture');
const SCREENSHOTS = path.join(EVIDENCE, 'screenshots');
const EXPORTS = path.join(EVIDENCE, 'exports');
const DIFF_REPORTS = path.join(EVIDENCE, 'diff-reports');
const BASE = process.env.QA_BROWSER_BASE_URL || 'https://erp.dincouture.pk';
const CAPTURE_END_DATE = '2026-06-29';

const profilesRaw = JSON.parse(fs.readFileSync(PROFILES_PATH, 'utf8'));

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
  await page.evaluate(({ endDate }) => {
    localStorage.setItem(
      'erp-global-filters',
      JSON.stringify({
        dateRangeType: 'customRange',
        customStartDate: '2000-01-01',
        customEndDate: endDate,
        branchId: 'all',
      }),
    );
  }, { endDate: CAPTURE_END_DATE });
  return { startDate: '2000-01-01', endDate: CAPTURE_END_DATE };
}

async function openCashFlow(page) {
  const dates = await setWideRange(page);
  await page.goto(`${BASE}/?view=accounting`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForTimeout(2000);
  await page.getByRole('button', { name: /^Cash Flow$/ }).click({ timeout: 60000 });
  await page.waitForTimeout(5000);
  return dates;
}

async function readFlexRow(root, label) {
  const row = root.locator('p.flex.justify-between').filter({
    has: root.getByText(label, { exact: true }),
  });
  const count = await row.count();
  for (let i = 0; i < count; i += 1) {
    const val = await row.nth(i).locator('span.tabular-nums').textContent().catch(() => null);
    const n = parsePkr(val || '');
    if (Number.isFinite(n)) return n;
  }
  return NaN;
}

async function readCfSection(panel, sectionTitle) {
  const section = panel.locator('div.rounded-lg.border').filter({
    has: panel.getByText(sectionTitle, { exact: true }),
  }).first();
  return {
    cashIn: await readFlexRow(section, 'Cash In'),
    cashOut: await readFlexRow(section, 'Cash Out'),
    netMovement: await readFlexRow(section, 'Net movement'),
    closing: await readFlexRow(section, 'Closing'),
  };
}

async function readCfDeltas(panel) {
  const text = await panel.innerText();
  const readDelta = (label) => {
    const re = new RegExp(`${label}\\s*Δ\\s*([\\d,.-]+)`, 'i');
    const m = text.match(re);
    return m ? parsePkr(m[1]) : null;
  };
  const rowM = text.match(/Row count Δ\s*(-?\d+)\s*\(legacy\s*(\d+)\s*·\s*preview\s*(\d+)\)/i);
  const pass = /Summary totals match/i.test(text);
  const fail = /differences detected/i.test(text);
  const transferM = text.match(/(\d+)\s*transfer row\(s\)/i);
  const openingM = text.match(/(\d+)\s*opening row\(s\)/i);
  return {
    openingDelta: readDelta('Opening'),
    cashInDelta: readDelta('Cash In'),
    cashOutDelta: readDelta('Cash Out'),
    netMovementDelta: readDelta('Net movement'),
    closingDelta: readDelta('Closing'),
    rowCountDelta: rowM ? Number(rowM[1]) : null,
    legacyRowCount: rowM ? Number(rowM[2]) : null,
    previewRowCount: rowM ? Number(rowM[3]) : null,
    transferRowsExcluded: transferM ? Number(transferM[1]) : null,
    openingRowsExcluded: openingM ? Number(openingM[1]) : null,
    pass: pass && !fail,
  };
}

function bucketCounts(exportJson) {
  const rkd = exportJson?.rowKeyedDiff;
  if (!rkd) return null;
  const bucket = (id) => rkd.thematicBuckets?.find((b) => b.id === id)?.rowCount ?? 0;
  return {
    exact: rkd.exactMatches?.length ?? 0,
    strong: rkd.strongMatches?.length ?? 0,
    weak: rkd.weakMatches?.length ?? 0,
    legacyOnly: rkd.legacyOnly?.length ?? 0,
    previewOnly: rkd.previewOnly?.length ?? 0,
    transferBucket: bucket('transfer_leg'),
    openingBucket: bucket('opening_balance'),
    financeExcludedTransfer: bucket('finance_excluded_transfer_normal'),
    financeExcludedOpening: bucket('finance_excluded_opening_normal'),
  };
}

async function captureCashFlow(page, prefix, availability) {
  const { startDate, endDate } = await openCashFlow(page);
  const body = await page.innerText('body');

  const toggle = page.getByLabel(/Unified Roznamcha preview \(Cash Flow compare only\)/i);
  const toggleVisible = await toggle.isVisible({ timeout: 30000 }).catch(() => false);
  availability.toggleVisible = toggleVisible;
  availability.toggleDefaultOff = toggleVisible ? !(await toggle.isChecked()) : null;
  availability.legacyLoads = /Cash In|Cash Out|Closing/i.test(body);

  if (!toggleVisible) {
    return { status: 'BLOCKED', startDate, endDate, error: 'preview toggle not visible' };
  }

  if (availability.toggleDefaultOff === false) {
    await toggle.uncheck().catch(() => {});
    await page.waitForTimeout(2000);
  }

  await toggle.check();
  await page.waitForTimeout(2000);
  const panel = page.locator('[data-cash-flow-preview-compare]').first();
  await panel.waitFor({ state: 'visible', timeout: 180000 });
  await page.waitForTimeout(4000);

  const panelText = await panel.innerText();
  availability.previewLabelsPresent =
    /PREVIEW_ONLY/i.test(panelText) &&
    /Q4=A.*Q5=C.*Q7=B/i.test(panelText) &&
    /Finance alignment active/i.test(panelText);

  const legacy = await readCfSection(panel, 'Legacy (main)');
  const preview = await readCfSection(panel, 'Unified preview');
  const deltas = await readCfDeltas(panel);

  const screenshotPath = path.join(SCREENSHOTS, `${prefix}-cash-flow-aligned-preview.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });

  let exportJson = null;
  const downloadPromise = page.waitForEvent('download', { timeout: 30000 }).catch(() => null);
  await panel.getByRole('button', { name: /Export row-keyed JSON/i }).click().catch(() => {});
  const download = await downloadPromise;
  const exportPath = path.join(EXPORTS, `${prefix}-cash-flow-aligned-preview.json`);
  if (download) {
    await download.saveAs(exportPath);
    try {
      exportJson = JSON.parse(fs.readFileSync(exportPath, 'utf8'));
    } catch {
      exportJson = null;
    }
  }

  const counts = bucketCounts(exportJson);
  const excluded = exportJson?.preview?.excludedFromNormalTotals ?? {
    internalTransferRows: deltas.transferRowsExcluded,
    openingBalanceRows: deltas.openingRowsExcluded,
  };

  if (!exportJson?.diff) {
    exportJson = {
      phase: '3B-H',
      screen: 'cash_flow',
      financeAlignmentApplied: true,
      financeRules: { Q4: 'A', Q5: 'C', Q7: 'B' },
      dateFrom: startDate,
      dateTo: endDate,
      branchLabel: 'All branches',
      auditMode: false,
      previewBasis: 'effective_party',
      diff: {
        legacyCashIn: legacy.cashIn,
        previewCashIn: preview.cashIn,
        cashInDelta: deltas.cashInDelta,
        legacyCashOut: legacy.cashOut,
        previewCashOut: preview.cashOut,
        cashOutDelta: deltas.cashOutDelta,
        legacyNetMovement: legacy.netMovement,
        previewNetMovement: preview.netMovement,
        netMovementDelta: deltas.netMovementDelta,
        legacyClosing: legacy.closing,
        previewClosing: preview.closing,
        closingDelta: deltas.closingDelta,
        legacyRowCount: deltas.legacyRowCount,
        previewRowCount: deltas.previewRowCount,
        rowCountDelta: deltas.rowCountDelta,
        pass: deltas.pass,
      },
      preview: { excludedFromNormalTotals: excluded },
      pass: deltas.pass,
      note: 'CANDIDATE_ONLY — NOT FINANCE APPROVED — DOM scrape fallback',
      capturedAt: new Date().toISOString(),
    };
    fs.writeFileSync(exportPath, JSON.stringify(exportJson, null, 2));
  }

  const d = exportJson.diff || {};
  const diffReportPath = path.join(DIFF_REPORTS, `${prefix}-aligned-diff-summary.json`);
  const diffSummary = {
    company: prefix,
    phase: '3B-I',
    zeroDiff: d.pass ?? deltas.pass,
    rowKeyedCounts: counts,
    transferBucketEffect: {
      excludedFromNormalTotals: excluded,
      thematicTransferBucket: counts?.transferBucket ?? null,
      financeExcludedTransfer: counts?.financeExcludedTransfer ?? null,
    },
    openingBucketEffect: {
      excludedFromNormalTotals: excluded?.openingBalanceRows ?? null,
      thematicOpeningBucket: counts?.openingBucket ?? null,
      financeExcludedOpening: counts?.financeExcludedOpening ?? null,
    },
    approvedRules: { Q4: 'A', Q5: 'C', Q7: 'B' },
    approvalStatus: 'CANDIDATE_ONLY — NOT FINANCE APPROVED',
  };
  fs.writeFileSync(diffReportPath, JSON.stringify(diffSummary, null, 2));

  return {
    status: 'CAPTURED',
    startDate: exportJson.dateFrom || startDate,
    endDate: exportJson.dateTo || endDate,
    branchScope: exportJson.branchLabel || 'All branches',
    liquidityFilter: 'all',
    sourceModuleFilter: 'all',
    auditMode: exportJson.auditMode ?? false,
    previewBasis: exportJson.previewBasis || 'effective_party',
    financeRules: { Q4: 'A', Q5: 'C', Q7: 'B' },
    financeAlignmentApplied: exportJson.financeAlignmentApplied ?? true,
    legacy: {
      cashIn: d.legacyCashIn ?? legacy.cashIn,
      cashOut: d.legacyCashOut ?? legacy.cashOut,
      netMovement: d.legacyNetMovement ?? legacy.netMovement,
      closing: d.legacyClosing ?? legacy.closing,
      rowCount: d.legacyRowCount ?? deltas.legacyRowCount,
    },
    alignedPreview: {
      cashIn: d.previewCashIn ?? preview.cashIn,
      cashOut: d.previewCashOut ?? preview.cashOut,
      netMovement: d.previewNetMovement ?? preview.netMovement,
      closing: d.previewClosing ?? preview.closing,
      rowCount: d.previewRowCount ?? deltas.previewRowCount,
    },
    compareDeltas: {
      cashInDelta: d.cashInDelta ?? deltas.cashInDelta,
      cashOutDelta: d.cashOutDelta ?? deltas.cashOutDelta,
      netMovementDelta: d.netMovementDelta ?? deltas.netMovementDelta,
      closingDelta: d.closingDelta ?? deltas.closingDelta,
      rowCountDelta: d.rowCountDelta ?? deltas.rowCountDelta,
    },
    rowKeyedCounts: counts,
    transferBucketEffect: diffSummary.transferBucketEffect,
    openingBucketEffect: diffSummary.openingBucketEffect,
    pass: d.pass ?? deltas.pass,
    zeroDiff: d.pass ?? deltas.pass,
    accountingRuleNotes: exportJson.accountingRuleNotes ?? [],
    screenshot: `screenshots/${prefix}-cash-flow-aligned-preview.png`,
    export: `exports/${prefix}-cash-flow-aligned-preview.json`,
    diffReport: `diff-reports/${prefix}-aligned-diff-summary.json`,
    approvalStatus: 'CANDIDATE_ONLY — NOT FINANCE APPROVED',
  };
}

async function main() {
  fs.mkdirSync(SCREENSHOTS, { recursive: true });
  fs.mkdirSync(EXPORTS, { recursive: true });
  fs.mkdirSync(DIFF_REPORTS, { recursive: true });

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
    phase: '3B-I',
    run: 'Aligned Cash Flow candidate golden re-capture',
    productionUrl: BASE,
    capturedAt: new Date().toISOString(),
    captureEndDate: CAPTURE_END_DATE,
    approvalStatus: 'CANDIDATE_ONLY — NOT FINANCE APPROVED',
    financeRules: { Q4: 'A', Q5: 'C', Q7: 'B' },
    companies: {},
  };

  for (const creds of credCheck) {
    const profile = profilesRaw.profiles[creds.profileId];
    const prefix = creds.profileId;
    console.log(`\n=== ${profile.company} (${creds.email}) ===`);
    const context = await browser.newContext({ viewport: { width: 1440, height: 1400 } });
    const page = await context.newPage();
    const availability = {
      cashFlowLoads: false,
      toggleVisible: false,
      toggleDefaultOff: null,
      legacyLoads: false,
      previewLabelsPresent: false,
    };

    try {
      await login(page, creds.email, creds.password);
      const cf = await captureCashFlow(page, prefix, availability);
      availability.cashFlowLoads = cf.status === 'CAPTURED';
      results.companies[creds.profileId] = {
        company: profile.company,
        companyId: profile.company_id,
        userEmail: creds.email,
        availability,
        cashFlow: cf,
      };
      console.log(`CF: ${cf.status} pass=${cf.pass} zeroDiff=${cf.zeroDiff}`);
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
    (c) => c.cashFlow?.status === 'BLOCKED' || c.status === 'NEEDS_MANUAL_RETRY',
  );
  process.exit(allBlocked ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
