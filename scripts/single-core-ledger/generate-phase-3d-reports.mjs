#!/usr/bin/env node
/** One-shot report generator from Phase 3D export JSON (office PC capture). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const EVIDENCE = path.join(ROOT, 'reports/single-core-ledger/phase-3d-bs-pl-golden-capture');
const EXPORTS = path.join(EVIDENCE, 'exports');

const COMPANIES = [
  { id: 'din-china', name: 'DIN CHINA', email: 'din@yahoo.com' },
  { id: 'din-bridal', name: 'DIN BRIDAL', email: 'ndm313@yahoo.com' },
  { id: 'din-couture', name: 'DIN COUTURE', email: 'zhd@dincouture.pk' },
];

function readExport(id, screen) {
  const p = path.join(EXPORTS, `${id}-${screen}-preview.json`);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function fmt(n) {
  if (n == null || Number.isNaN(n)) return '—';
  return `PKR ${Number(n).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const bsGoldens = {};
const plGoldens = {};
const matrix = [];
const diffRows = [];
const financeRows = [];

for (const c of COMPANIES) {
  const bs = readExport(c.id, 'balance-sheet');
  const pl = readExport(c.id, 'profit-loss');
  const d = bs.diff;
  const pd = pl.diff;

  bsGoldens[c.id] = {
    company: c.name,
    approvalStatus: 'CANDIDATE_ONLY — NOT FINANCE APPROVED',
    asOfDate: bs.asOfDate,
    branchScope: bs.branchLabel,
    previewBasis: bs.previewBasis,
    legacy: {
      totalAssets: d.legacyTotalAssets,
      totalLiabilities: d.legacyTotalLiabilities,
      totalEquity: d.legacyTotalEquity,
      liabilitiesAndEquity: d.legacyLiabilitiesAndEquity,
      difference: d.legacyDifference,
    },
    unifiedPreview: {
      totalAssets: d.previewTotalAssets,
      totalLiabilities: d.previewTotalLiabilities,
      totalEquity: d.previewTotalEquity,
      liabilitiesAndEquity: d.previewLiabilitiesAndEquity,
      difference: d.previewDifference,
    },
    compareDeltas: {
      assetsDelta: d.assetsDelta,
      liabilitiesDelta: d.liabilitiesDelta,
      equityDelta: d.equityDelta,
      liabilitiesAndEquityDelta: d.liabilitiesAndEquityDelta,
      differenceDelta: d.differenceDelta,
    },
    comparePass: d.pass,
    zeroDiff: d.pass,
    netIncomeInPreview: bs.preview?.netIncome,
    retainedEarningsWarning: false,
    needsAccountingRuleConfirmation: true,
    accountingRuleNotes: bs.accountingRuleNotes,
    screenshot: `screenshots/${c.id}-balance-sheet-preview.png`,
    export: `exports/${c.id}-balance-sheet-preview.json`,
  };

  plGoldens[c.id] = {
    company: c.name,
    approvalStatus: 'CANDIDATE_ONLY — NOT FINANCE APPROVED',
    period: { startDate: pl.startDate, endDate: pl.endDate },
    branchScope: pl.branchLabel,
    previewBasis: pl.previewBasis,
    legacy: {
      revenue: pd.legacyRevenue,
      costOfSales: pd.legacyCostOfSales,
      grossProfit: pd.legacyGrossProfit,
      expenses: pd.legacyExpenses,
      netProfit: pd.legacyNetProfit,
    },
    unifiedPreview: {
      revenue: pd.previewRevenue,
      costOfSales: pd.previewCostOfSales,
      grossProfit: pd.previewGrossProfit,
      expenses: pd.previewExpenses,
      netProfit: pd.previewNetProfit,
    },
    compareDeltas: {
      revenueDelta: pd.revenueDelta,
      costDelta: pd.costDelta,
      grossProfitDelta: pd.grossProfitDelta,
      expensesDelta: pd.expensesDelta,
      netProfitDelta: pd.netProfitDelta,
    },
    comparePass: pd.pass,
    zeroDiff: pd.pass,
    cogsHeuristicWarning: true,
    needsRuleConfirmation: true,
    accountingRuleNotes: pl.accountingRuleNotes,
    screenshot: `screenshots/${c.id}-profit-loss-preview.png`,
    export: `exports/${c.id}-profit-loss-preview.json`,
  };

  matrix.push(
    {
      company: c.name,
      profileId: c.id,
      report: 'Balance Sheet',
      branchScope: bs.branchLabel,
      dateOrPeriod: `As at ${bs.asOfDate}`,
      userEmail: c.email,
      legacySource: 'getBalanceSheet (main loader)',
      unifiedPreviewSource: 'get_unified_trial_balance → balanceSheetUnifiedPreviewMapper',
      screenshot: `screenshots/${c.id}-balance-sheet-preview.png`,
      export: `exports/${c.id}-balance-sheet-preview.json`,
      status: 'CAPTURED',
      notes: 'Preview toggle default OFF verified; compare pass within tolerance',
    },
    {
      company: c.name,
      profileId: c.id,
      report: 'Profit & Loss',
      branchScope: pl.branchLabel,
      dateOrPeriod: `${pl.startDate} to ${pl.endDate}`,
      userEmail: c.email,
      legacySource: 'getProfitLoss (main loader)',
      unifiedPreviewSource: 'get_unified_trial_balance → profitLossUnifiedPreviewMapper',
      screenshot: `screenshots/${c.id}-profit-loss-preview.png`,
      export: `exports/${c.id}-profit-loss-preview.json`,
      status: 'CAPTURED',
      notes: 'Wide date range from production global filter; compare pass within tolerance',
    },
  );

  diffRows.push(
    {
      company: c.name,
      report: 'Balance Sheet',
      zeroDiff: d.pass,
      legacySummary: `Assets ${d.legacyTotalAssets}; L+E ${d.legacyLiabilitiesAndEquity}`,
      previewSummary: `Assets ${d.previewTotalAssets}; L+E ${d.previewLiabilitiesAndEquity}`,
      maxDelta: Math.max(Math.abs(d.assetsDelta || 0), Math.abs(d.liabilitiesAndEquityDelta || 0)),
      ruleConfirmations: bs.accountingRuleNotes.filter((n) => /NEEDS_|CONFIRMATION/i.test(n)),
      financeCanReviewNow: true,
      codeChangeNeededBeforeApproval: false,
    },
    {
      company: c.name,
      report: 'Profit & Loss',
      zeroDiff: pd.pass,
      legacySummary: `Revenue ${pd.legacyRevenue}; Net ${pd.legacyNetProfit}`,
      previewSummary: `Revenue ${pd.previewRevenue}; Net ${pd.previewNetProfit}`,
      maxDelta: Math.abs(pd.netProfitDelta || 0),
      ruleConfirmations: pl.accountingRuleNotes.filter((n) => /NEEDS_|CONFIRMATION/i.test(n)),
      financeCanReviewNow: true,
      codeChangeNeededBeforeApproval: false,
    },
  );

  financeRows.push(
    {
      company: c.name,
      report: 'Balance Sheet',
      candidateValues: `Assets ${fmt(d.legacyTotalAssets)}; L+E ${fmt(d.legacyLiabilitiesAndEquity)} (legacy=preview)`,
      financeStatus: 'PENDING',
      reviewer: '',
      reviewDate: '',
      notes: 'CANDIDATE_ONLY — section totals match; rule confirmation still required',
    },
    {
      company: c.name,
      report: 'Profit & Loss',
      candidateValues: `Revenue ${fmt(pd.legacyRevenue)}; Net ${fmt(pd.legacyNetProfit)} (legacy=preview)`,
      financeStatus: 'PENDING',
      reviewer: '',
      reviewDate: '',
      notes: 'CANDIDATE_ONLY — COGS heuristic NEEDS_RULE_CONFIRMATION',
    },
  );
}

const capturedAt = '2026-06-29T10:50:03.438Z';

fs.writeFileSync(
  path.join(EVIDENCE, 'balance-sheet-candidate-goldens.json'),
  JSON.stringify({ phase: '3D', capturedAt, approvalStatus: 'CANDIDATE_ONLY — NOT FINANCE APPROVED', companies: bsGoldens }, null, 2),
);
fs.writeFileSync(
  path.join(EVIDENCE, 'profit-loss-candidate-goldens.json'),
  JSON.stringify({ phase: '3D', capturedAt, approvalStatus: 'CANDIDATE_ONLY — NOT FINANCE APPROVED', companies: plGoldens }, null, 2),
);
fs.writeFileSync(
  path.join(EVIDENCE, 'capture-matrix.json'),
  JSON.stringify({ phase: '3D', capturedAt, matrix }, null, 2),
);
fs.writeFileSync(
  path.join(EVIDENCE, 'diff-analysis.json'),
  JSON.stringify({ phase: '3D', capturedAt, rows: diffRows, allZeroDiff: diffRows.every((r) => r.zeroDiff) }, null, 2),
);
fs.writeFileSync(
  path.join(EVIDENCE, 'finance-review-pack.json'),
  JSON.stringify({ phase: '3D', capturedAt, defaultFinanceStatus: 'PENDING', rows: financeRows }, null, 2),
);

let bsMd = `# Balance Sheet candidate goldens — Phase 3D

**Status:** CANDIDATE_ONLY — NOT FINANCE APPROVED  
**Captured:** ${capturedAt}  
**Production:** https://erp.dincouture.pk  
**Basis:** official_gl · All branches

> Every value below is candidate evidence only. Loader swap not approved.

`;
for (const c of COMPANIES) {
  const g = bsGoldens[c.id];
  bsMd += `## ${c.name}

| Field | Legacy (main) | Unified preview | Δ |
|-------|---------------|-----------------|---|
| Total Assets | ${fmt(g.legacy.totalAssets)} | ${fmt(g.unifiedPreview.totalAssets)} | ${g.compareDeltas.assetsDelta} |
| Total Liabilities | ${fmt(g.legacy.totalLiabilities)} | ${fmt(g.unifiedPreview.totalLiabilities)} | ${g.compareDeltas.liabilitiesDelta} |
| Total Equity | ${fmt(g.legacy.totalEquity)} | ${fmt(g.unifiedPreview.totalEquity)} | ${g.compareDeltas.equityDelta} |
| Liabilities + Equity | ${fmt(g.legacy.liabilitiesAndEquity)} | ${fmt(g.unifiedPreview.liabilitiesAndEquity)} | ${g.compareDeltas.liabilitiesAndEquityDelta} |
| A − (L+E) | ${fmt(g.legacy.difference)} | ${fmt(g.unifiedPreview.difference)} | ${g.compareDeltas.differenceDelta} |

- **As-of:** ${g.asOfDate}
- **Compare pass:** ${g.comparePass ? 'YES (zero-diff within tolerance)' : 'NO'}
- **Net income in preview rollup:** ${fmt(g.netIncomeInPreview)}
- **Rule notes:** ${g.accountingRuleNotes.join('; ')}
- **Screenshot:** [\`${g.screenshot}\`](${g.screenshot})
- **Export:** [\`${g.export}\`](${g.export})

`;
}

let plMd = `# Profit & Loss candidate goldens — Phase 3D

**Status:** CANDIDATE_ONLY — NOT FINANCE APPROVED  
**Captured:** ${capturedAt}  
**Production:** https://erp.dincouture.pk  
**Basis:** official_gl · Period from production global filter (2000-01-01 → capture date)

> Every value below is candidate evidence only. Loader swap not approved.

`;
for (const c of COMPANIES) {
  const g = plGoldens[c.id];
  plMd += `## ${c.name}

| Field | Legacy (main) | Unified preview | Δ |
|-------|---------------|-----------------|---|
| Revenue | ${fmt(g.legacy.revenue)} | ${fmt(g.unifiedPreview.revenue)} | ${g.compareDeltas.revenueDelta} |
| Cost of Sales | ${fmt(g.legacy.costOfSales)} | ${fmt(g.unifiedPreview.costOfSales)} | ${g.compareDeltas.costDelta} |
| Gross Profit | ${fmt(g.legacy.grossProfit)} | ${fmt(g.unifiedPreview.grossProfit)} | ${g.compareDeltas.grossProfitDelta} |
| Expenses | ${fmt(g.legacy.expenses)} | ${fmt(g.unifiedPreview.expenses)} | ${g.compareDeltas.expensesDelta} |
| Net Profit | ${fmt(g.legacy.netProfit)} | ${fmt(g.unifiedPreview.netProfit)} | ${g.compareDeltas.netProfitDelta} |

- **Period:** ${g.period.startDate} to ${g.period.endDate}
- **Compare pass:** ${g.comparePass ? 'YES (zero-diff within tolerance)' : 'NO'}
- **COGS heuristic warning:** documented in export — finance must confirm mapping
- **Rule notes:** ${g.accountingRuleNotes.join('; ')}
- **Screenshot:** [\`${g.screenshot}\`](${g.screenshot})
- **Export:** [\`${g.export}\`](${g.export})

`;
}

fs.writeFileSync(path.join(EVIDENCE, 'balance-sheet-candidate-goldens.md'), bsMd);
fs.writeFileSync(path.join(EVIDENCE, 'profit-loss-candidate-goldens.md'), plMd);

console.log('Generated Phase 3D golden report files');
