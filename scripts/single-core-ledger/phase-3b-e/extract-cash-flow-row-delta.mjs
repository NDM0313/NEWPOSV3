#!/usr/bin/env node
/**
 * Phase 3B-E — read-only Cash Flow row-level delta extraction (production).
 * Scrapes legacy DOM table + intercepts get_unified_cash_bank_ledger RPC for preview rows.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { parsePkr } from '../unifiedLedgerBrowserQaHelpers.mjs';
import {
  PROFILE_ORDER,
  resolveThreeCompanyProfileCredentials,
} from '../monitoringCredentials.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const PROFILES_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), '../monitoring-company-profiles.json');
const EVIDENCE = path.join(ROOT, 'reports/single-core-ledger/phase-3b-e-cash-flow-delta-investigation');
const BASE = process.env.QA_BROWSER_BASE_URL || 'https://erp.dincouture.pk';
const TARGETS = (process.env.PHASE_3BE_PROFILES || 'din-china,din-bridal').split(',').map((s) => s.trim());

const profilesRaw = JSON.parse(fs.readFileSync(PROFILES_PATH, 'utf8'));

function rowKey(date, ref, cashIn, cashOut) {
  return `${date}|${String(ref || '').slice(0, 40)}|${cashIn}|${cashOut}`;
}

function unifiedKey(r) {
  return `${r.entryDate}|${r.journalEntryLineId || r.journalEntryId}|${r.debit}|${r.credit}`;
}

function groupSum(rows, keyFn, amountFn) {
  const m = new Map();
  for (const r of rows) {
    const k = keyFn(r);
    m.set(k, (m.get(k) || 0) + amountFn(r));
  }
  return m;
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
  await page.waitForTimeout(6000);
}

async function scrapeLegacyRows(page) {
  return page.evaluate(() => {
    const rows = [];
    const trs = document.querySelectorAll('table tbody tr');
    trs.forEach((tr) => {
      const cells = tr.querySelectorAll('td');
      if (cells.length < 9) return;
      const text = (i) => (cells[i]?.textContent || '').trim();
      const parseAmt = (s) => {
        const m = String(s).replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
        return m ? Number(m[0]) : 0;
      };
      rows.push({
        date: text(0),
        reference: text(1),
        party: text(2),
        cashAccount: text(3),
        cashIn: parseAmt(text(4)),
        cashOut: parseAmt(text(5)),
        runningBalance: parseAmt(text(6)),
        sourceModule: text(7),
        status: text(8),
        branch: text(9) || null,
      });
    });
    const footer = document.body.innerText.match(/(\d+) row\(s\)/);
    return { rows, footerRowCount: footer ? Number(footer[1]) : rows.length };
  });
}

function mapPreviewRows(unifiedRows) {
  return unifiedRows.map((r) => ({
    entryDate: r.entry_date || r.entryDate,
    journalEntryId: r.journal_entry_id || r.journalEntryId,
    journalEntryLineId: r.journal_entry_line_id || r.journalEntryLineId,
    referenceType: r.reference_type || r.referenceType,
    description: r.description,
    debit: Number(r.debit) || 0,
    credit: Number(r.credit) || 0,
    branchName: r.branch_name || r.branchName,
    accountName: r.account_name || r.accountName,
    partyResolved: r.party_resolved || r.partyResolved,
    paymentId: r.payment_id || r.paymentId,
  }));
}

function analyzeDelta(profileId, legacyRows, previewRows) {
  const legacyKeys = new Set(legacyRows.map((r) => rowKey(r.date, r.reference, r.cashIn, r.cashOut)));
  const previewKeys = new Set(
    previewRows.map((r) => rowKey(r.entryDate, r.description || r.journalEntryId, r.debit, r.credit)),
  );

  const legacyOnly = legacyRows.filter(
    (r) => !previewKeys.has(rowKey(r.date, r.reference, r.cashIn, r.cashOut)),
  );
  const previewOnly = previewRows.filter(
    (r) => !legacyKeys.has(rowKey(r.entryDate, r.description || r.journalEntryId, r.debit, r.credit)),
  );

  const sum = (arr, inFn, outFn) => ({
    cashIn: arr.reduce((s, r) => s + inFn(r), 0),
    cashOut: arr.reduce((s, r) => s + outFn(r), 0),
    count: arr.length,
  });

  const legacyOnlyTotals = sum(legacyOnly, (r) => r.cashIn, (r) => r.cashOut);
  const previewOnlyTotals = sum(previewOnly, (r) => r.debit, (r) => r.credit);

  const byRefLegacy = {};
  const byRefPreview = {};
  for (const r of legacyOnly) {
    const k = r.sourceModule || 'unknown';
    byRefLegacy[k] = byRefLegacy[k] || { count: 0, cashIn: 0, cashOut: 0 };
    byRefLegacy[k].count += 1;
    byRefLegacy[k].cashIn += r.cashIn;
    byRefLegacy[k].cashOut += r.cashOut;
  }
  for (const r of previewOnly) {
    const k = r.referenceType || 'unknown';
    byRefPreview[k] = byRefPreview[k] || { count: 0, cashIn: 0, cashOut: 0 };
    byRefPreview[k].count += 1;
    byRefPreview[k].cashIn += r.debit;
    byRefPreview[k].cashOut += r.credit;
  }

  const byStatusLegacy = {};
  for (const r of legacyRows) {
    const k = r.status || 'unknown';
    byStatusLegacy[k] = (byStatusLegacy[k] || 0) + 1;
  }

  const byBranchPreview = {};
  for (const r of previewOnly) {
    const k = r.branchName || 'unknown';
    byBranchPreview[k] = (byBranchPreview[k] || 0) + 1;
  }

  const sampleLegacyOnly = legacyOnly.slice(0, 15).map((r) => ({
    date: r.date,
    reference: r.reference,
    cashIn: r.cashIn,
    cashOut: r.cashOut,
    status: r.status,
    sourceModule: r.sourceModule,
  }));
  const samplePreviewOnly = previewOnly.slice(0, 15).map((r) => ({
    date: r.entryDate,
    referenceType: r.referenceType,
    description: String(r.description || '').slice(0, 80),
    debit: r.debit,
    credit: r.credit,
    party: r.partyResolved,
  }));

  return {
    profileId,
    legacyRowCount: legacyRows.length,
    previewRowCount: previewRows.length,
    legacyOnlyCount: legacyOnly.length,
    previewOnlyCount: previewOnly.length,
    legacyOnlyTotals,
    previewOnlyTotals,
    bySourceModuleLegacyOnly: byRefLegacy,
    byReferenceTypePreviewOnly: byRefPreview,
    byStatusLegacy,
    byBranchPreviewOnly: byBranchPreview,
    sampleLegacyOnly,
    samplePreviewOnly,
    matchNote:
      'Row keys use date+reference+amount heuristic — journal line IDs not in legacy DOM; treat as diagnostic not finance golden.',
  };
}

async function extractCompany(creds) {
  const profile = profilesRaw.profiles[creds.profileId];
  const context = await browser.newContext({ viewport: { width: 1600, height: 1400 } });
  const page = await context.newPage();
  let unifiedRpcRows = [];

  page.on('response', async (response) => {
    const url = response.url();
    if (!url.includes('get_unified_cash_bank_ledger') && !url.includes('rpc/get_unified_cash_bank_ledger')) return;
    try {
      const json = await response.json();
      const payload = Array.isArray(json) ? json[0] : json;
      const rows = payload?.rows || payload?.result?.rows;
      if (Array.isArray(rows)) unifiedRpcRows = rows;
    } catch {
      /* ignore */
    }
  });

  await login(page, creds.email, creds.password);
  await openCashFlow(page);
  const legacy = await scrapeLegacyRows(page);

  const toggle = page.getByLabel(/Unified Roznamcha preview \(Cash Flow compare only\)/i);
  await toggle.check();
  await page.waitForTimeout(8000);

  const previewRows = mapPreviewRows(unifiedRpcRows);
  const analysis = analyzeDelta(creds.profileId, legacy.rows, previewRows);

  const bodySnippet = await page.locator('[data-cash-flow-preview-compare]').innerText().catch(() => '');
  const branchNote = bodySnippet.includes('All branches') ? 'All branches' : 'Selected branch';

  await context.close();

  return {
    company: profile.company,
    profileId: creds.profileId,
    userEmail: creds.email,
    period: { startDate: '2000-01-01', endDate: new Date().toISOString().slice(0, 10) },
    branchScopeObserved: branchNote,
    rpcRowsCaptured: previewRows.length,
    legacyFooterCount: legacy.footerRowCount,
    analysis,
    extractionMethod: previewRows.length
      ? 'legacy_dom_scrape + unified_rpc_intercept'
      : 'legacy_dom_scrape_only — RPC intercept empty',
  };
}

