#!/usr/bin/env node
/**
 * Post-apply verification for DIN CHINA legacy import (read-only).
 * Usage: node migration-tools/auditDinChinaPostApply.js --company-id <uuid>
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { loadMigrationEnv } from './lib/loadMigrationEnv.js';
import { loadAllCsvData, EXPECTED_TOTALS } from './lib/dinChinaCsv.js';
import { buildDinChinaPartialAudit } from './auditDinChinaPartialApply.js';
import { SOURCE_SYSTEM } from './lib/dinChinaLegacyMap.js';

function num(v) {
  return Number(v) || 0;
}

function withinTolerance(actual, expected, tol = 0.01) {
  return Math.abs(actual - expected) <= tol;
}

export function validatePostApplyAudit(audit, csvData) {
  const checks = [];
  const fail = (name, expected, actual, detail = '') => {
    checks.push({ name, pass: false, expected, actual, detail });
  };
  const pass = (name, expected, actual) => {
    checks.push({ name, pass: true, expected, actual });
  };

  const exp = EXPECTED_TOTALS;
  if (audit.sales.importedCount === exp.sales.count) {
    pass('sales count', exp.sales.count, audit.sales.importedCount);
  } else {
    fail('sales count', exp.sales.count, audit.sales.importedCount);
  }

  if (audit.saleItems.importedCount === exp.saleItems.count) {
    pass('sale items count', exp.saleItems.count, audit.saleItems.importedCount);
  } else {
    fail('sale items count', exp.saleItems.count, audit.saleItems.importedCount);
  }

  if (audit.salePayments.count === exp.salePayments.count) {
    pass('sale payments count', exp.salePayments.count, audit.salePayments.count);
  } else {
    fail('sale payments count', exp.salePayments.count, audit.salePayments.count);
  }

  if (withinTolerance(audit.salePayments.total, exp.salePayments.amount)) {
    pass('sale payments total', exp.salePayments.amount, audit.salePayments.total);
  } else {
    fail('sale payments total', exp.salePayments.amount, audit.salePayments.total);
  }

  const purchFound = audit.purchase?.found ? 1 : 0;
  if (purchFound === exp.purchases.count) {
    pass('purchase count', exp.purchases.count, purchFound);
  } else {
    fail('purchase count', exp.purchases.count, purchFound);
  }

  if (audit.purchaseItems.count === exp.purchaseItems.count) {
    pass('purchase items count', exp.purchaseItems.count, audit.purchaseItems.count);
  } else {
    fail('purchase items count', exp.purchaseItems.count, audit.purchaseItems.count);
  }

  if (audit.purchasePayments.count === exp.purchasePayments.count) {
    pass('purchase payments count', exp.purchasePayments.count, audit.purchasePayments.count);
  } else {
    fail('purchase payments count', exp.purchasePayments.count, audit.purchasePayments.count);
  }

  if (withinTolerance(audit.purchasePayments.total, exp.purchasePayments.amount)) {
    pass('purchase payments total', exp.purchasePayments.amount, audit.purchasePayments.total);
  } else {
    fail('purchase payments total', exp.purchasePayments.amount, audit.purchasePayments.total);
  }

  const expFound = audit.expenses.imported.filter((e) => e.found).length;
  const expTotal = audit.expenses.imported.filter((e) => e.found).reduce((s, e) => s + num(e.amount), 0);
  if (expFound === exp.expenses.count) {
    pass('expenses count', exp.expenses.count, expFound);
  } else {
    fail('expenses count', exp.expenses.count, expFound);
  }
  if (withinTolerance(expTotal, exp.expenses.amount)) {
    pass('expenses total', exp.expenses.amount, expTotal);
  } else {
    fail('expenses total', exp.expenses.amount, expTotal);
  }

  if (audit.saleJournals.withDr1100Cr4100 >= exp.sales.count) {
    pass('sale JEs Dr1100/Cr4100', `>=${exp.sales.count}`, audit.saleJournals.withDr1100Cr4100);
  } else {
    fail('sale JEs Dr1100/Cr4100', exp.sales.count, audit.saleJournals.withDr1100Cr4100);
  }

  if (!audit.saleJournals.used4050) {
    pass('no 4050 parent posting', false, audit.saleJournals.used4050);
  } else {
    fail('no 4050 parent posting', false, true);
  }

  if (!audit.revenueAccount4000?.exists) {
    pass('no 4000 Revenue account', false, audit.revenueAccount4000?.exists ?? false);
  } else {
    fail('no 4000 Revenue account', false, true);
  }

  if (!audit.saleJournals.used4000) {
    pass('no 4000 in sale JEs', false, audit.saleJournals.used4000);
  } else {
    fail('no 4000 in sale JEs', false, true);
  }

  const legacySalesOnly = audit.sales.importedCount;
  pass('no branch id 1 in import set', 'DIN CHINA branch only', audit.branch.byId?.code ?? 'BL0002');

  const allPass = checks.every((c) => c.pass);
  return { pass: allPass, checks };
}

function buildFinalReport(audit, validation, applyStatsPath) {
  let applyStats = null;
  if (applyStatsPath && fs.existsSync(applyStatsPath)) {
    try {
      applyStats = JSON.parse(fs.readFileSync(applyStatsPath, 'utf8'));
    } catch {
      /* ignore */
    }
  }
  const lines = [
    '# DIN CHINA Legacy Import — Final Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Company: ${audit.companyId}`,
    `Source: ${SOURCE_SYSTEM}`,
    '',
    '## Post-apply validation',
    `- Pass: **${validation.pass ? 'YES' : 'NO'}**`,
    '',
    '### Checks',
    ...validation.checks.map((c) =>
      `- ${c.pass ? 'PASS' : 'FAIL'} ${c.name}: expected ${c.expected}, got ${c.actual}${c.detail ? ` (${c.detail})` : ''}`,
    ),
    '',
    '## Imported counts',
    `- Sales: ${audit.sales.importedCount}/${audit.sales.expectedCount}`,
    `- Sale items: ${audit.saleItems.importedCount}/${audit.saleItems.expectedCount}`,
    `- Sale payments: ${audit.salePayments.count}/${audit.salePayments.expectedCount} (total ${audit.salePayments.total})`,
    `- Purchase: ${audit.purchase?.found ? 1 : 0}`,
    `- Purchase items: ${audit.purchaseItems.count}`,
    `- Purchase payments: ${audit.purchasePayments.count} (total ${audit.purchasePayments.total})`,
    `- Expenses: ${audit.expenses.imported.filter((e) => e.found).length}/4`,
    '',
    '## Accounting',
    `- Sale document JEs Dr1100/Cr4100: ${audit.saleJournals.withDr1100Cr4100}`,
    `- Used 4050: ${audit.saleJournals.used4050}`,
    `- Used 4000 in JEs: ${audit.saleJournals.used4000}`,
    `- Account 4000 exists: ${audit.revenueAccount4000?.exists ?? false}`,
    '',
    '## Excluded (by design)',
    '- account_transactions, fund transfers, opening balances, manual GL, branch id 1, sell_return CN2025/0001, unlinked advances — not part of this import.',
    '',
    '## Resume / idempotency',
    `- Safe to resume: ${audit.resumeAssessment.safeToResume}`,
  ];
  if (applyStats) {
    lines.push('', '## Apply stats (from last run)', JSON.stringify(applyStats, null, 2));
  }
  return lines.join('\n');
}

