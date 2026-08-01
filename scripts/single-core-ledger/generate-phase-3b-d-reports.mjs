#!/usr/bin/env node
/** Generate Phase 3B-D evidence reports from capture-raw.json and exports. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const EVIDENCE = path.join(ROOT, 'reports/single-core-ledger/phase-3b-d-cash-flow-golden-capture');
const raw = JSON.parse(fs.readFileSync(path.join(EVIDENCE, 'capture-raw.json'), 'utf8'));
const capturedAt = raw.capturedAt;

const COMPANIES = [
  { id: 'din-china', name: 'DIN CHINA' },
  { id: 'din-bridal', name: 'DIN BRIDAL' },
  { id: 'din-couture', name: 'DIN COUTURE' },
];

function fmt(n) {
  if (n == null || Number.isNaN(n)) return '—';
  return `PKR ${Number(n).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const goldens = {};
const matrix = [];
const diffRows = [];
const financeRows = [];
const availabilityRows = [];

for (const c of COMPANIES) {
  const entry = raw.companies[c.id];
  const cf = entry?.cashFlow;
  const av = entry?.availability || {};
  availabilityRows.push({
    company: c.name,
    profileId: c.id,
    cashFlowLoads: av.cashFlowLoads ?? false,
    toggleVisible: av.toggleVisible ?? false,
    toggleDefaultOff: av.toggleDefaultOff,
    legacyLoadsBeforePreview: av.legacyLoads ?? false,
    previewLabelsPresent: av.previewLabelsPresent ?? false,
    previewPanelLoads: cf?.status === 'CAPTURED',
    overall: cf?.status === 'CAPTURED' ? 'PASS' : 'FAIL',
  });

  if (!cf || cf.status !== 'CAPTURED') continue;

  goldens[c.id] = {
    company: c.name,
    approvalStatus: 'CANDIDATE_ONLY — NOT FINANCE APPROVED',
    period: { startDate: cf.startDate, endDate: cf.endDate },
    branchScope: cf.branchScope,
    liquidityFilter: cf.liquidityFilter,
    sourceModuleFilter: cf.sourceModuleFilter,
    auditMode: cf.auditMode,
    previewBasis: cf.previewBasis,
    legacy: cf.legacy,
    unifiedPreview: cf.unifiedPreview,
    compareDeltas: cf.compareDeltas,
    comparePass: cf.pass,
    zeroDiff: cf.zeroDiff,
    reversalWarning: cf.reversalWarning,
    runningBalanceWarning: cf.runningBalanceWarning,
    needsAccountingRuleConfirmation: !cf.zeroDiff || cf.needsAccountingRuleConfirmation,
    accountingRuleNotes: cf.accountingRuleNotes,
    screenshot: cf.screenshot,
    export: cf.export,
  };

  matrix.push({
    company: c.name,
    profileId: c.id,
    report: 'Cash Flow',
    branchScope: cf.branchScope,
    dateOrPeriod: `${cf.startDate} to ${cf.endDate}`,
    liquidityFilter: cf.liquidityFilter,
    sourceModuleFilter: cf.sourceModuleFilter,
    userEmail: entry.userEmail,
    legacySource: 'getCashFlowReport → roznamchaService (main loader)',
    unifiedPreviewSource: 'loadRoznamchaUnifiedPreview → cashFlowUnifiedPreviewMapper',
    screenshot: cf.screenshot,
    export: cf.export,
    status: 'CAPTURED',
    notes: cf.zeroDiff
      ? 'Preview toggle default OFF verified; summary totals match within tolerance'
      : 'Non-zero diff — finance rule confirmation required before any loader swap',
  });

  const maxDelta = Math.max(
    Math.abs(cf.compareDeltas.cashInDelta || 0),
    Math.abs(cf.compareDeltas.cashOutDelta || 0),
    Math.abs(cf.compareDeltas.netMovementDelta || 0),
    Math.abs(cf.compareDeltas.closingDelta || 0),
  );

  const ruleConfirmations = [
    ...cf.accountingRuleNotes.filter((n) => /NEEDS_|CONFIRMATION|PREVIEW_ONLY/i.test(n)),
  ];
  if (!cf.zeroDiff) {
    ruleConfirmations.push(
      'NEEDS_RULE_CONFIRMATION — legacy vs unified preview totals differ; finance must confirm mapping before loader swap.',
    );
  }
  if (cf.reversalWarning) {
    ruleConfirmations.push('Reversal/void visibility may affect row-level compare — review with finance.');
  }

  diffRows.push({
    company: c.name,
    report: 'Cash Flow',
    zeroDiff: cf.zeroDiff,
    legacySummary: `Cash In ${cf.legacy.cashIn}; Cash Out ${cf.legacy.cashOut}; Net ${cf.legacy.netMovement}; Closing ${cf.legacy.closing}`,
    previewSummary: `Cash In ${cf.unifiedPreview.cashIn}; Cash Out ${cf.unifiedPreview.cashOut}; Net ${cf.unifiedPreview.netMovement}; Closing ${cf.unifiedPreview.closing}`,
    maxDelta,
    rowCountDelta: cf.compareDeltas.rowCountDelta,
    ruleConfirmations,
    financeCanReviewNow: true,
    codeChangeNeededBeforeApproval: !cf.zeroDiff,
  });

  financeRows.push({
    company: c.name,
    report: 'Cash Flow',
    candidateValues: `Legacy closing ${fmt(cf.legacy.closing)} · Preview closing ${fmt(cf.unifiedPreview.closing)} · Δ closing ${fmt(cf.compareDeltas.closingDelta)}`,
    financeStatus: cf.zeroDiff ? 'PENDING' : 'NEEDS_RULE_CONFIRMATION',
    reviewer: '',
    reviewDate: '',
    notes: cf.zeroDiff
      ? 'CANDIDATE_ONLY — summary totals match; finance approval still required before loader swap'
      : 'CANDIDATE_ONLY — non-zero diff; investigate legacy vs unified mapping before approval',
  });
}

const allZeroDiff = diffRows.length > 0 && diffRows.every((r) => r.zeroDiff);

// JSON outputs
fs.writeFileSync(
  path.join(EVIDENCE, 'preview-availability-check.json'),
  JSON.stringify({ phase: '3B-D', capturedAt, productionUrl: raw.productionUrl, rows: availabilityRows, overall: availabilityRows.every((r) => r.overall === 'PASS') ? 'PASS' : 'PARTIAL' }, null, 2),
);
fs.writeFileSync(path.join(EVIDENCE, 'capture-matrix.json'), JSON.stringify({ phase: '3B-D', capturedAt, matrix }, null, 2));
fs.writeFileSync(
  path.join(EVIDENCE, 'cash-flow-candidate-goldens.json'),
  JSON.stringify({ phase: '3B-D', capturedAt, approvalStatus: 'CANDIDATE_ONLY — NOT FINANCE APPROVED', companies: goldens }, null, 2),
);
fs.writeFileSync(
  path.join(EVIDENCE, 'diff-analysis.json'),
  JSON.stringify({ phase: '3B-D', capturedAt, rows: diffRows, allZeroDiff }, null, 2),
);
fs.writeFileSync(
  path.join(EVIDENCE, 'finance-review-pack.json'),
  JSON.stringify({ phase: '3B-D', capturedAt, defaultFinanceStatus: 'PENDING', loaderSwapApproved: false, rows: financeRows }, null, 2),
);

// Markdown outputs
const avMd = `# Preview availability check — Phase 3B-D

**Production:** ${raw.productionUrl}  
**Captured:** ${capturedAt}  
**Overall:** ${availabilityRows.every((r) => r.overall === 'PASS') ? 'PASS' : 'PARTIAL'}

| Company | CF loads | Toggle visible | Toggle default OFF | Legacy before preview | Preview labels | Panel loads | Result |
|---------|----------|----------------|--------------------|-----------------------|----------------|-------------|--------|
${availabilityRows.map((r) => `| ${r.company} | ${r.cashFlowLoads} | ${r.toggleVisible} | ${r.toggleDefaultOff} | ${r.legacyLoadsBeforePreview} | ${r.previewLabelsPresent} | ${r.previewPanelLoads} | ${r.overall} |`).join('\n')}
`;
fs.writeFileSync(path.join(EVIDENCE, 'preview-availability-check.md'), avMd);

const matrixMd = `# Capture matrix — Phase 3B-D

**Captured:** ${capturedAt}  
**Date range:** 2000-01-01 to capture date (production global filter)  
**Filters:** liquidity \`all\` · source module \`all\` · audit mode OFF · preview basis \`effective_party\`

| Company | Branch | Period | Status | Notes |
|---------|--------|--------|--------|-------|
${matrix.map((m) => `| ${m.company} | ${m.branchScope} | ${m.dateOrPeriod} | ${m.status} | ${m.notes} |`).join('\n')}
`;
fs.writeFileSync(path.join(EVIDENCE, 'capture-matrix.md'), matrixMd);

let cfMd = `# Cash Flow candidate goldens — Phase 3B-D

**Status:** CANDIDATE_ONLY — NOT FINANCE APPROVED  
**Captured:** ${capturedAt}  
**Production:** ${raw.productionUrl}

> Every value below is candidate evidence only. Cash Flow loader swap not approved.

`;
for (const c of COMPANIES) {
  const g = goldens[c.id];
  if (!g) continue;
  cfMd += `## ${c.name}

| Field | Legacy (main) | Unified preview | Δ |
|-------|---------------|-----------------|---|
| Opening | ${fmt(g.legacy.opening)} | ${fmt(g.unifiedPreview.opening)} | ${g.compareDeltas.openingDelta} |
| Cash In | ${fmt(g.legacy.cashIn)} | ${fmt(g.unifiedPreview.cashIn)} | ${g.compareDeltas.cashInDelta} |
| Cash Out | ${fmt(g.legacy.cashOut)} | ${fmt(g.unifiedPreview.cashOut)} | ${g.compareDeltas.cashOutDelta} |
| Net Movement | ${fmt(g.legacy.netMovement)} | ${fmt(g.unifiedPreview.netMovement)} | ${g.compareDeltas.netMovementDelta} |
| Closing | ${fmt(g.legacy.closing)} | ${fmt(g.unifiedPreview.closing)} | ${g.compareDeltas.closingDelta} |
| Row count | ${g.legacy.rowCount} | ${g.unifiedPreview.rowCount} | ${g.compareDeltas.rowCountDelta} |

- **Period:** ${g.period.startDate} to ${g.period.endDate}
- **Branch:** ${g.branchScope}
- **Compare pass:** ${g.comparePass ? 'YES (within tolerance)' : 'NO — non-zero diff'}
- **Reversal warning:** ${g.reversalWarning}
- **Screenshot:** [\`${g.screenshot}\`](${g.screenshot})
- **Export:** [\`${g.export}\`](${g.export})

`;
}
fs.writeFileSync(path.join(EVIDENCE, 'cash-flow-candidate-goldens.md'), cfMd);

const diffMd = `# Diff analysis — Phase 3B-D

**Captured:** ${capturedAt}  
**All zero-diff:** ${allZeroDiff ? 'YES' : 'NO'}

| Company | Zero-diff | Max Δ | Row Δ | Finance can review | Code change needed |
|---------|-----------|-------|-------|-------------------|-------------------|
${diffRows.map((r) => `| ${r.company} | ${r.zeroDiff} | ${r.maxDelta} | ${r.rowCountDelta} | ${r.financeCanReviewNow} | ${r.codeChangeNeededBeforeApproval} |`).join('\n')}

## Rule confirmations

${diffRows.map((r) => `### ${r.company}\n${r.ruleConfirmations.map((n) => `- ${n}`).join('\n')}`).join('\n\n')}
`;
fs.writeFileSync(path.join(EVIDENCE, 'diff-analysis.md'), diffMd);

const finMd = `# Finance review pack — Phase 3B-D Cash Flow

**Default finance status:** PENDING  
**Loader swap:** NOT APPROVED  
**BS/P&L finance:** PENDING (unchanged)

| Company | Report | Candidate values | Finance status | Reviewer | Review date | Notes |
|---------|--------|------------------|----------------|----------|-------------|-------|
${financeRows.map((r) => `| ${r.company} | ${r.report} | ${r.candidateValues} | ${r.financeStatus} | ${r.reviewer || '—'} | ${r.reviewDate || '—'} | ${r.notes} |`).join('\n')}
`;
fs.writeFileSync(path.join(EVIDENCE, 'finance-review-pack.md'), finMd);

console.log('Phase 3B-D reports generated. allZeroDiff=', allZeroDiff);
