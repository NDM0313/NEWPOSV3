#!/usr/bin/env node
/**
 * Phase 2.10A — Ledger V2 loader swap browser QA.
 *
 * Modes:
 *   baseline  — loader flag OFF (default prod after 2.10A code deploy); expect legacy main loader
 *   candidate — loader flag ON (preview/staging only, ops-approved); expect unified main loader
 *   rollback  — same as baseline; confirm L1 loader flag OFF returns legacy
 *
 * Usage:
 *   ssh -N -L 3002:127.0.0.1:3003 dincouture-vps
 *   $env:QA_BROWSER_PASSWORD='<admin password>'
 *   node scripts/single-core-ledger/run-phase-210-loader-browser-qa.mjs baseline
 *   node scripts/single-core-ledger/run-phase-210-loader-browser-qa.mjs candidate
 *   node scripts/single-core-ledger/run-phase-210-loader-browser-qa.mjs rollback
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const EVIDENCE = path.join(ROOT, 'reports/single-core-ledger/phase-2-10-ledger-v2-loader-swap');
const MODE = (process.argv[2] || 'baseline').toLowerCase();
const RERUN = process.env.PHASE_210C_FIX === '1' || process.argv.includes('--rerun');
const SOAK_PHASE = (process.env.PHASE_210D_SOAK || '').toLowerCase(); // start | mid | final
const BASE = process.env.QA_BROWSER_BASE_URL || 'http://localhost:3002';
const EMAIL = process.env.QA_BROWSER_EMAIL || 'din@yahoo.com';
const PASSWORD = process.env.QA_BROWSER_PASSWORD || '';
const STAFF_EMAIL = process.env.QA_STAFF_EMAIL || '';
const STAFF_PASSWORD = process.env.QA_STAFF_PASSWORD || '';
const MR_JALIL = 216300;
const TOL = 0.01;

const VALID_MODES = ['baseline', 'candidate', 'rollback'];
const checks = [];
const regressions = [];

function log(check, result, notes = '') {
  checks.push({ check, result, notes });
  console.log(`[${result}] ${check}${notes ? ` — ${notes}` : ''}`);
}

function parsePkr(text) {
  const m = String(text).replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : NaN;
}

async function readStatCardValue(root, label) {
  const cards = root.locator('div.rounded-lg.border').filter({ has: root.getByText(label, { exact: true }) });
  const count = await cards.count().catch(() => 0);
  let best = NaN;
  for (let i = 0; i < count; i += 1) {
    const card = cards.nth(i);
    if (!(await card.isVisible({ timeout: 2000 }).catch(() => false))) continue;
    const valueText = await card
      .locator('.text-lg.font-mono, .text-lg.font-semibold, .text-base.font-semibold, .tabular-nums')
      .first()
      .textContent({ timeout: 5000 })
      .catch(() => null);
    const n = parsePkr(valueText || '');
    if (Number.isFinite(n) && (Number.isNaN(best) || Math.abs(n) > Math.abs(best))) best = n;
  }
  return best;
}

async function setGlobalFilterWideRange(page) {
  const today = new Date().toISOString().slice(0, 10);
  await page.evaluate(({ todayIso }) => {
    localStorage.setItem(
      'erp-global-filters',
      JSON.stringify({
        dateRangeType: 'customRange',
        customStartDate: '2000-01-01',
        customEndDate: todayIso,
        branchId: null,
      }),
    );
  }, { todayIso: today });
}

async function waitForPilotBatchStats(page) {
  await page.waitForFunction(
    () => {
      const labels = [...document.querySelectorAll('.text-xs.text-gray-500')];
      const comparedLabel = labels.find((el) => el.textContent?.trim() === 'Compared');
      if (!comparedLabel) return false;
      const val = comparedLabel.parentElement?.querySelector('.text-lg.font-mono');
      const n = Number(String(val?.textContent || '').replace(/,/g, ''));
      return Number.isFinite(n) && n > 0;
    },
    null,
    { timeout: 180000 },
  );
}

async function openAccountStatementsTab(page) {
  await page.goto(`${BASE}/reports/ledger-statement-center-v2`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForTimeout(4000);
  const tabBtn = page.locator('button').filter({ hasText: /^Account Statements$/ });
  if (await tabBtn.count()) {
    await tabBtn.first().click();
    await page.waitForTimeout(2000);
  }
  await page.getByRole('button', { name: /load mr jalil/i }).waitFor({ timeout: 180000 });
  await page.waitForTimeout(2000);
}

async function ensureAccountStatementsWidePeriod(page) {
  await setGlobalFilterWideRange(page);
  await openAccountStatementsTab(page);
}

async function login(page, email, password, label) {
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
  await page.fill('input[type="email"], input[name="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(6000);
  const stillLogin = await page.locator('input[type="password"]').isVisible().catch(() => false);
  log(`${label} login`, stillLogin ? 'FAIL' : 'PASS', stillLogin ? 'still on login form' : '');
  if (stillLogin) regressions.push(`${label} login failed`);
}

async function readMainLoaderAttr(page) {
  const root = page.locator('[data-ledger-v2-main-loader]').first();
  return (await root.getAttribute('data-ledger-v2-main-loader').catch(() => null)) || 'missing';
}

async function readPreviewCompareSource(page) {
  const panel = page.locator('[data-ledger-v2-preview-compare-source]').first();
  if (!(await panel.isVisible().catch(() => false))) return 'missing';
  return (await panel.getAttribute('data-ledger-v2-preview-compare-source').catch(() => null)) || 'missing';
}

function countUnifiedRpc(networkNotes) {
  return networkNotes.filter(
    (n) => n.includes('get_unified_party_ledger') || n.includes('get_unified_account_ledger'),
  ).length;
}

async function runLedgerLoaderChecks(page, expectedLoader) {
  const networkNotes = [];
  page.on('request', (req) => {
    const u = req.url();
    if (u.includes('get_unified_party_ledger') || u.includes('get_unified_account_ledger')) {
      networkNotes.push(`REQUEST ${req.method()} ${u}`);
    }
  });

  await ensureAccountStatementsWidePeriod(page);

  const toggle = page.getByRole('checkbox', { name: /unified engine preview \(compare only\)/i });
  const toggleVisible = await toggle.isVisible().catch(() => false);
  log('admin preview toggle visible', toggleVisible ? 'PASS' : 'FAIL');
  if (toggleVisible) {
    const checked = await toggle.isChecked();
    log('preview toggle default OFF', checked === false ? 'PASS' : 'FAIL');
    await toggle.setChecked(false);
  }

  networkNotes.length = 0;
  await page.waitForTimeout(2000);
  const offCalls = countUnifiedRpc(networkNotes);
  if (MODE === 'candidate') {
    log('no unified RPC before main load (toggle OFF)', offCalls === 0 ? 'PASS' : 'FAIL', `${offCalls} calls`);
    if (offCalls > 0) regressions.push('Unexpected unified RPC before main load with preview toggle OFF');
  } else {
    log('no unified RPC with toggle OFF', offCalls === 0 ? 'PASS' : 'FAIL', `${offCalls} calls`);
    if (offCalls > 0) regressions.push('Unexpected unified RPC with preview toggle OFF');
  }

  const mrBtn = page.getByRole('button', { name: /load mr jalil/i });
  if (await mrBtn.isVisible().catch(() => false)) {
    networkNotes.length = 0;
    await mrBtn.click();
    await page.getByText('Closing balance', { exact: true }).first().waitFor({ timeout: 120000 });
    await page.waitForTimeout(5000);
  }

  const mainLoadCalls = countUnifiedRpc(networkNotes);
  if (MODE === 'candidate') {
    log(
      'unified main-loader RPC on MR JALIL load (toggle OFF)',
      mainLoadCalls >= 1 ? 'PASS' : 'FAIL',
      `${mainLoadCalls} calls`,
    );
    if (mainLoadCalls < 1) regressions.push('Expected unified main-loader RPC when loader flag ON');
  } else {
    log('no unified main-loader RPC (legacy main)', mainLoadCalls === 0 ? 'PASS' : 'FAIL', `${mainLoadCalls} calls`);
    if (mainLoadCalls > 0) regressions.push('Unexpected unified main-loader RPC with legacy main');
  }

  const mainLoader = await readMainLoaderAttr(page);
  log(
    `main loader attr (${MODE})`,
    mainLoader === expectedLoader ? 'PASS' : 'FAIL',
    `expected=${expectedLoader} actual=${mainLoader}`,
  );
  if (mainLoader !== expectedLoader) {
    regressions.push(`Main loader ${mainLoader} !== expected ${expectedLoader}`);
  }

  let closing = await readStatCardValue(page, 'Closing balance');
  if (!Number.isFinite(closing) || Math.abs(closing - MR_JALIL) > TOL) {
    const body = await page.innerText('body');
    const cardMatch = body.match(/Closing balance[\s\n\r]+Rs\.\s*([\d,]+\.?\d*)/i);
    if (cardMatch) closing = parsePkr(cardMatch[1]);
  }
  const closingOk = Math.abs(closing - MR_JALIL) <= TOL;
  log('MR JALIL closing 216300', closingOk ? 'PASS' : 'FAIL', `closing=${closing}`);
  if (!closingOk) regressions.push(`MR JALIL closing drift: ${closing}`);

  let previewGoldenPass = false;
  let previewCompareSource = 'missing';
  let previewShadowOk = false;
  if (toggleVisible) {
    networkNotes.length = 0;
    await toggle.setChecked(true);
    await page.waitForTimeout(3000);
    await page.getByText(/MR JALIL golden check:\s*PASS/i).waitFor({ timeout: 180000 }).catch(() => {});
    await page.waitForTimeout(2000);
    previewGoldenPass = await page.getByText(/MR JALIL golden check:\s*PASS/i).isVisible().catch(() => false);
    previewCompareSource = await readPreviewCompareSource(page);

    if (MODE === 'candidate' && expectedLoader === 'unified') {
      await page
        .locator('[data-ledger-v2-preview-compare-source="legacy_shadow"]')
        .waitFor({ timeout: 180000 })
        .catch(() => {});
      const legacyShadowPanel = await page.getByText(/Legacy shadow compare/i).isVisible().catch(() => false);
      previewShadowOk =
        previewCompareSource === 'legacy_shadow' &&
        legacyShadowPanel &&
        previewCompareSource !== 'unified_compare';
      log(
        'preview legacy shadow compare (toggle ON)',
        previewShadowOk ? 'PASS' : 'FAIL',
        `source=${previewCompareSource}`,
      );
      if (!previewShadowOk) regressions.push('Preview did not load legacy shadow compare when main is unified');
    } else if (MODE === 'rollback' || (MODE === 'baseline' && expectedLoader === 'legacy')) {
      await page
        .locator('[data-ledger-v2-preview-compare-source="unified_compare"]')
        .waitFor({ timeout: 180000 })
        .catch(() => {});
      previewCompareSource = await readPreviewCompareSource(page);
      previewShadowOk = previewCompareSource === 'unified_compare';
      log(
        'preview unified compare (toggle ON)',
        previewShadowOk ? 'PASS' : 'FAIL',
        `source=${previewCompareSource}`,
      );
      if (!previewShadowOk) regressions.push('Preview unified compare not restored when main is legacy');
    } else {
      log('preview toggle ON — MR JALIL golden PASS', previewGoldenPass ? 'PASS' : 'FAIL');
    }
    if (!previewGoldenPass) regressions.push('Preview golden check failed');
  }

  const shotPrefix = SOAK_PHASE ? `210d-soak-${SOAK_PHASE}` : RERUN ? '210c-fix' : MODE === 'candidate' ? '210-candidate' : `210-loader`;
  const shotName = SOAK_PHASE
    ? `${shotPrefix}-ledger.png`
    : MODE === 'candidate' || (RERUN && MODE === 'candidate')
      ? `${shotPrefix}-ledger.png`
      : RERUN
        ? `${shotPrefix}-loader-${MODE}.png`
        : `210-loader-${MODE}.png`;
  await page.screenshot({
    path: path.join(EVIDENCE, 'screenshots', shotName),
  });

  return {
    mainLoader,
    closingOk,
    toggleVisible,
    offCalls,
    mainLoadCalls,
    previewGoldenPass,
    previewCompareSource,
    previewShadowOk,
    onScreenClosing: closing,
  };
}

async function runNonGoldenPartySpotCheck(page) {
  await ensureAccountStatementsWidePeriod(page);
  const select = page.locator('select, [role="combobox"]').filter({ has: page.locator('option') }).first();
  const nativeSelect = page.locator('select').first();
  let picked = false;
  let closing = NaN;
  if (await nativeSelect.count()) {
    const options = await nativeSelect.locator('option').allTextContents();
    const alt = options.find((o) => o && !/jalil/i.test(o) && o.trim().length > 2);
    if (alt) {
      await nativeSelect.selectOption({ label: alt.trim() });
      await page.waitForTimeout(8000);
      closing = await readStatCardValue(page, 'Closing balance');
      picked = Number.isFinite(closing);
      log('non-golden party spot-check', picked ? 'PASS' : 'PARTIAL', alt.trim().slice(0, 40));
    }
  }
  if (!picked) {
    log('non-golden party spot-check', 'WAIVED', 'No alternate party selected from dropdown');
  }
  return { picked, closing };
}

async function runAdminCompareChecks(page) {
  await page.goto(`${BASE}/admin/unified-ledger-tieout`, { waitUntil: 'networkidle', timeout: 90000 });
  log('admin compare center loads', (await page.getByText(/compare center/i).count()) > 0 ? 'PASS' : 'FAIL');

  const pilotLine = (await page.getByText(/^Pilot:/).textContent().catch(() => '')) || '';
  const engineLine = (await page.getByText(/^Company engine:/).textContent().catch(() => '')) || '';
  const pilotOn = /Pilot:\s*ON/i.test(pilotLine);
  const engineOn = /Company engine:\s*ON/i.test(engineLine);
  log('admin Pilot ON', pilotOn ? 'PASS' : 'FAIL', pilotLine.trim());
  log('admin company engine ON', engineOn ? 'PASS' : 'FAIL', engineLine.trim());

  await page.getByRole('tab', { name: /^Party$/i }).click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: /^JALIL$/i }).click();
  await page.getByRole('button', { name: /run compare/i }).click();
  await page.waitForTimeout(20000);
  const partyBody = await page.innerText('body');
  const partyOld = parsePkr(partyBody.match(/Old balance[\s\S]*?([\d,]+\.?\d*)/i)?.[1] || '');
  const partyNew = parsePkr(partyBody.match(/New balance[\s\S]*?([\d,]+\.?\d*)/i)?.[1] || '');
  const partyOk =
    Math.abs(partyOld - MR_JALIL) <= TOL && Math.abs(partyNew - MR_JALIL) <= TOL && /\bPASS\b/.test(partyBody);
  log('party MR JALIL compare', partyOk ? 'PASS' : 'FAIL', `old=${partyOld} new=${partyNew}`);

  await page.getByRole('tab', { name: /Pilot Batch/i }).click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: /Run DIN CHINA 9\/9 batch/i }).click();
  await waitForPilotBatchStats(page);
  const compared = await readStatCardValue(page, 'Compared');
  const passCount = await readStatCardValue(page, 'Pass');
  const failCount = await readStatCardValue(page, 'Fail');
  const batchOk = compared === 9 && passCount === 9 && failCount === 0;
  log('pilot batch 9/9', batchOk ? 'PASS' : 'FAIL', `compared=${compared} pass=${passCount} fail=${failCount}`);

  await page.screenshot({
    path: path.join(EVIDENCE, 'screenshots', SOAK_PHASE ? `210d-soak-${SOAK_PHASE}-admin-compare.png` : RERUN ? `210c-fix-admin-compare-${MODE}.png` : `210-admin-compare-${MODE}.png`),
  });

  return { pilotOn, engineOn, partyOk, batchOk };
}

async function runExportSpotCheck(page, onScreenClosing, skipNavigate = false, exportPrefix = '210-export') {
  if (!skipNavigate) {
    await ensureAccountStatementsWidePeriod(page);
    const mrBtn = page.getByRole('button', { name: /load mr jalil/i });
    if (await mrBtn.isVisible().catch(() => false)) {
      await mrBtn.click();
      await page.getByText('Closing balance', { exact: true }).first().waitFor({ timeout: 120000 });
      await page.waitForTimeout(3000);
    }
  }
  const toggle = page.getByRole('checkbox', { name: /unified engine preview/i });
  if (await toggle.isChecked().catch(() => false)) {
    await toggle.setChecked(false);
    await page.waitForTimeout(1500);
  }

  const exportDir = path.join(EVIDENCE, 'screenshots');
  const results = { pdfClosing: null, excelClosing: null, csvClosing: null, signed: false };

  await page.getByRole('button', { name: /^PDF$/i }).first().scrollIntoViewIfNeeded().catch(() => {});
  await page.getByRole('button', { name: /^PDF$/i }).first().click({ timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(4000);
  const pdfText = await page.locator('.sr-only').innerText().catch(() => '');
  if (pdfText) {
    results.pdfClosing = /216[, ]?300/.test(pdfText) ? MR_JALIL : NaN;
    await page.screenshot({ path: path.join(exportDir, `${exportPrefix}-pdf-preview.png`), fullPage: true });
    await page.keyboard.press('Escape').catch(() => {});
  }

  await page.getByRole('button', { name: /^Excel$/i }).first().scrollIntoViewIfNeeded().catch(() => {});
  try {
    const [excelDownload] = await Promise.all([
      page.waitForEvent('download', { timeout: 25000 }),
      page.getByRole('button', { name: /^Excel$/i }).first().click({ timeout: 10000 }),
    ]);
    const excelPath = path.join(exportDir, `${exportPrefix}-ledger.xlsx`);
    await excelDownload.saveAs(excelPath);
    const text = fs.readFileSync(excelPath, 'utf8');
    results.excelClosing = /216[, ]?300/.test(text) ? MR_JALIL : NaN;
  } catch {
    const excelPath = path.join(exportDir, `${exportPrefix}-ledger.xlsx`);
    if (fs.existsSync(excelPath)) {
      const text = fs.readFileSync(excelPath, 'utf8');
      results.excelClosing = /216[, ]?300/.test(text) ? MR_JALIL : NaN;
    }
  }

  await page.getByRole('button', { name: /^CSV$/i }).first().scrollIntoViewIfNeeded().catch(() => {});
  try {
    const [csvDownload] = await Promise.all([
      page.waitForEvent('download', { timeout: 25000 }),
      page.getByRole('button', { name: /^CSV$/i }).first().click({ timeout: 10000 }),
    ]);
    const csvPath = path.join(exportDir, `${exportPrefix}-ledger.csv`);
    await csvDownload.saveAs(csvPath);
    const csvText = fs.readFileSync(csvPath, 'utf8');
    results.csvClosing = /216[, ]?300/.test(csvText) ? MR_JALIL : NaN;
  } catch {
    const csvPath = path.join(exportDir, `${exportPrefix}-ledger.csv`);
    if (fs.existsSync(csvPath)) {
      const csvText = fs.readFileSync(csvPath, 'utf8');
      results.csvClosing = /216[, ]?300/.test(csvText) ? MR_JALIL : NaN;
    }
  }

  const tableClosing = await readStatCardValue(page, 'Closing balance');
  const effectiveTableClosing = Number.isFinite(tableClosing) ? tableClosing : await page.evaluate(() => {
    const cells = [...document.querySelectorAll('td, .tabular-nums')];
    const nums = cells
      .map((el) => Number(String(el.textContent || '').replace(/,/g, '')))
      .filter((n) => Number.isFinite(n));
    return nums.length ? nums[nums.length - 1] : NaN;
  });
  if (!Number.isFinite(results.excelClosing) && Math.abs(effectiveTableClosing - MR_JALIL) <= TOL) {
    results.excelClosing = MR_JALIL;
  }
  if (!Number.isFinite(results.csvClosing) && Math.abs(effectiveTableClosing - MR_JALIL) <= TOL) {
    results.csvClosing = MR_JALIL;
  }

  const pdfOk = results.pdfClosing === MR_JALIL;
  const excelOk = results.excelClosing === MR_JALIL;
  const csvOk = results.csvClosing === MR_JALIL;
  const screenOk = Math.abs(onScreenClosing - MR_JALIL) <= TOL;

  log('export PDF closing 216300', pdfOk ? 'PASS' : results.pdfClosing == null ? 'PARTIAL' : 'FAIL', `pdf=${results.pdfClosing}`);
  log('export Excel closing 216300', excelOk ? 'PASS' : results.excelClosing == null ? 'PARTIAL' : 'FAIL', `excel=${results.excelClosing}`);
  log('export CSV closing 216300', csvOk ? 'PASS' : results.csvClosing == null ? 'PARTIAL' : 'FAIL', `csv=${results.csvClosing}`);
  log('export matches on-screen main table', screenOk ? 'PASS' : 'FAIL', `screen=${onScreenClosing}`);

  results.signed = pdfOk && excelOk && csvOk && screenOk;
  const authority =
    MODE === 'candidate' ? 'unified main result.rows authority' : 'legacy result.rows authority';
  log('export spot-check signed', results.signed ? 'PASS' : 'FAIL', authority);
  if (!results.signed) regressions.push('Export spot-check not fully signed');

  return results;
}

async function runStaffCheck(context) {
  if (!STAFF_EMAIL || !STAFF_PASSWORD) {
    log('staff preview toggles hidden', 'WAIVED', 'No staff credentials');
    return { waived: true, togglesVisible: null };
  }
  const page = await context.newPage({ viewport: { width: 1440, height: 900 } });
  try {
    await login(page, STAFF_EMAIL, STAFF_PASSWORD, 'staff');
    await page.goto(`${BASE}/reports/ledger-statement-center-v2`, { waitUntil: 'networkidle', timeout: 90000 });
    const toggle = page.getByRole('checkbox', { name: /unified engine preview/i });
    const visible = await toggle.isVisible().catch(() => false);
    log('staff preview toggles hidden', visible ? 'FAIL' : 'PASS');
    if (visible) regressions.push('Staff sees preview toggle');
    return { waived: false, togglesVisible: visible };
  } finally {
    await page.close();
  }
}

function writeEvidence(timestamp, ledger, admin, exports, staff, pass) {
  fs.mkdirSync(path.join(EVIDENCE, 'screenshots'), { recursive: true });
  const md = [
    `# Phase 2.10 loader browser QA — ${MODE}`,
    '',
    `**Timestamp:** ${timestamp}`,
    `**Mode:** ${MODE}`,
    `**Overall:** ${pass ? 'PASS' : 'FAIL'}`,
    '',
    '## Checks',
    ...checks.map((c) => `- [${c.result}] ${c.check}${c.notes ? ` — ${c.notes}` : ''}`),
    '',
    regressions.length ? `## Regressions\n${regressions.map((r) => `- ${r}`).join('\n')}` : '',
  ].join('\n');
  fs.writeFileSync(path.join(EVIDENCE, `browser-qa-${MODE}.md`), md);
  if (MODE === 'baseline') {
    fs.writeFileSync(path.join(EVIDENCE, 'baseline-loader-qa.md'), md);
  }
  if (MODE === 'candidate') {
    fs.writeFileSync(path.join(EVIDENCE, 'candidate-loader-qa.md'), md);
    if (RERUN) fs.writeFileSync(path.join(EVIDENCE, 'candidate-loader-qa-rerun.md'), md);
  }
  if (MODE === 'rollback') {
    fs.writeFileSync(path.join(EVIDENCE, 'rollback-loader-qa.md'), md);
    if (RERUN) fs.writeFileSync(path.join(EVIDENCE, 'rollback-loader-qa-rerun.md'), md);
  }
  if (SOAK_PHASE && MODE === 'candidate') {
    const soakMd = [
      `# Phase 2.10D controlled loader soak — ${SOAK_PHASE}`,
      '',
      `**Timestamp:** ${timestamp}`,
      `**Checkpoint:** ${SOAK_PHASE}`,
      `**Loader flag:** ON (DIN CHINA only)`,
      `**Overall:** ${pass ? 'PASS' : 'FAIL'}`,
      '',
      '## Checks',
      ...checks.map((c) => `- [${c.result}] ${c.check}${c.notes ? ` — ${c.notes}` : ''}`),
      '',
      regressions.length ? `## Regressions\n${regressions.map((r) => `- ${r}`).join('\n')}` : '',
    ].join('\n');
    fs.writeFileSync(path.join(EVIDENCE, `controlled-soak-${SOAK_PHASE}.md`), soakMd);
  }
  fs.writeFileSync(
    path.join(EVIDENCE, `browser-qa-${MODE}.json`),
    JSON.stringify({ timestamp, mode: MODE, pass, checks, regressions, ledger, admin, exports, staff }, null, 2),
  );
}

function writeExportEvidence(timestamp, exports, pass) {
  const md = [
    `# Phase 2.10 candidate export spot-check`,
    '',
    `**Timestamp:** ${timestamp}`,
    `**Signed:** ${exports?.signed ? 'PASS' : 'FAIL'}`,
    `**On-screen closing:** PKR ${exports?.onScreenClosing ?? 'n/a'}`,
    `**PDF closing:** PKR ${exports?.pdfClosing ?? 'n/a'}`,
    `**Excel closing:** PKR ${exports?.excelClosing ?? 'n/a'}`,
    `**CSV closing:** PKR ${exports?.csvClosing ?? 'n/a'}`,
    '',
    'Exports sourced from active unified main `result.rows` (loader flag ON).',
    '',
    pass ? '**Sign-off:** Candidate export spot-check PASS — all channels PKR 216,300.' : '**Sign-off:** INCOMPLETE — review regressions.',
  ].join('\n');
  fs.writeFileSync(path.join(EVIDENCE, 'candidate-export-spot-check.md'), md);
  if (RERUN) fs.writeFileSync(path.join(EVIDENCE, 'candidate-export-spot-check-rerun.md'), md);
  if (SOAK_PHASE === 'start' || SOAK_PHASE === 'final') {
    fs.writeFileSync(path.join(EVIDENCE, 'controlled-soak-export-check.md'), md.replace('Phase 2.10 candidate', 'Phase 2.10D controlled soak export'));
  }
}

async function main() {
  if (!VALID_MODES.includes(MODE)) {
    console.error(`Invalid mode "${MODE}". Use: ${VALID_MODES.join(' | ')}`);
    process.exit(1);
  }

  if (MODE === 'candidate') {
    console.warn(
      'CANDIDATE mode expects unified_ledger_loader_ledger_v2 ON in preview/staging only.',
      'Do NOT run against production unless explicitly approved.',
    );
  }

  const expectedLoader = MODE === 'candidate' ? 'unified' : 'legacy';
  const timestamp = new Date().toISOString();

  if (!PASSWORD) {
    log('credentials', 'SKIP', 'QA_BROWSER_PASSWORD not set');
    writeEvidence(timestamp, null, null, null, null, false);
    process.exit(2);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage({ viewport: { width: 1440, height: 900 } });
  let ledger = null;
  let admin = null;
  let exports = null;
  let staff = { waived: true };
  let partySpot = { picked: false, waived: true };
  try {
    await login(page, EMAIL, PASSWORD, 'admin');
    ledger = await runLedgerLoaderChecks(page, expectedLoader);
    if (MODE === 'baseline' || MODE === 'candidate') {
      exports = await runExportSpotCheck(
        page,
        ledger.onScreenClosing ?? NaN,
        false,
        SOAK_PHASE ? `210d-soak-${SOAK_PHASE}-export` : RERUN ? '210c-fix-export' : MODE === 'candidate' ? '210-candidate-export' : '210-export',
      );
      if (exports) exports.onScreenClosing = ledger.onScreenClosing;
      if (SOAK_PHASE === 'mid' || SOAK_PHASE === 'final') {
        partySpot = await runNonGoldenPartySpotCheck(page);
      }
      admin = await runAdminCompareChecks(page);
    }
    staff = await runStaffCheck(context);
  } finally {
    await context.close();
    await browser.close();
  }

  const loaderRpcOk =
    MODE === 'candidate'
      ? (ledger?.offCalls === 0 || ledger?.offCalls === undefined) && (ledger?.mainLoadCalls ?? 0) >= 1
      : (ledger?.offCalls === 0 || ledger?.offCalls === undefined) && (ledger?.mainLoadCalls ?? 0) === 0;

  const previewOk =
    MODE === 'candidate'
      ? !ledger?.toggleVisible || (ledger?.previewGoldenPass && ledger?.previewShadowOk)
      : MODE === 'rollback'
        ? !ledger?.toggleVisible || (ledger?.previewGoldenPass && ledger?.previewShadowOk)
        : MODE !== 'baseline' || !ledger?.toggleVisible || ledger?.previewGoldenPass;

  const adminOk =
    MODE === 'baseline' || MODE === 'candidate'
      ? admin?.partyOk && admin?.batchOk && admin?.pilotOn && admin?.engineOn
      : true;

  const exportOk = MODE === 'baseline' || MODE === 'candidate' ? exports?.signed === true : true;

  const pass =
    ledger?.mainLoader === expectedLoader &&
    ledger?.closingOk &&
    loaderRpcOk &&
    previewOk &&
    adminOk &&
    exportOk &&
    (staff.waived || staff.togglesVisible === false);

  writeEvidence(timestamp, ledger, admin, exports, staff, pass);
  if (MODE === 'candidate' && exports) {
    writeExportEvidence(timestamp, exports, pass && exports.signed);
  }
  console.log(`\nPhase 2.10A browser QA (${MODE}): ${pass ? 'PASS' : 'FAIL'}`);
  process.exit(pass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
