#!/usr/bin/env node
/**
 * Phase 4.5 — sales paid_amount / due_amount backfill from payments.
 * Usage:
 *   node migration-tools/dinChinaSalesPaidDueBackfill.js --dry-run --require-supabase
 *   node migration-tools/dinChinaSalesPaidDueBackfill.js --apply --require-supabase
 *   node migration-tools/dinChinaSalesPaidDueBackfill.js --apply --customer-id <uuid> --require-supabase
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { loadMigrationEnv } from './lib/loadMigrationEnv.js';
import { loadBranchGuard, loadCompanyAccounts } from './lib/dinChinaFinancialAuditShared.js';
import { dryRunDir, ensureDinChinaDirs } from './lib/dinChinaPaths.js';
import {
  buildSalesPaidDueBackfillPlan,
  applySalesPaidDueBackfill,
} from './lib/dinChinaSalesPaidDueBackfill.js';

function readArg(argv, name) {
  const flag = `--${name}`;
  const i = argv.indexOf(flag);
  if (i === -1) return null;
  const next = argv[i + 1];
  if (!next || next.startsWith('--')) return null;
  return next;
}

async function main() {
  const argv = process.argv.slice(2);
  if (!argv.includes('--dry-run') && !argv.includes('--apply')) argv.push('--dry-run');
  argv.push('--require-supabase');

  const env = loadMigrationEnv(argv);
  const apply = env.apply;
  const customerId = readArg(argv, 'customer-id');
  const companyId =
    readArg(argv, 'company-id') || env.targetCompanyId || '30bd8592-3384-4f34-899a-f3907e336485';

  const sb = createClient(env.supabaseUrl, env.serviceRoleKey, { auth: { persistSession: false } });
  const ctx = {
    companyId,
    branchGuard: await loadBranchGuard(sb, companyId),
    accounts: await loadCompanyAccounts(sb, companyId),
  };

  const plan = await buildSalesPaidDueBackfillPlan(sb, ctx, { customerId, dryRunOnly: !apply });
  console.log(`Eligible sales: ${plan.eligibleCount}`);
  console.log(JSON.stringify(plan.repairs.slice(0, 20), null, 2));

  ensureDinChinaDirs();
  const reportPath = path.join(dryRunDir(), 'din_china_sales_paid_due_backfill_report.json');
  let result = { plan };
  if (apply) {
    result.apply = await applySalesPaidDueBackfill(sb, plan);
    console.log('Updated:', result.apply.updated, 'errors:', result.apply.errors.length);
  }
  fs.writeFileSync(reportPath, JSON.stringify(result, null, 2), 'utf8');
  console.log('Wrote', reportPath);
  process.exit(result.apply?.errors?.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
