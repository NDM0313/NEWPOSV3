import fs from 'node:fs';
import path from 'node:path';

function mdTable(headers, rows) {
  const lines = [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
  ];
  for (const row of rows) {
    lines.push(`| ${row.map((c) => String(c ?? '').replace(/\|/g, '\\|')).join(' | ')} |`);
  }
  return lines.join('\n');
}

export function writeAllReports(outputDir, audit) {
  fs.mkdirSync(outputDir, { recursive: true });

  const paths = {
    json: path.join(outputDir, 'din_china_financial_integrity_dry_run.json'),
    salesRevenue: path.join(outputDir, 'din_china_sales_revenue_gl_tieout_dry_run.md'),
    inventoryCogs: path.join(outputDir, 'din_china_inventory_cogs_tieout_dry_run.md'),
    purchaseInventory: path.join(outputDir, 'din_china_purchase_inventory_gl_tieout_dry_run.md'),
    arPayment: path.join(outputDir, 'din_china_ar_payment_tieout_dry_run.md'),
    balanceSheet: path.join(outputDir, 'din_china_balance_sheet_issue_analysis.md'),
    repairPlan: path.join(outputDir, 'din_china_financial_gl_repair_plan.md'),
    saleReturnDiscount: path.join(
      outputDir,
      'din_china_sale_return_discount_gl_tieout_dry_run.md',
    ),
  };

  fs.writeFileSync(paths.json, JSON.stringify(audit, null, 2), 'utf8');
  fs.writeFileSync(paths.salesRevenue, buildSalesRevenueMd(audit), 'utf8');
  fs.writeFileSync(paths.inventoryCogs, buildInventoryCogsMd(audit), 'utf8');
  fs.writeFileSync(paths.purchaseInventory, buildPurchaseInventoryMd(audit), 'utf8');
  fs.writeFileSync(paths.arPayment, buildArPaymentMd(audit), 'utf8');
  fs.writeFileSync(paths.balanceSheet, buildBalanceSheetMd(audit), 'utf8');
  fs.writeFileSync(paths.repairPlan, buildRepairPlanMd(audit), 'utf8');
  fs.writeFileSync(paths.saleReturnDiscount, buildSaleReturnDiscountMd(audit), 'utf8');

  return paths;
}

function buildSalesRevenueMd(audit) {
  const t = audit.taskA;
  const lines = [
    '# DIN CHINA Sales Revenue GL Tie-Out — Dry Run',
    '',
    `**Generated:** ${audit.generatedAt}`,
    `**Company:** ${audit.companyId}`,
    `**Branch:** ${audit.branch?.name} (${audit.branch?.code})`,
    '',
    '## Summary',
    '',
    mdTable(
      ['Metric', 'Value'],
      [
        ['Operational sales count', t.operationalSalesCount],
        ['Operational sales total', t.operationalSalesTotal],
        ['CSV sales count', t.csvSalesCount],
        ['CSV sales total', t.csvSalesTotal],
        ['GL 4100 from sale document JEs', t.glRevenueFromSaleDocumentJes],
        ['GL 4100 aggregate (all JEs)', t.gl4100CreditAggregate],
        ['Missing revenue JE count', t.missingRevenueJeCount],
        ['Duplicate JE count', t.duplicateJeCount],
        ['Wrong amount count', t.wrongAmountCount],
        ['Wrong accounts count', t.wrongAccountsCount],
        ['OK count', t.okCount],
      ],
    ),
    '',
    '## Revenue account',
    '',
    t.revenueAccount
      ? `- **${t.revenueAccount.code}** ${t.revenueAccount.name} (\`${t.revenueAccount.id}\`)`
      : '- **NOT RESOLVED**',
    '',
    '## Mismatch invoice numbers',
    '',
    t.mismatchInvoices.length
      ? t.mismatchInvoices.map((i) => `- ${i}`).join('\n')
      : '_None_',
    '',
    '## Example — missing revenue JE',
    '',
    '```json',
    JSON.stringify(t.examples.missing.slice(0, 5), null, 2),
    '```',
    '',
    '## Proposed repair JEs (Phase 1 preview)',
    '',
    '```json',
    JSON.stringify(t.proposedRepairs.slice(0, 5), null, 2),
    '```',
    '',
    `_Showing 5 of ${t.proposedRepairs.length} proposed repairs._`,
  ];
  return lines.join('\n');
}

