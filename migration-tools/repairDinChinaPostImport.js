#!/usr/bin/env node
/**
 * DIN CHINA post-import repair.
 *
 * COA cleanup (legacy DC payment accounts):
 *   Preview: node migration-tools/repairDinChinaPostImport.js --company-id <uuid>
 *   Apply:   node migration-tools/repairDinChinaPostImport.js --company-id <uuid> --apply-coa-cleanup
 *
 * Stock movement backfill (legacy sales/purchase document lines):
 *   Preview: node migration-tools/repairDinChinaPostImport.js --company-id <uuid> --preview-stock-repair
 *   Apply:   node migration-tools/repairDinChinaPostImport.js --company-id <uuid> --apply-stock-repair
 */
import { createClient } from '@supabase/supabase-js';
import { loadMigrationEnv } from './lib/loadMigrationEnv.js';
import {
  buildCoaCleanupPlan,
  writeCleanupPreview,
  applyCoaCleanupPlan,
  verifyCoaCleanup,
  writeCleanupFinalReport,
} from './lib/dinChinaCoaCleanup.js';
import {
  buildStockRepairPlan,
  writeStockRepairPreview,
  applyStockRepairPlan,
  verifyStockRepair,
  writeStockRepairFinalReport,
} from './lib/dinChinaStockRepair.js';

function createSupabase(env) {
  return createClient(env.supabaseUrl, env.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function runCoaCleanup(env, applyCoa) {
  const supabase = createSupabase(env);

  console.log('Building COA cleanup plan...');
  const plan = await buildCoaCleanupPlan(supabase, env.targetCompanyId);
  const { jsonPath, mdPath } = writeCleanupPreview(env.outputDir, plan);
  console.log(`Preview JSON: ${jsonPath}`);
  console.log(`Preview MD: ${mdPath}`);
  console.log(`Preview pass: ${plan.pass ? 'YES' : 'NO'}`);

  if (plan.blockingErrors.length) {
    console.error('Blocking errors:');
    for (const e of plan.blockingErrors) console.error(`  - ${e}`);
    process.exit(1);
  }

  if (!applyCoa) {
    console.log('Preview only — re-run with --apply-coa-cleanup to apply.');
    process.exit(0);
  }

  console.log('Applying COA cleanup...');
  const applyResult = await applyCoaCleanupPlan(supabase, env.targetCompanyId, plan);
  if (!applyResult.ok) {
    console.error('Apply failed:', applyResult.stats?.errors || applyResult.error);
    process.exit(1);
  }
  console.log(
    `Applied: ${applyResult.stats.accountsUpdated} accounts, ${applyResult.stats.parentsCreated} parents created`,
  );

  const verification = await verifyCoaCleanup(supabase, env.targetCompanyId, plan);
  const finalPath = writeCleanupFinalReport(env.outputDir, plan, applyResult, verification);
  console.log(`Final report: ${finalPath}`);
  console.log(`Verification pass: ${verification.pass ? 'YES' : 'NO'}`);

  process.exit(verification.pass ? 0 : 1);
}

async function runStockRepair(env, applyStock) {
  const supabase = createSupabase(env);

  console.log('Building stock movement repair plan...');
  const plan = await buildStockRepairPlan(supabase, env.targetCompanyId);
  const { jsonPath, mdPath } = writeStockRepairPreview(env.outputDir, plan);
  console.log(`Preview JSON: ${jsonPath}`);
  console.log(`Preview MD: ${mdPath}`);
  console.log(`Preview pass: ${plan.pass ? 'YES' : 'NO'}`);
  console.log(
    `Sale inserts: ${plan.summary.saleLinesToInsert}, purchase inserts: ${plan.summary.purchaseLinesToInsert}`,
  );

  if (plan.blockingErrors.length) {
    console.error('Blocking errors:');
    for (const e of plan.blockingErrors) console.error(`  - ${e}`);
    process.exit(1);
  }

  if (!applyStock) {
    console.log('Preview only — re-run with --apply-stock-repair to apply.');
    process.exit(0);
  }

  console.log('Applying stock movement repair...');
  const applyResult = await applyStockRepairPlan(supabase, env.targetCompanyId, plan);
  if (!applyResult.ok) {
    console.error('Apply failed:', applyResult.stats?.errors || applyResult.error);
    process.exit(1);
  }
  console.log(
    `Applied: ${applyResult.stats.movementsInserted} movements, ${applyResult.stats.trackStockUpdated} track_stock updates`,
  );

  const verification = await verifyStockRepair(supabase, env.targetCompanyId, plan);
  const finalPath = writeStockRepairFinalReport(env.outputDir, plan, applyResult, verification);
  console.log(`Final report: ${finalPath}`);
  console.log(`Verification pass: ${verification.pass ? 'YES' : 'NO'}`);

  process.exit(verification.pass ? 0 : 1);
}

async function main() {
  const rawArgv = process.argv.slice(2);
  const applyCoa = rawArgv.includes('--apply-coa-cleanup');
  const previewStock = rawArgv.includes('--preview-stock-repair');
  const applyStock = rawArgv.includes('--apply-stock-repair');
  const stockMode = previewStock || applyStock;

  const argv = [...rawArgv];
  if (applyCoa || applyStock) {
    argv.push('--apply');
  } else {
    argv.push('--dry-run', '--require-supabase');
  }

  const env = loadMigrationEnv(argv);

  if (stockMode) {
    await runStockRepair(env, applyStock);
    return;
  }

  await runCoaCleanup(env, applyCoa);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