let browser;
async function main() {
  const credCheck = PROFILE_ORDER.filter((id) => TARGETS.includes(id)).map((id) =>
    resolveThreeCompanyProfileCredentials(id, profilesRaw),
  );
  const missing = credCheck.filter((c) => !c.ok);
  if (missing.length) {
    console.error('Missing credentials');
    process.exit(2);
  }

  browser = await chromium.launch({ headless: true });
  const results = {};

  for (const creds of credCheck) {
    console.log(`\n=== ${creds.profileId} ===`);
    try {
      results[creds.profileId] = await extractCompany(creds);
      console.log(
        `legacy=${results[creds.profileId].analysis.legacyRowCount} preview=${results[creds.profileId].analysis.previewRowCount} ` +
          `legacyOnly=${results[creds.profileId].analysis.legacyOnlyCount} previewOnly=${results[creds.profileId].analysis.previewOnlyCount}`,
      );
    } catch (e) {
      results[creds.profileId] = { error: String(e.message || e), status: 'NEEDS_MANUAL_RETRY' };
      console.error(e.message || e);
    }
  }

  await browser.close();
  fs.mkdirSync(EVIDENCE, { recursive: true });

  for (const id of TARGETS) {
    const r = results[id];
    if (!r?.analysis) continue;
    const out = {
      run: 'PHASE_3B_E_ROW_DELTA',
      generatedAt: new Date().toISOString(),
      approvalStatus: 'CANDIDATE_ONLY — NOT FINANCE APPROVED',
      ...r,
    };
    fs.writeFileSync(path.join(EVIDENCE, `${id}-row-delta.json`), JSON.stringify(out, null, 2));

    const a = r.analysis;
    const md = `# Row delta — ${r.company} (Phase 3B-E)

**Period:** ${r.period.startDate} to ${r.period.endDate}  
**Branch observed:** ${r.branchScopeObserved}  
**Method:** ${r.extractionMethod}

## Counts

| Bucket | Rows | Cash In | Cash Out |
|--------|------|---------|----------|
| Legacy (DOM) | ${a.legacyRowCount} | — | — |
| Preview (RPC) | ${a.previewRowCount} | — | — |
| Legacy only | ${a.legacyOnlyCount} | ${a.legacyOnlyTotals.cashIn} | ${a.legacyOnlyTotals.cashOut} |
| Preview only | ${a.previewOnlyCount} | ${a.previewOnlyTotals.cashIn} | ${a.previewOnlyTotals.cashOut} |

## Preview-only by reference type

${Object.entries(a.byReferenceTypePreviewOnly).map(([k, v]) => `- **${k}:** ${v.count} rows · In ${v.cashIn} · Out ${v.cashOut}`).join('\n') || '—'}

## Legacy-only by source module

${Object.entries(a.bySourceModuleLegacyOnly).map(([k, v]) => `- **${k}:** ${v.count} rows · In ${v.cashIn} · Out ${v.cashOut}`).join('\n') || '—'}

## Sample preview-only rows (first 15)

${a.samplePreviewOnly.map((s) => `- ${s.date} · ${s.referenceType} · In ${s.debit} Out ${s.credit} · ${s.description}`).join('\n') || '—'}

## Sample legacy-only rows (first 15)

${a.sampleLegacyOnly.map((s) => `- ${s.date} · ${s.sourceModule} · ${s.status} · In ${s.cashIn} Out ${s.cashOut} · ${s.reference}`).join('\n') || '—'}

> ${a.matchNote}
`;
    fs.writeFileSync(path.join(EVIDENCE, `${id}-row-delta.md`), md);
  }

  fs.writeFileSync(path.join(EVIDENCE, 'row-delta-raw.json'), JSON.stringify(results, null, 2));
  console.log('\nWrote row delta files');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
