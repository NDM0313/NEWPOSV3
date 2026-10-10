#!/usr/bin/env node

/**

 * DIN CHINA post-import Financial GL / Inventory / Sales Revenue integrity audit.

 *

 * Dry-run (read-only):

 *   node migration-tools/dinChinaFinancialIntegrityAudit.js \

 *     --company-id 30bd8592-3384-4f34-899a-f3907e336485 --dry-run --require-supabase

 *

 * Apply (after dry-run passes phase gates):

 *   node migration-tools/dinChinaFinancialIntegrityAudit.js \

 *     --company-id 30bd8592-3384-4f34-899a-f3907e336485 --apply --require-supabase

 *

 * Apply specific phase:

 *   node migration-tools/dinChinaFinancialIntegrityAudit.js ... --apply --phase 2

 *

 * Phase 3 requires: --approve-purchase-repair (manual migration still required)

 */

import fs from 'node:fs';

import path from 'node:path';

import { createClient } from '@supabase/supabase-js';

import { loadMigrationEnv } from './lib/loadMigrationEnv.js';

import { dryRunDir, ensureDinChinaDirs } from './lib/dinChinaPaths.js';

import {

  loadAuditCsvBundle,

  loadBranchGuard,

  loadCompanyAccounts,

  DIN_CHINA_BRANCH_ID,

  DIN_CHINA_BRANCH_CODE,

  DIN_CHINA_BRANCH_NAME,

} from './lib/dinChinaFinancialAuditShared.js';

import { auditSalesRevenueGl } from './lib/dinChinaSalesRevenueAudit.js';

import { auditInventoryCogs } from './lib/dinChinaInventoryCogsAudit.js';

import { auditPurchaseInventoryGl } from './lib/dinChinaPurchaseInventoryAudit.js';

import { auditArPayments } from './lib/dinChinaArPaymentAudit.js';

import { buildBalanceSheetAnalysis } from './lib/dinChinaBalanceSheetAnalysis.js';

import { buildRepairPlan, collectBlockingErrors, classifyAuditErrors } from './lib/dinChinaFinancialRepairPlan.js';

import { writeAllReports, printConsoleSummary } from './lib/dinChinaFinancialAuditReports.js';

import { applyFinancialRepairs } from './lib/dinChinaFinancialIntegrityApply.js';
import { auditSaleReturnsAndDiscounts } from './lib/dinChinaSaleReturnDiscountAudit.js';
import { buildSaleReturnImportPlan } from './lib/dinChinaSaleReturnImport.js';
import { buildDiscountGlRepairPlan } from './lib/dinChinaDiscountGlRepair.js';
import { buildScreenshotDiscountBackfillPlan } from './lib/dinChinaScreenshotDiscountBackfill.js';



async function runAudit(supabase, ctx) {

  console.log('Task A — Sales revenue GL tie-out...');

  const taskA = await auditSalesRevenueGl(supabase, ctx);



  console.log('Task B — Inventory / COGS tie-out...');

  const taskB = await auditInventoryCogs(supabase, ctx);



  console.log('Task C — Purchase / inventory GL tie-out...');

  const taskC = await auditPurchaseInventoryGl(supabase, ctx);



  console.log('Task D — AR / payments tie-out...');

  const taskD = await auditArPayments(supabase, ctx);



  const taskResults = { revenue: taskA, cogs: taskB, purchase: taskC, ar: taskD };



  console.log('Task E — Balance sheet analysis...');

  const taskE = buildBalanceSheetAnalysis(ctx, taskResults);

  console.log('Task G — Sale returns & discount GL tie-out...');
  const taskG = await auditSaleReturnsAndDiscounts(supabase, ctx);

  console.log('Phase 6 preview — Legacy sell return import plan...');
  const phase6Plan = await buildSaleReturnImportPlan(supabase, ctx);

  console.log('Phase 7 preview — Discount GL repair plan...');
  const phase7Plan = await buildDiscountGlRepairPlan(supabase, ctx);

  console.log('Phase 7.5 preview — Screenshot discount backfill plan...');
  const phase75Plan = await buildScreenshotDiscountBackfillPlan(supabase, ctx);

  console.log('Task F — Repair plan...');
  const blockingErrors = collectBlockingErrors(ctx, taskResults);
  const auditStatus = classifyAuditErrors(blockingErrors, taskResults);
  const taskF = buildRepairPlan(ctx, taskResults, blockingErrors, {
    taskG,
    phase4Plan: taskD.phase4Plan,
    phase6Plan,
    phase7Plan,
    phase75Plan,
  });

  return {
    taskA,
    taskB,
    taskC,
    taskD,
    taskE,
    taskF,
    taskG,
    phase6Plan,
    phase7Plan,
    phase75Plan,
    blockingErrors,
    auditStatus,
    taskResults,
  };
}