function buildInventoryCogsMd(audit) {
  const t = audit.taskB;
  const lines = [
    '# DIN CHINA Inventory / COGS Tie-Out — Dry Run',
    '',
    `**Generated:** ${audit.generatedAt}`,
    '',
    '## Import strategy note',
    '',
    t.importStrategyNote,
    '',
    '## Summary',
    '',
    mdTable(
      ['Metric', 'Value'],
      [
        ['Purchase inventory GL debit (1200)', t.purchaseInventoryGlDebit],
        ['Stock movement IN qty', t.stockMovementInSummary?.qty],
        ['Stock movement IN value', t.stockMovementInSummary?.value],
        ['Sale stock OUT qty', t.saleStockOutQty],
        ['Sale item qty total', t.saleItemQtyTotal],
        ['Expected COGS', t.expectedCogsTotal],
        ['Actual COGS posted (5010)', t.actualCogsPosted],
        ['Actual inventory credit from sales (1200)', t.actualInventoryCreditFromSales],
        ['COGS gap', t.cogsGap],
        ['Inventory overstatement estimate', t.inventoryOverstatementEstimate],
        ['Missing stock OUT lines', t.missingStockOutCount],
        ['Stock qty mismatches', t.stockQtyMismatchCount],
        ['Balance sheet inventory overstated?', t.balanceSheetInventoryOverstated ? 'YES' : 'NO'],
      ],
    ),
    '',
    '## COGS account',
    '',
    JSON.stringify(t.cogsAccount, null, 2),
    '',
    '## Missing cost products',
    '',
    t.missingCostProducts.length
      ? mdTable(
          ['Product ID', 'SKU', 'Name'],
          t.missingCostProducts.map((p) => [p.productId, p.sku, p.name]),
        )
      : '_None_',
    '',
    '## Example sale item rows',
    '',
    '```json',
    JSON.stringify(t.examples.slice(0, 10), null, 2),
    '```',
    '',
    '## Proposed COGS repairs (Phase 2 preview)',
    '',
    '```json',
    JSON.stringify(t.proposedCogsRepairs.slice(0, 5), null, 2),
    '```',
  ];
  return lines.join('\n');
}

function buildPurchaseInventoryMd(audit) {
  const t = audit.taskC;
  const lines = [
    '# DIN CHINA Purchase / Inventory GL Tie-Out — Dry Run',
    '',
    `**Generated:** ${audit.generatedAt}`,
    '',
    '## Summary',
    '',
    mdTable(
      ['Metric', 'Value'],
      [
        ['ERP purchase total', t.erpPurchaseTotal],
        ['Latest CSV purchase total', t.latestCsvTotal],
        ['Updated CSV purchase total', t.updatedCsvTotal],
        ['Purchase items total', t.purchaseItemsTotal],
        ['GL inventory debit (1200)', t.glInventoryDebit],
        ['GL AP credit', t.glApCredit],
        ['Payments total', t.paymentsTotal],
        ['AP remaining due', t.apRemainingDue],
        ['CSV vs ERP mismatch', t.mismatchAmount],
        ['Requires user approval', t.requiresUserApproval ? 'YES' : 'NO'],
      ],
    ),
    '',
    '## Purchase detail',
    '',
    '```json',
    JSON.stringify(t.purchaseDetail, null, 2),
    '```',
    '',
    '## Proposed safe repair strategy',
    '',
    '```json',
    JSON.stringify(t.proposedRepairStrategy, null, 2),
    '```',
    '',
    '**Do not update purchase total automatically.**',
  ];
  return lines.join('\n');
}

function buildArPaymentMd(audit) {
  const t = audit.taskD;
  const lines = [
    '# DIN CHINA AR / Payments Tie-Out — Dry Run',
    '',
    `**Generated:** ${audit.generatedAt}`,
    '',
    '## Summary',
    '',
    mdTable(
      ['Metric', 'Value'],
      [
        ['Sales total', t.salesTotal],
        ['Paid on sales', t.paidTotal],
        ['Due on sales (expected AR)', t.expectedArOutstanding],
        ['Sales − payments', t.expectedArSalesMinusPayments],
        ['Payment records total', t.paymentRecordsTotal],
        ['GL AR balance rollup', t.glAccountsReceivableBalance],
        ['Expected vs actual AR gap', t.arExpectedVsActualGap],
        ['Payment JE count', t.paymentJeCount],
        ['Payment JE issues', t.paymentIssues.length],
      ],
    ),
    '',
    '## Payment JE issues',
    '',
    '```json',
    JSON.stringify(t.examples.paymentIssues, null, 2),
    '```',
    '',
    '## Customer rollups (top 10)',
    '',
    '```json',
    JSON.stringify(t.examples.customers, null, 2),
    '```',
  ];
  return lines.join('\n');
}

