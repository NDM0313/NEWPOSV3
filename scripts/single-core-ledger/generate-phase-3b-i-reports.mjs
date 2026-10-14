#!/usr/bin/env node
/** Generate Phase 3B-I evidence reports from capture-raw.json and exports. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const EVIDENCE = path.join(ROOT, 'reports/single-core-ledger/phase-3b-i-cash-flow-aligned-golden-capture');
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

for (const c of COMPANIES) {
  const entry = raw.companies[c.id];
  const cf = entry?.cashFlow;
  if (!cf || cf.status !== 'CAPTURED') continue;

  goldens[c.id] = {
    company: c.name,
    approvalStatus: 'CANDIDATE_ONLY — NOT FINANCE APPROVED',
    financeRules: { Q4: 'A', Q5: 'C', Q7: 'B' },
    period: { startDate: cf.startDate, endDate: cf.endDate },
    branchScope: cf.branchScope,
    liquidityFilter: cf.liquidityFilter,
    sourceModuleFilter: cf.sourceModuleFilter,
    auditMode: cf.auditMode,
    previewBasis: cf.previewBasis,
    legacy: cf.legacy,
    alignedPreview: cf.alignedPreview,
    compareDeltas: cf.compareDeltas,
    rowKeyedCounts: cf.rowKeyedCounts,
    transferBucketEffect: cf.transferBucketEffect,
    openingBucketEffect: cf.openingBucketEffect,
    comparePass: cf.pass,
    zeroDiff: cf.zeroDiff,
    screenshot: cf.screenshot,
    export: cf.export,
    diffReport: cf.diffReport,
  };

  matrix.push({
    company: c.name,
    profileId: c.id,
    report: 'Cash Flow (aligned preview)',
    branchScope: cf.branchScope,
    dateOrPeriod: `${cf.startDate} to ${cf.endDate}`,
    liquidityFilter: cf.liquidityFilter,
    sourceModuleFilter: cf.sourceModuleFilter,
    auditMode: cf.auditMode,
    previewBasis: cf.previewBasis,
    financeRules: 'Q4=A Q5=C Q7=B',
    userEmail: entry.userEmail,
    legacySource: 'getCashFlowReport → roznamchaService (official)',
    alignedPreviewSource: 'loadRoznamchaUnifiedPreview → cashFlowUnifiedPreviewMapper (3B-H alignment)',
    screenshot: cf.screenshot,
    export: cf.export,
    status: 'CAPTURED',
    zeroDiff: cf.zeroDiff ? 'ZERO-DIFF' : 'NON-ZERO-DIFF',
    notes: cf.zeroDiff
      ? 'Aligned preview summary matches legacy within tolerance'
      : 'Non-zero diff — finance review required; loader swap NOT APPROVED',
  });

  const maxDelta = Math.max(
    Math.abs(cf.compareDeltas.cashInDelta || 0),
    Math.abs(cf.compareDeltas.cashOutDelta || 0),
    Math.abs(cf.compareDeltas.netMovementDelta || 0),
    Math.abs(cf.compareDeltas.closingDelta || 0),
  );

  diffRows.push({
    company: c.name,
    report: 'Cash Flow aligned preview',
    zeroDiff: cf.zeroDiff,
    compareLabel: cf.zeroDiff ? 'ZERO-DIFF' : 'NON-ZERO-DIFF',
    legacySummary: `Cash In ${cf.legacy.cashIn}; Cash Out ${cf.legacy.cashOut}; Closing ${cf.legacy.closing}`,
    alignedPreviewSummary: `Cash In ${cf.alignedPreview.cashIn}; Cash Out ${cf.alignedPreview.cashOut}; Closing ${cf.alignedPreview.closing}`,
    closingDelta: cf.compareDeltas.closingDelta,
    cashInDelta: cf.compareDeltas.cashInDelta,
    cashOutDelta: cf.compareDeltas.cashOutDelta,
    netMovementDelta: cf.compareDeltas.netMovementDelta,
    maxDelta,
    rowCountDelta: cf.compareDeltas.rowCountDelta,
    rowKeyedCounts: cf.rowKeyedCounts,
    transferBucketEffect: cf.transferBucketEffect,
    openingBucketEffect: cf.openingBucketEffect,
    financeCanReviewNow: true,
    loaderSwapApproved: false,
  });

  financeRows.push({
    company: c.name,
    report: 'Cash Flow aligned preview',
    candidateValues: `Legacy closing ${fmt(cf.legacy.closing)} · Aligned preview closing ${fmt(cf.alignedPreview.closing)} · Δ closing ${fmt(cf.compareDeltas.closingDelta)}`,
    financeStatus: 'PENDING',
    reviewer: 'Nadeem Khan',
    reviewDate: '2026-06-29',
    notes: 'CANDIDATE_ONLY — NOT FINANCE APPROVED. Cash Flow loader swap NOT APPROVED.',
  });
}

const allZeroDiff = diffRows.length > 0 && diffRows.every((r) => r.zeroDiff);
const zeroDiffCompanies = diffRows.filter((r) => r.zeroDiff).map((r) => r.company);
const nonZeroDiffCompanies = diffRows.filter((r) => !r.zeroDiff).map((r) => r.company);

fs.writeFileSync(path.join(EVIDENCE, 'capture-matrix.json'), JSON.stringify({ phase: '3B-I', capturedAt, matrix }, null, 2));
fs.writeFileSync(
  path.join(EVIDENCE, 'aligned-cash-flow-candidate-goldens.json'),
  JSON.stringify({
    phase: '3B-I',
    capturedAt,
    approvalStatus: 'CANDIDATE_ONLY — NOT FINANCE APPROVED',
    financeRules: { Q4: 'A', Q5: 'C', Q7: 'B' },
    loaderSwapApproved: false,
    companies: goldens,
  }, null, 2),
);
fs.writeFileSync(
  path.join(EVIDENCE, 'diff-analysis.json'),
  JSON.stringify({
    phase: '3B-I',
    capturedAt,
    allZeroDiff,
    zeroDiffCompanies,
    nonZeroDiffCompanies,
    rows: diffRows,
  }, null, 2),
);
fs.writeFileSync(
  path.join(EVIDENCE, 'finance-review-pack.json'),
  JSON.stringify({
    phase: '3B-I',
    capturedAt,
    defaultFinanceStatus: 'PENDING',
    loaderSwapApproved: false,
    officialLegacyCashFlowUnchanged: true,
    financeRules: { Q4: 'A', Q5: 'C', Q7: 'B' },
    reviewer: 'Nadeem Khan',
    reviewDate: '2026-06-29',
    rows: financeRows,
  }, null, 2),
);

const matrixMd = `# Capture matrix — Phase 3B-I

**Captured:** ${capturedAt}  
**Period:** 2000-01-01 to 2026-06-29  
**Filters:** liquidity \`all\` · source module \`all\` · audit OFF · preview basis \`effective_party\`  
**Rules:** Q4=A · Q5=C · Q7=B  
**Status:** CANDIDATE_ONLY — NOT FINANCE APPROVED

| Company | Branch | Period | Zero-diff | Status | Notes |
|---------|--------|--------|-----------|--------|-------|
${matrix.map((m) => `| ${m.company} | ${m.branchScope} | ${m.dateOrPeriod} | ${m.zeroDiff} | ${m.status} | ${m.notes} |`).join('\n')}
`;
fs.writeFileSync(path.join(EVIDENCE, 'capture-matrix.md'), matrixMd);

let cfMd = `# Aligned Cash Flow candidate goldens — Phase 3B-I

**Status:** CANDIDATE_ONLY — NOT FINANCE APPROVED  
**Captured:** ${capturedAt}  
**Production:** ${raw.productionUrl}  
**Finance rules:** Q4=A · Q5=C · Q7=B  
**Loader swap:** NOT APPROVED

`;
for (const c of COMPANIES) {
  const g = goldens[c.id];
  if (!g) continue;
  cfMd += `## ${c.name}

| Field | Legacy (official) | Aligned preview | Δ |
|-------|-------------------|-----------------|---|
| Cash In | ${fmt(g.legacy.cashIn)} | ${fmt(g.alignedPreview.cashIn)} | ${g.compareDeltas.cashInDelta} |
| Cash Out | ${fmt(g.legacy.cashOut)} | ${fmt(g.alignedPreview.cashOut)} | ${g.compareDeltas.cashOutDelta} |
| Net Movement | ${fmt(g.legacy.netMovement)} | ${fmt(g.alignedPreview.netMovement)} | ${g.compareDeltas.netMovementDelta} |
| Closing | ${fmt(g.legacy.closing)} | ${fmt(g.alignedPreview.closing)} | ${g.compareDeltas.closingDelta} |
| Row count | ${g.legacy.rowCount} | ${g.alignedPreview.rowCount} | ${g.compareDeltas.rowCountDelta} |

- **Compare:** ${g.zeroDiff ? 'ZERO-DIFF' : 'NON-ZERO-DIFF'}
- **Screenshot:** [\`${g.screenshot}\`](${g.screenshot})
- **Export:** [\`${g.export}\`](${g.export})

`;
}
fs.writeFileSync(path.join(EVIDENCE, 'aligned-cash-flow-candidate-goldens.md'), cfMd);

const diffMd = `# Diff analysis — Phase 3B-I

**Captured:** ${capturedAt}  
**All zero-diff:** ${allZeroDiff ? 'YES' : 'NO'}  
**Zero-diff companies:** ${zeroDiffCompanies.join(', ') || '—'}  
**Non-zero-diff companies:** ${nonZeroDiffCompanies.join(', ') || '—'}

| Company | Compare | Closing Δ | Cash In Δ | Cash Out Δ | Net Δ | Row Δ |
|---------|---------|-----------|-----------|------------|-------|-------|
${diffRows.map((r) => `| ${r.company} | ${r.compareLabel} | ${r.closingDelta} | ${r.cashInDelta} | ${r.cashOutDelta} | ${r.netMovementDelta} | ${r.rowCountDelta} |`).join('\n')}
`;
fs.writeFileSync(path.join(EVIDENCE, 'diff-analysis.md'), diffMd);

const finMd = `# Finance review pack — Phase 3B-I aligned Cash Flow

**Default finance status:** PENDING  
**Loader swap:** NOT APPROVED  
**Official legacy Cash Flow:** unchanged  
**BS/P&L finance:** PENDING (unchanged)  
**Reviewer:** Nadeem Khan  
**Review date:** 2026-06-29  
**Approved preview rules:** Q4=A · Q5=C · Q7=B

| Company | Candidate values | Finance status | Notes |
|---------|------------------|----------------|-------|
${financeRows.map((r) => `| ${r.company} | ${r.candidateValues} | ${r.financeStatus} | ${r.notes} |`).join('\n')}
`;
fs.writeFileSync(path.join(EVIDENCE, 'finance-review-pack.md'), finMd);

console.log('Phase 3B-I reports generated. allZeroDiff=', allZeroDiff);
