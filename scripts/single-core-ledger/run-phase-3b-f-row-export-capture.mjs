#!/usr/bin/env node
/**
 * Phase 3B-F — Cash Flow row-keyed export capture from production preview UI (read-only).
 * Captures DIN CHINA + DIN BRIDAL exports and emits per-company diff reports.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { chromium } from 'playwright';
import { parsePkr } from './unifiedLedgerBrowserQaHelpers.mjs';
import {
  PROFILE_ORDER,
  resolveThreeCompanyProfileCredentials,
} from './monitoringCredentials.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PROFILES_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), 'monitoring-company-profiles.json');
const EVIDENCE = path.join(ROOT, 'reports/single-core-ledger/phase-3b-f-cash-flow-row-export');
const EXPORTS = path.join(EVIDENCE, 'exports');
const DIFFS = path.join(EVIDENCE, 'diff-reports');
const BASE = process.env.QA_BROWSER_BASE_URL || 'https://erp.dincouture.pk';
const CAPTURE_PROFILES = ['din-china', 'din-bridal'];

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
  return { startDate: '2000-01-01', endDate: today };
}

async function openCashFlow(page) {
  const dates = await setWideRange(page);
  await page.goto(`${BASE}/?view=accounting`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForTimeout(2000);
  await page.getByRole('button', { name: /^Cash Flow$/ }).click({ timeout: 60000 });
  await page.waitForTimeout(5000);
  return dates;
}

async function captureRowExport(page, prefix) {
  const { startDate, endDate } = await openCashFlow(page);
  const toggle = page.getByLabel(/Unified Roznamcha preview \(Cash Flow compare only\)/i);
  const toggleVisible = await toggle.isVisible({ timeout: 30000 }).catch(() => false);
  if (!toggleVisible) {
    return { status: 'BLOCKED', error: 'preview toggle not visible', startDate, endDate };
  }
  if (await toggle.isChecked()) {
    await toggle.uncheck().catch(() => {});
    await page.waitForTimeout(1500);
  }
  await toggle.check();
  await page.waitForTimeout(2000);
  const panel = page.locator('[data-cash-flow-preview-compare]').first();
  await panel.waitFor({ state: 'visible', timeout: 180000 });
  await page.waitForTimeout(4000);

  const exportBtn = panel.getByRole('button', { name: /Export row-keyed JSON/i });
  const btnVisible = await exportBtn.isVisible({ timeout: 10000 }).catch(() => false);
  if (!btnVisible) {
    return { status: 'BLOCKED', error: 'Export row-keyed JSON button not visible', startDate, endDate };
  }

  const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
  await exportBtn.click();
  const download = await downloadPromise;
  const exportPath = path.join(EXPORTS, `${prefix}-cash-flow-row-export.json`);
  await download.saveAs(exportPath);

  let exportJson;
  try {
    exportJson = JSON.parse(fs.readFileSync(exportPath, 'utf8'));
  } catch {
    return { status: 'FAIL', error: 'invalid export JSON', startDate, endDate, exportPath };
  }

  if (!exportJson.rowKeyedDiff) {
    return { status: 'FAIL', error: 'missing rowKeyedDiff in export', startDate, endDate, exportPath };
  }

  const diffScript = path.join(ROOT, 'scripts/single-core-ledger/phase-3b-f/export-cash-flow-row-diff.mjs');
  const companyDiffDir = path.join(DIFFS, prefix);
  fs.mkdirSync(companyDiffDir, { recursive: true });
  execSync(`node "${diffScript}" "${exportPath}" "${companyDiffDir}"`, { stdio: 'inherit' });

  const rd = exportJson.rowKeyedDiff;
  return {
    status: 'CAPTURED',
    startDate: exportJson.dateFrom || startDate,
    endDate: exportJson.dateTo || endDate,
    companyId: exportJson.companyId,
    phase: exportJson.phase,
    diagnosticOnly: exportJson.diagnosticOnly,
    matchCounts: {
      exact: rd.exactMatches?.length ?? 0,
      strong: rd.strongMatches?.length ?? 0,
      weak: rd.weakMatches?.length ?? 0,
      legacyOnly: rd.legacyOnly?.length ?? 0,
      previewOnly: rd.previewOnly?.length ?? 0,
    },
    closingDelta: exportJson.diff?.closingDelta ?? null,
    thematicBucketCount: rd.thematicBuckets?.length ?? 0,
    export: `exports/${prefix}-cash-flow-row-export.json`,
    diffReport: `diff-reports/${prefix}/sample-row-diff-report.json`,
    approvalStatus: 'CANDIDATE_ONLY — NOT FINANCE APPROVED',
  };
}

async function main() {
  fs.mkdirSync(EXPORTS, { recursive: true });
  fs.mkdirSync(DIFFS, { recursive: true });

  const credCheck = CAPTURE_PROFILES.map((id) => resolveThreeCompanyProfileCredentials(id, profilesRaw));
  const missing = credCheck.filter((c) => !c.ok);
  if (missing.length) {
    const out = {
      status: 'SKIPPED_CREDENTIALS_NOT_CONFIGURED',
      missing: missing.map((m) => m.profileId),
      capturedAt: new Date().toISOString(),
    };
    fs.writeFileSync(path.join(EVIDENCE, 'production-row-export-capture.json'), JSON.stringify(out, null, 2));
    console.error('Missing credentials:', missing.map((m) => m.profileId).join(', '));
    process.exit(2);
  }

  const browser = await chromium.launch({ headless: true });
  const results = {
    phase: '3B-F',
    run: 'Cash Flow row-keyed export capture',
    productionUrl: BASE,
    deployedCommit: process.env.PHASE_3BF_DEPLOY_COMMIT || '5433ac2c',
    capturedAt: new Date().toISOString(),
    companies: {},
  };

  for (const profileId of CAPTURE_PROFILES) {
    const cred = resolveThreeCompanyProfileCredentials(profileId, profilesRaw);
    const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
    try {
      await login(page, cred.email, cred.password);
      results.companies[profileId] = await captureRowExport(page, profileId);
    } catch (e) {
      results.companies[profileId] = { status: 'FAIL', error: String(e.message || e) };
    } finally {
      await page.close();
    }
  }
  await browser.close();

  const allCaptured = CAPTURE_PROFILES.every((id) => results.companies[id]?.status === 'CAPTURED');
  results.overall = allCaptured ? 'PASS' : 'PARTIAL';

  fs.writeFileSync(path.join(EVIDENCE, 'production-row-export-capture.json'), JSON.stringify(results, null, 2));
  const md = `# Production row-keyed export capture — Phase 3B-F

**URL:** ${BASE}  
**Captured:** ${results.capturedAt}  
**Overall:** ${results.overall}

| Company | Status | Exact | Strong | Weak | Legacy-only | Preview-only | Closing Δ |
|---------|--------|-------|--------|------|-------------|--------------|-----------|
${CAPTURE_PROFILES.map((id) => {
  const c = results.companies[id] || {};
  const m = c.matchCounts || {};
  return `| ${id} | ${c.status || '—'} | ${m.exact ?? '—'} | ${m.strong ?? '—'} | ${m.weak ?? '—'} | ${m.legacyOnly ?? '—'} | ${m.previewOnly ?? '—'} | ${c.closingDelta ?? '—'} |`;
}).join('\n')}

**Note:** CANDIDATE_ONLY — diagnostic evidence for finance rule confirmation. Loader swap blocked.
`;
  fs.writeFileSync(path.join(EVIDENCE, 'production-row-export-capture.md'), md);
  console.log(`\nCapture: ${results.overall}`);
  process.exit(allCaptured ? 0 : 1);
}

main();