function buildBalanceSheetMd(audit) {
  const t = audit.taskE;
  const lines = [
    '# DIN CHINA Balance Sheet Issue Analysis',
    '',
    `**Generated:** ${t.generatedAt || audit.generatedAt}`,
    '',
    '## Account snapshots',
    '',
    '```json',
    JSON.stringify(t.accountSnapshots, null, 2),
    '```',
    '',
  ];
  for (const s of t.sections) {
    lines.push(`## ${s.topic}`, '');
    for (const e of s.explanation) lines.push(`- ${e}`);
    lines.push('');
  }
  return lines.join('\n');
}

function buildRepairPlanMd(audit) {
  const t = audit.taskF;
  const lines = [
    '# DIN CHINA Financial GL Repair Plan — Dry Run Only',
    '',
    `**Generated:** ${audit.generatedAt}`,
    '',
    '**Apply was NOT run.** This document is a preview only.',
    '',
    '## Blocking errors',
    '',
    t.blockingErrors.length ? t.blockingErrors.map((e) => `- ${e}`).join('\n') : '_None_',
    '',
    '## Phases',
    '',
  ];
  for (const p of t.phases) {
    lines.push(`### Phase ${p.phase} — ${p.name}`, '');
    lines.push(p.description, '');
    if (p.eligibleCount != null) lines.push(`- Eligible: ${p.eligibleCount}`);
    if (p.expectedCogsTotal != null) lines.push(`- Expected COGS total: ${p.expectedCogsTotal}`);
    if (p.mismatchAmount != null) lines.push(`- Mismatch: ${p.mismatchAmount}`);
    if (p.paymentIssueCount != null) lines.push(`- Payment issues: ${p.paymentIssueCount}`);
    lines.push(`- Blocked for apply: ${p.blocked ? 'YES' : 'NO'}`);
    if (p.gates) {
      lines.push('- Gates:');
      for (const g of p.gates) lines.push(`  - ${g}`);
    }
    if (p.note) lines.push(`- Note: ${p.note}`);
    lines.push('');
  }
  lines.push('## Proposed repairs sample', '', '```json', JSON.stringify(t.proposedRepairs.slice(0, 8), null, 2), '```');
  return lines.join('\n');
}

function buildSaleReturnDiscountMd(audit) {
  const t = audit.taskG;
  const p6 = audit.phase6Plan;
  const p7 = audit.phase7Plan;
  const p75 = audit.phase75Plan;
  const lines = [
    '# DIN CHINA Sale Returns & Discount GL Tie-Out — Dry Run',
    '',
    `**Generated:** ${audit.generatedAt}`,
    `**Company:** ${audit.companyId}`,
    `**Branch:** ${audit.branch?.name} (${audit.branch?.code})`,
    '',
    '## Summary',
    '',
    mdTable(
      ['Metric', 'Value'],
      [
        ['Expected sell return total (legacy)', t?.expectedSellReturnTotal],
        ['Legacy parsed return total', t?.legacyParsedSellReturnTotal],
        ['ERP sale_returns count', t?.erpSellReturnCount],
        ['ERP sale_returns total', t?.erpSellReturnTotal],
        ['Expected discount total (report)', t?.expectedDiscountTotal],
        ['ERP sales.discount_amount sum', t?.erpDiscountTotal],
        ['Sales with discount > 0', t?.salesWithDiscountCount],
        ['GL 5200 posted (debit)', t?.gl5200Posted],
        ['5200 gap vs ERP discounts', t?.gl5200Gap],
        ['Missing return settlement JEs', t?.missingReturnJeCount],
        ['AR gap reduction estimate (Phase 6)', t?.arGapReductionEstimate],
        ['Phase 6 eligible imports', p6?.eligibleCount],
        ['Phase 7.5 screenshot discount backfill eligible', p75?.eligibleCount],
        ['Phase 7 eligible discount amends', p7?.eligibleCount],
      ],
    ),
    '',
    '## Import strategy',
    '',
    t?.importStrategyNote || '',
    '',
    '## Legacy sell returns (excluded from original import)',
    '',
    '```json',
    JSON.stringify(t?.legacyReturns || [], null, 2),
    '```',
    '',
    '## Customer ledger vs summary (spotlight)',
    '',
    '```json',
    JSON.stringify(t?.customerLedgerChecks || [], null, 2),
    '```',
    '',
    '## Phase 6 — Proposed return imports (preview)',
    '',
    '```json',
    JSON.stringify((p6?.proposedRepairs || []).slice(0, 4), null, 2),
    '```',
    '',
    '## Phase 7.5 — Screenshot discount backfill (preview)',
    '',
    '```json',
    JSON.stringify((p75?.proposedRepairs || []).slice(0, 8), null, 2),
    '```',
    '',
    p75?.strategyNote ? `**Phase 7.5 strategy:** ${p75.strategyNote}` : '',
    '',
    '## Phase 7 — Proposed discount GL amends (preview)',
    '',
    '```json',
    JSON.stringify((p7?.proposedRepairs || []).slice(0, 8), null, 2),
    '```',
    '',
    p7?.strategyNote ? `**Phase 7 strategy:** ${p7.strategyNote}` : '',
  ];
  return lines.join('\n');
}

