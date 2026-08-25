#!/usr/bin/env node
/**
 * Phase 3B-F — read row-keyed Cash Flow export JSON and emit local diff report.
 * Usage: node export-cash-flow-row-diff.mjs <export.json> [outputDir]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const inputPath = process.argv[2];
const outputDir = process.argv[3]
  ? path.resolve(process.argv[3])
  : path.join(ROOT, 'reports/single-core-ledger/phase-3b-f-cash-flow-row-export');

if (!inputPath || !fs.existsSync(inputPath)) {
  console.error('Usage: node export-cash-flow-row-diff.mjs <export.json> [outputDir]');
  process.exit(2);
}

const data = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const diff = data.rowKeyedDiff;
if (!diff) {
  console.error('Export missing rowKeyedDiff — use Phase 3B-F row-keyed export JSON');
  process.exit(1);
}

const report = {
  run: 'PHASE_3B_F_ROW_DIFF_REPORT',
  generatedAt: new Date().toISOString(),
  sourceFile: path.basename(inputPath),
  phase: data.phase,
  companyId: data.companyId,
  period: { from: data.dateFrom, to: data.dateTo },
  summaryDiff: data.diff,
  matchCounts: {
    exact: diff.exactMatches?.length ?? 0,
    strong: diff.strongMatches?.length ?? 0,
    weak: diff.weakMatches?.length ?? 0,
    legacyOnly: diff.legacyOnly?.length ?? 0,
    previewOnly: diff.previewOnly?.length ?? 0,
  },
  thematicBuckets: diff.thematicBuckets ?? [],
};

fs.mkdirSync(outputDir, { recursive: true });
const jsonOut = path.join(outputDir, 'sample-row-diff-report.json');
const mdOut = path.join(outputDir, 'sample-row-diff-report.md');

const md = `# Sample row diff report — Phase 3B-F

**Source:** ${path.basename(inputPath)}  
**Generated:** ${report.generatedAt}

## Match counts

| Tier | Count |
|------|-------|
| Exact | ${report.matchCounts.exact} |
| Strong | ${report.matchCounts.strong} |
| Weak | ${report.matchCounts.weak} |
| Legacy-only | ${report.matchCounts.legacyOnly} |
| Preview-only | ${report.matchCounts.previewOnly} |

## Summary diff

${data.diff ? `- Closing Δ ${data.diff.closingDelta}\n- Cash In Δ ${data.diff.cashInDelta}\n- Cash Out Δ ${data.diff.cashOutDelta}` : '—'}

## Thematic buckets

${(report.thematicBuckets || [])
  .map(
    (b) =>
      `### ${b.label}\n- Rows: ${b.rowCount} · In ${b.cashInTotal} · Out ${b.cashOutTotal} · Net ${b.netImpact}\n- Q: ${b.ruleConfirmationQuestionId || '—'}\n${(b.sampleRefs || []).map((s) => `  - ${s}`).join('\n')}`
  )
  .join('\n\n')}
`;

fs.writeFileSync(jsonOut, JSON.stringify(report, null, 2));
fs.writeFileSync(mdOut, md);
console.log(`Wrote ${jsonOut}`);
console.log(`Wrote ${mdOut}`);
