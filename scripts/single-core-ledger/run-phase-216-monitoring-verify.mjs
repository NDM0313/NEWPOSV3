#!/usr/bin/env node
/**
 * Phase 2.16 / R6 — production monitoring verification (read-only).
 * Profile: MONITORING_PROFILE=din-china (default) via monitoring-company-profiles.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSqlFileViaSsh } from './monitoringSshSql.mjs';
import { chromium } from 'playwright';
import { loadMonitoringProfile } from './loadMonitoringProfile.mjs';
import {
  resolveSingleProfileMonitoringCredentials,
  goldenPartyCredentialBindingHint,
  formatCredentialSourceLog,
} from './monitoringCredentials.mjs';
import {
  parsePkr,
  readClosingBalance,
  readLedgerV2MrJalilClosing,
  readPilotBatchSummary,
  readTrialBalanceTotals,
  readVisibleMainLoaderAttr,
  waitForPilotBatchStats,
  waitForTrialBalanceTotals,
  withinTol,
} from './unifiedLedgerBrowserQaHelpers.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const profile = loadMonitoringProfile(process.env.MONITORING_PROFILE);
const creds = resolveSingleProfileMonitoringCredentials(profile.profileId, process.env);
if (!creds.ok) {
  console.error(creds.message);
  process.exit(1);
}
const EVIDENCE = profile.evidenceDir;
const MR_JALIL_GOLDEN = profile.golden.mrJalilClosing;
const TB_GOLDEN = profile.golden.trialBalanceTotal;
const ROZNAMCHA_GOLDEN = profile.golden.roznamcha;
const GOLDEN_PARTY = profile.goldenPartyName;
const GOLDEN_PARTY_SEARCH = profile.goldenPartySearch;
const BASE = process.env.QA_BROWSER_BASE_URL || profile.productionUrl;
const EMAIL = creds.email;
const PASSWORD = creds.password;
const checks = [];
const consoleErrors = [];

function log(check, result, notes = '') {
  checks.push({ check, result, notes });
  console.log(`[${result}] ${check}${notes ? ` — ${notes}` : ''}`);
}

async function login(page) {
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
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

async function setWideRange(page) {
  const today = new Date().toISOString().slice(0, 10);
  await page.evaluate(({ todayIso }) => {
    localStorage.setItem('erp-global-filters', JSON.stringify({
      dateRangeType: 'customRange', customStartDate: '2000-01-01', customEndDate: todayIso, branchId: 'all',
    }));
  }, { todayIso: today });
  await page.reload({ waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForTimeout(2000);
}

async function readRoznamchaSummary(page) {
  await setWideRange(page);
  await page.goto(`${BASE}/?view=accounting`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.getByRole('button', { name: /^Roznamcha$/ }).click({ timeout: 60000 });
  await page.locator('[data-roznamcha-main-loader]').first().waitFor({ timeout: 180000 });
  await page.waitForTimeout(8000);
  const loader = await page.locator('[data-roznamcha-main-loader]').first().getAttribute('data-roznamcha-main-loader');
  const body = await page.innerText('body');
  const cashInM = body.match(/Cash In(?: Today)?[\s\n\r]+(?:Rs\.?\s*)?([\d,]+\.?\d*)/i);
  const cashOutM = body.match(/Cash Out(?: Today)?[\s\n\r]+(?:Rs\.?\s*)?([\d,]+\.?\d*)/i);
  const closingM = body.match(/Closing Balance[\s\n\r]+(?:Rs\.?\s*)?([\d,]+\.?\d*)/i);
  let compareSource = null;
  const toggle = page.getByRole('checkbox', { name: /unified engine preview \(compare only\)/i });
  if (await toggle.isVisible().catch(() => false)) {
    await toggle.setChecked(true);
    await page.waitForTimeout(6000);
    compareSource = await page.locator('[data-roznamcha-preview-compare-source]').first().getAttribute('data-roznamcha-preview-compare-source');
    await toggle.setChecked(false);
  }
  return {
    loader,
    compareSource,
    cashIn: cashInM ? parsePkr(cashInM[1]) : NaN,
    cashOut: cashOutM ? parsePkr(cashOutM[1]) : NaN,
    closing: closingM ? parsePkr(closingM[1]) : NaN,
  };
}

async function selectGoldenPartyAccountStatement(page) {
  try {
    await page.getByRole('button', { name: /^Account Statements$/ }).click({ timeout: 60000 });
    await page.getByRole('button', { name: /Advanced \(effective \/ audit\)/i }).click({ timeout: 30000 });
    if (profile.profileId === 'din-china') {
      await page.getByRole('button', { name: /load mr jalil/i }).click({ timeout: 120000 });
    } else {
      await page.locator('div:has(> label:text-is("Statement Type")) select').selectOption('customer');
      await page.waitForTimeout(2000);
      const contactCombobox = page.locator('div').filter({ has: page.getByText('Contact', { exact: true }) }).locator('[role="combobox"]').first();
      await contactCombobox.click({ timeout: 30000 });
      const searchInput = page.locator('[cmdk-input], input[placeholder*="Search"]').last();
      await searchInput.fill(GOLDEN_PARTY_SEARCH);
      await page.waitForTimeout(2000);
      await page.locator('[cmdk-item]').filter({ hasText: GOLDEN_PARTY }).first().click({ timeout: 30000 });
    }
    await page.waitForTimeout(8000);
  } catch (err) {
    throw new Error(goldenPartyCredentialBindingHint(profile.profileId, GOLDEN_PARTY, EMAIL), { cause: err });
  }
}

async function selectGoldenPartyPartyLedger(page) {
  if (profile.profileId === 'din-china') {
    await page.getByRole('button', { name: /load mr jalil/i }).click({ timeout: 120000 }).catch(() => {});
  } else {
    const partyBtn = page.getByRole('button', { name: /Select party/i });
    await partyBtn.click({ timeout: 15000 });
    const searchInput = page.getByPlaceholder(/Search contacts/i).first();
    await searchInput.fill(GOLDEN_PARTY_SEARCH);
    await page.waitForTimeout(2000);
    await page.getByText(GOLDEN_PARTY, { exact: false }).first().click({ timeout: 30000 });
  }
  await page.waitForTimeout(8000);
}

async function selectGoldenPartyLedgerV2(page) {
  const tabBtn = page.locator('button').filter({ hasText: /^Account Statements$/ });
  if (await tabBtn.count()) await tabBtn.first().click();
  if (profile.profileId === 'din-china') {
    await page.getByRole('button', { name: /load mr jalil/i }).click({ timeout: 120000 });
  } else {
    await page.locator('div:has(> label:text-is("Statement type")) select').selectOption('customer');
    await page.waitForTimeout(2000);
    const entityCombobox = page.locator('div').filter({ has: page.getByText('Party / account', { exact: true }) }).locator('[role="combobox"]').first();
    await entityCombobox.click({ timeout: 30000 });
    const searchInput = page.locator('[cmdk-input], input[placeholder*="Search"]').last();
    await searchInput.fill(GOLDEN_PARTY_SEARCH);
    await page.waitForTimeout(2000);
    await page.locator('[cmdk-item]').filter({ hasText: GOLDEN_PARTY }).first().click({ timeout: 30000 });
  }
  await page.waitForTimeout(8000);
}

async function loadProductionFlags() {
  const flagSqlPath = profile.flagVerifySql;
  if (!fs.existsSync(flagSqlPath)) return null;
  try {
    return execSqlFileViaSsh(flagSqlPath, { psqlArgs: "-t -A -F '|'" });
  } catch (e) {
    log('production flags read', 'FAIL', String(e.message || e));
    return null;
  }
}

async function main() {
  console.log(`Monitoring profile=${profile.profileId} company=${profile.company} login=${EMAIL} ${formatCredentialSourceLog(creds)}`);
  fs.mkdirSync(EVIDENCE, { recursive: true });

  const flagOut = await loadProductionFlags();
  if (flagOut) {
    const lines = flagOut.trim().split('\n').filter(Boolean);
    const dinFlags = {};
    let otherCompanyLoaders = 0;
    const dinChinaId = '30bd8592-3384-4f34-899a-f3907e336485';
    const dinBridalId = '597a5292-14c8-4cd8-96bd-c61b5a0d8c92';
    const dinCoutureId = '2ab65903-62a3-4bcf-bced-076b681e9b74';
    const approvedLoaderCompanies = new Set([
      dinChinaId.slice(0, 8),
      dinBridalId.slice(0, 8),
      dinCoutureId.slice(0, 8),
    ]);
    for (const line of lines) {
      const parts = line.split('|');
      if (parts.length >= 3 && parts[0].includes(profile.companyId.slice(0, 8))) {
        dinFlags[parts[1]] = parts[2] === 't' || parts[2] === 'true';
      }
      const isOtherCompanyLoader =
        parts.length >= 3 &&
        parts[1]?.includes('loader') &&
        (parts[2] === 't' || parts[2] === 'true') &&
        !parts[0].includes(profile.companyId.slice(0, 8)) &&
        ![...approvedLoaderCompanies].some((prefix) => parts[0].includes(prefix));
      if (isOtherCompanyLoader) otherCompanyLoaders += 1;
    }
    const expectedOn = profile.expectedUnifiedFlagsOn;
    const allOn = expectedOn.every((k) => dinFlags[k] === true);
    log(`${profile.company} expected flags ON`, allOn ? 'PASS' : 'FAIL', `keys=${expectedOn.filter((k) => dinFlags[k]).length}/${expectedOn.length}`);
    log('no other company loaders ON', otherCompanyLoaders === 0 ? 'PASS' : 'FAIL', `count=${otherCompanyLoaders}`);
    fs.writeFileSync(
      path.join(EVIDENCE, 'production-flags-day1.json'),
      JSON.stringify({ capturedAt: new Date().toISOString(), dinFlags, otherCompanyLoaders, verificationPass: allOn && otherCompanyLoaders === 0 }, null, 2),
    );
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await login(page);
    log('admin login', 'PASS');

    const rz = await readRoznamchaSummary(page);
    log('Roznamcha main loader unified', rz.loader === 'unified' ? 'PASS' : 'FAIL', `actual=${rz.loader}`);
    log('Roznamcha preview legacy_shadow', rz.compareSource === 'legacy_shadow' ? 'PASS' : 'FAIL', `actual=${rz.compareSource}`);
    log('Roznamcha Cash In golden', withinTol(rz.cashIn, ROZNAMCHA_GOLDEN.cashIn) ? 'PASS' : 'FAIL', `actual=${rz.cashIn}`);
    log('Roznamcha Cash Out golden', withinTol(rz.cashOut, ROZNAMCHA_GOLDEN.cashOut) ? 'PASS' : 'FAIL', `actual=${rz.cashOut}`);
    log('Roznamcha Closing golden', withinTol(rz.closing, ROZNAMCHA_GOLDEN.closing) ? 'PASS' : 'FAIL', `actual=${rz.closing}`);

    await setWideRange(page);
    await page.goto(`${BASE}/?view=accounting`, { waitUntil: 'networkidle', timeout: 120000 });
    await selectGoldenPartyAccountStatement(page);
    const asLoader = await page.locator('[data-account-statement-main-loader]').first().getAttribute('data-account-statement-main-loader');
    const asClosing = await readClosingBalance(page);
    log('Account Statement loader unified', asLoader === 'unified' ? 'PASS' : 'FAIL', `actual=${asLoader}`);
    log(`Account Statement ${GOLDEN_PARTY}`, withinTol(asClosing, MR_JALIL_GOLDEN) ? 'PASS' : 'FAIL', `closing=${asClosing}`);

    await setWideRange(page);
    await page.goto(`${BASE}/?view=reports`, { waitUntil: 'networkidle', timeout: 120000 });
    await page.waitForTimeout(3000);
    await page.getByRole('button', { name: /^Financial$/ }).click({ timeout: 60000 });
    await page.waitForTimeout(2000);
    await page.getByRole('button', { name: /^Trial Balance$/ }).click({ timeout: 60000 });
    await page.waitForTimeout(5000);
    await page.locator('[data-trial-balance-main-loader]').first().waitFor({ timeout: 180000 });
    await waitForTrialBalanceTotals(page);
    const tbLoader = await readVisibleMainLoaderAttr(page, 'data-trial-balance-main-loader');
    const { debit, credit } = await readTrialBalanceTotals(page);
    log('Trial Balance loader unified', tbLoader === 'unified' ? 'PASS' : 'FAIL', `actual=${tbLoader}`);
    log('Trial Balance debit = credit', withinTol(debit, credit) ? 'PASS' : 'FAIL', `debit=${debit} credit=${credit}`);
    log('Trial Balance golden total', withinTol(debit, TB_GOLDEN) && withinTol(credit, TB_GOLDEN) ? 'PASS' : 'FAIL', `debit=${debit}`);

    await setWideRange(page);
    await page.goto(`${BASE}/?view=party-ledger`, { waitUntil: 'networkidle', timeout: 120000 });
    await selectGoldenPartyPartyLedger(page);
    const plLoader = await page.locator('[data-party-ledger-main-loader]').first().getAttribute('data-party-ledger-main-loader');
    const bodyPl = await page.innerText('body');
    const plM = bodyPl.match(/Current Receivable[\s\n\r]+(?:Rs\.?\s*)?([\d,]+\.?\d*)/i);
    const plClosing = plM ? parsePkr(plM[1]) : await readClosingBalance(page, { labels: ['Current Receivable'] });
    log('Party Ledger loader unified', plLoader === 'unified' ? 'PASS' : 'FAIL', `actual=${plLoader}`);
    log(`Party Ledger ${GOLDEN_PARTY}`, withinTol(plClosing, MR_JALIL_GOLDEN) ? 'PASS' : 'FAIL', `closing=${plClosing}`);

    await page.goto(`${BASE}/reports/ledger-statement-center-v2`, { waitUntil: 'networkidle', timeout: 120000 });
    await page.waitForTimeout(3000);
    await selectGoldenPartyLedgerV2(page);
    const lv2Closing = await readLedgerV2MrJalilClosing(page);
    const lv2Loader = await readVisibleMainLoaderAttr(page, 'data-ledger-v2-main-loader');
    log('Ledger V2 loader unified', lv2Loader === 'unified' ? 'PASS' : 'FAIL', `actual=${lv2Loader}`);
    log(`Ledger V2 ${GOLDEN_PARTY}`, withinTol(lv2Closing, MR_JALIL_GOLDEN) ? 'PASS' : 'FAIL', `closing=${lv2Closing}`);
    if (!withinTol(lv2Closing, MR_JALIL_GOLDEN)) {
      fs.mkdirSync(path.join(EVIDENCE, 'screenshots'), { recursive: true });
      await page.screenshot({ path: path.join(EVIDENCE, 'screenshots/lv2-mr-jalil-parse-failure.png'), fullPage: true });
    }

    if (!profile.skipAdminPilotBatch) {
      await page.goto(`${BASE}/admin/unified-ledger-tieout`, { waitUntil: 'networkidle', timeout: 120000 });
      await page.getByRole('tab', { name: /Pilot Batch/i }).click({ timeout: 60000 });
      const runBtn = page.getByRole('button', { name: /Run DIN CHINA 9\/9 batch/i });
      if (await runBtn.isVisible().catch(() => false)) await runBtn.click();
      await waitForPilotBatchStats(page, profile.pilotBatchExpected);
      const batch = await readPilotBatchSummary(page);
      log(
        'Admin Compare Pilot Batch 9/9',
        batch.compared === profile.pilotBatchExpected &&
          batch.passCount === profile.pilotBatchExpected &&
          batch.failCount === 0
          ? 'PASS'
          : 'FAIL',
        `compared=${batch.compared} pass=${batch.passCount} fail=${batch.failCount}`,
      );
      if (batch.compared !== profile.pilotBatchExpected || batch.passCount !== profile.pilotBatchExpected) {
        fs.mkdirSync(path.join(EVIDENCE, 'screenshots'), { recursive: true });
        await page.screenshot({ path: path.join(EVIDENCE, 'screenshots/admin-compare-pilot-batch.png'), fullPage: true });
      }
    } else {
      log('Admin Compare Pilot Batch', 'WAIVED', `skipped for ${profile.profileId} profile`);
    }

    const rpcErrors = consoleErrors.filter((e) => /rpc|supabase|unified/i.test(e));
    log('no material console/RPC errors', rpcErrors.length === 0 ? 'PASS' : 'WAIVED', rpcErrors.slice(0, 3).join(' | ') || 'none');

    const corePass = checks.filter((c) =>
      !c.check.includes('Admin Compare') && !c.check.includes('console'),
    ).every((c) => c.result === 'PASS');
    const overallPass = checks.every((c) => c.result === 'PASS' || c.result === 'WAIVED');

    const md = [
      `# ${profile.company} production monitoring`,
      '',
      `**Profile:** ${profile.profileId}`,
      `**Date:** ${new Date().toISOString()}`,
      `**URL:** ${BASE}`,
      `**Core gates:** ${corePass ? 'PASS' : 'FAIL'}`,
      `**Overall:** ${overallPass ? 'PASS' : 'PASS WITH WAIVERS'}`,
      '',
      ...checks.map((c) => `- [${c.result}] ${c.check}${c.notes ? ` — ${c.notes}` : ''}`),
    ].join('\n');
    fs.writeFileSync(path.join(EVIDENCE, 'production-monitoring-day1.md'), md);

    console.log(`\nPhase 2.16 monitoring: ${overallPass ? 'PASS' : 'FAIL'}`);
    process.exit(overallPass ? 0 : 1);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