export function printConsoleSummary(audit) {
  const a = audit.taskA;
  const b = audit.taskB;
  const c = audit.taskC;
  const d = audit.taskD;
  const f = audit.taskF;
  const g = audit.taskG;
  const status = audit.auditStatus;

  console.log('\n=== DIN CHINA Financial Integrity Audit (DRY-RUN) ===\n');

  if (status?.coreAuditPass) {
    console.log('AUDIT STATUS: PASS — Phases 1 (revenue) and 2 (COGS/inventory) are complete.\n');
  } else if (status?.criticalBlockingErrors?.length) {
    console.log('AUDIT STATUS: FAIL — critical issues must be fixed before apply.\n');
  } else {
    console.log('AUDIT STATUS: PARTIAL — some repairs still pending.\n');
  }

  console.log(`Operational sales: ${a.operationalSalesCount} / total ${a.operationalSalesTotal}`);
  console.log(`GL sales revenue (4100 on sale JEs): ${a.glRevenueFromSaleDocumentJes}`);
  console.log(`GL 4100 aggregate: ${a.gl4100CreditAggregate}`);
  console.log(`Missing revenue JE: ${a.missingRevenueJeCount}`);
  console.log(`Duplicate JE: ${a.duplicateJeCount}`);
  console.log(`Wrong amount: ${a.wrongAmountCount}`);
  console.log(`Inventory GL debit (purchase): ${b.purchaseInventoryGlDebit}`);
  console.log(`Inventory GL credit (sales): ${b.actualInventoryCreditFromSales}`);
  console.log(`Expected COGS: ${b.expectedCogsTotal}`);
  console.log(`Actual COGS: ${b.actualCogsPosted}`);
  console.log(`Purchase mismatch (updated CSV vs ERP): ${c.mismatchAmount}`);
  console.log(`AR expected (due): ${d.expectedArOutstanding} vs GL rollup ${d.glAccountsReceivableBalance}`);
  if (g) {
    console.log(`Sell returns ERP: ${g.erpSellReturnTotal} / expected ${g.expectedSellReturnTotal}`);
    console.log(`Discounts ERP: ${g.erpDiscountTotal} / GL 5200: ${g.gl5200Posted}`);
    console.log(`Phase 6 return import eligible: ${audit.phase6Plan?.eligibleCount ?? 0}`);
    console.log(`Phase 7.5 screenshot discount backfill eligible: ${audit.phase75Plan?.eligibleCount ?? 0}`);
    console.log(`Phase 7 discount amend eligible: ${audit.phase7Plan?.eligibleCount ?? 0}`);
    if (g.arGapReductionEstimate > 0) {
      console.log(`Estimated AR gap reduction from Phase 6: ~Rs ${g.arGapReductionEstimate}`);
    }
  }
  console.log('\nRepair phase status:');
  for (const p of f.phases) {
    const label =
      p.phase === 1 && status?.phase1Complete
        ? 'COMPLETE'
        : p.phase === 2 && status?.phase2Complete
          ? 'COMPLETE'
          : p.blocked
            ? 'BLOCKED / APPROVAL NEEDED'
            : 'READY';
    console.log(`  Phase ${p.phase}: ${p.name} — ${label}`);
  }
  if (status?.approvalRequired?.length) {
    console.log('\nPending approval (not a dry-run failure):');
    for (const e of status.approvalRequired) console.log(`  - ${e}`);
  }
  if (status?.criticalBlockingErrors?.length) {
    console.log('\nCritical blocking errors:');
    for (const e of status.criticalBlockingErrors) console.log(`  - ${e}`);
  }
  if (status?.arGapNote) {
    console.log(`\nNote: ${status.arGapNote}`);
  }
  if (!audit.applyRun) {
    console.log('\n*** Apply was NOT run ***\n');
  }
}