async function main() {

  const argv = process.argv.slice(2);

  if (!argv.includes('--dry-run') && !argv.includes('--apply')) {

    argv.push('--dry-run');

  }

  argv.push('--require-supabase');



  const env = loadMigrationEnv(argv);

  const companyId = env.targetCompanyId;

  const apply = env.apply;



  ensureDinChinaDirs();

  const outputDir = dryRunDir();

  const csvBundle = loadAuditCsvBundle();



  const supabase = createClient(env.supabaseUrl, env.serviceRoleKey, {

    auth: { persistSession: false, autoRefreshToken: false },

  });



  console.log('Loading branch guard and accounts...');

  const branchGuard = await loadBranchGuard(supabase, companyId);

  const accounts = await loadCompanyAccounts(supabase, companyId);



  const ctx = {

    companyId,

    branchGuard,

    accounts,

    csvBundle,

  };



  const auditResult = await runAudit(supabase, ctx);



  const audit = {

    mode: apply ? 'apply' : 'dry-run',

    applyRun: false,

    generatedAt: new Date().toISOString(),

    companyId,

    branch: {

      id: DIN_CHINA_BRANCH_ID,

      code: DIN_CHINA_BRANCH_CODE,

      name: DIN_CHINA_BRANCH_NAME,

      guard: branchGuard,

    },

    coa: {

      revenue: accounts.revenue,

      ar: accounts.ar,

      inventory: accounts.inventory,

      cogs: accounts.cogs,

      ap: accounts.ap,

    },

    taskA: auditResult.taskA,

    taskB: auditResult.taskB,

    taskC: auditResult.taskC,

    taskD: auditResult.taskD,

    taskE: auditResult.taskE,

    taskF: auditResult.taskF,
    taskG: auditResult.taskG,
    phase6Plan: auditResult.phase6Plan,
    phase7Plan: auditResult.phase7Plan,
    phase75Plan: auditResult.phase75Plan,
    blockingErrors: auditResult.blockingErrors,
    auditStatus: auditResult.auditStatus,
  };



  const paths = writeAllReports(outputDir, audit);

  printConsoleSummary(audit);



  console.log('Output files:');

  for (const [k, p] of Object.entries(paths)) {

    console.log(`  ${k}: ${p}`);

  }



  if (!apply) {
    const st = audit.auditStatus;
    if (st?.coreAuditPass) {
      console.log(
        '\nDry-run PASS. Phases 1–2 complete. Phase 3 (purchase) needs your approval before apply.',
      );
    } else if (st?.criticalBlockingErrors?.length) {
      console.log('\nDry-run FAILED. Fix critical blocking errors above, then re-run.');
    } else if (st?.phase4Ready) {
      console.log(
        '\nDry-run PASS for Phase 4 (AR party reclass). Review reports in DIN CHINA/03_dry_run_reports/, then apply when approved.',
      );
    } else {
      console.log('\nDry-run complete. Review pending items above.');
    }
    process.exit(st?.dryRunExitCode ?? 0);
  }



  console.log('\n=== APPLY MODE ===\n');

  const applyResult = await applyFinancialRepairs(supabase, ctx, audit, argv);

  audit.applyRun = true;

  audit.applyResult = applyResult;



  const applyReportPath = path.join(outputDir, 'din_china_financial_integrity_apply_report.json');

  fs.writeFileSync(applyReportPath, JSON.stringify(applyResult, null, 2), 'utf8');

  if (applyResult.phases['7.5']) {
    const screenshotReportPath = path.join(
      outputDir,
      'din_china_screenshot_discount_backfill_apply_report.json',
    );
    fs.writeFileSync(
      screenshotReportPath,
      JSON.stringify(
        {
          appliedAt: applyResult.appliedAt,
          phase: 7.5,
          ...applyResult.phases['7.5'],
          stats: {
            updated: applyResult.stats.phase75Updated,
            skipped: applyResult.stats.phase75Skipped,
          },
        },
        null,
        2,
      ),
      'utf8',
    );
    console.log(`Screenshot discount apply report: ${screenshotReportPath}`);
  }

  fs.writeFileSync(paths.json, JSON.stringify({ ...audit, applyResult }, null, 2), 'utf8');



  console.log('Apply stats:');

  console.log(`  Phase 1 created: ${applyResult.stats.phase1Created}, skipped: ${applyResult.stats.phase1Skipped}`);

  console.log(`  Phase 2 updated: ${applyResult.stats.phase2Updated}, skipped: ${applyResult.stats.phase2Skipped}`);

  if (applyResult.stats.phase75Updated != null) {
    console.log(
      `  Phase 7.5 updated: ${applyResult.stats.phase75Updated}, skipped: ${applyResult.stats.phase75Skipped}`,
    );
  }
  if (applyResult.stats.phase7Updated != null && applyResult.phases[7]) {
    console.log(
      `  Phase 7 updated: ${applyResult.stats.phase7Updated}, skipped: ${applyResult.stats.phase7Skipped}`,
    );
  }

  if (applyResult.errors.length) {

    console.log('Apply errors:');

    for (const e of applyResult.errors) console.log(`  - ${e}`);

  }

  for (const [phase, result] of Object.entries(applyResult.phases)) {

    if (result.blocked) {

      console.log(`  Phase ${phase}: BLOCKED — ${(result.blockers || [result.note]).join('; ')}`);

    }

  }

  console.log(`\nApply report: ${applyReportPath}`);



  console.log('\nRe-running post-apply audit...');

  const post = await runAudit(supabase, ctx);

  console.log('\n=== POST-APPLY SUMMARY ===');

  console.log(`GL 4100 on sale JEs: ${post.taskA.glRevenueFromSaleDocumentJes}`);

  console.log(`Actual COGS posted: ${post.taskB.actualCogsPosted}`);

  console.log(`Inventory GL credit from sales: ${post.taskB.actualInventoryCreditFromSales}`);

  console.log(`Inventory 1200 balance: ${accounts.inventory.account?.balance}`);



  process.exit(applyResult.ok && !applyResult.errors.length ? 0 : 1);

}



main().catch((err) => {

  console.error(err);

  process.exit(1);

});