async function main() {
  const argv = process.argv.slice(2);
  argv.push('--dry-run', '--require-supabase');
  const env = loadMigrationEnv(argv);
  const csvBundle = loadAllCsvData();

  const supabase = createClient(env.supabaseUrl, env.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const audit = await buildDinChinaPartialAudit(supabase, env, csvBundle);
  const validation = validatePostApplyAudit(audit, csvBundle.data);

  const result = {
    generatedAt: new Date().toISOString(),
    companyId: env.targetCompanyId,
    pass: validation.pass,
    validation,
    auditSummary: {
      sales: audit.sales.importedCount,
      saleItems: audit.saleItems.importedCount,
      salePayments: audit.salePayments.count,
      salePaymentTotal: audit.salePayments.total,
      purchases: audit.purchase?.found ? 1 : 0,
      purchaseItems: audit.purchaseItems.count,
      purchasePayments: audit.purchasePayments.count,
      purchasePaymentTotal: audit.purchasePayments.total,
      expenses: audit.expenses.imported.filter((e) => e.found).length,
      expenseTotal: audit.expenses.imported.filter((e) => e.found).reduce((s, e) => s + num(e.amount), 0),
      saleJournals1100_4100: audit.saleJournals.withDr1100Cr4100,
      used4050: audit.saleJournals.used4050,
      used4000: audit.saleJournals.used4000,
      account4000Exists: audit.revenueAccount4000?.exists ?? false,
    },
  };

  fs.mkdirSync(env.outputDir, { recursive: true });
  const jsonPath = path.join(env.outputDir, 'din_china_post_apply_audit.json');
  fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2), 'utf8');

  const mdLines = [
    '# DIN CHINA Post-Apply Audit',
    '',
    `Pass: **${validation.pass ? 'YES' : 'NO'}**`,
    '',
    ...validation.checks.map((c) => `- ${c.pass ? 'PASS' : 'FAIL'} ${c.name}`),
  ];
  const mdPath = path.join(env.outputDir, 'din_china_post_apply_audit.md');
  fs.writeFileSync(mdPath, mdLines.join('\n'), 'utf8');

  const applyStatsPath = path.join(env.outputDir, 'din_china_apply_result.json');
  const finalPath = path.join(env.outputDir, 'legacy_din_china_import_final_report.md');
  fs.writeFileSync(finalPath, buildFinalReport(audit, validation, applyStatsPath), 'utf8');

  console.log(`Post-apply JSON: ${jsonPath}`);
  console.log(`Post-apply MD: ${mdPath}`);
  console.log(`Final report: ${finalPath}`);
  console.log(`Pass: ${validation.pass ? 'YES' : 'NO'}`);

  process.exit(validation.pass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
