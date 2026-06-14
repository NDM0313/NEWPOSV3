#!/usr/bin/env node
/**
 * DIN CHINA post-import repair — COA cleanup for legacy DC payment accounts.
 *
 * Preview (default):
 *   node migration-tools/repairDinChinaPostImport.js --company-id <uuid>
 *
 * Apply (only after preview passes):
 *   node migration-tools/repairDinChinaPostImport.js --company-id <uuid> --apply-coa-cleanup
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

async function main() {
  const rawArgv = process.argv.slice(2);
  const applyCoa = rawArgv.includes('--apply-coa-cleanup');
  const argv = [...rawArgv];
  if (applyCoa) {
    argv.push('--apply');
  } else {
    argv.push('--dry-run', '--require-supabase');
  }

  const env = loadMigrationEnv(argv);
  const supabase = createClient(env.supabaseUrl, env.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

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

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
