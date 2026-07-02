#!/usr/bin/env node
/**
 * Phase 1.6 Bundle 2B — branch attribution dry-run (read-only).
 */
import { loadEnvLocal, assertRemediationTarget, printMaskedTarget } from './remediation-env-guard.mjs';
import {
  repoRoot,
  getConnectionString,
  parseArg,
  fail,
  withPgClient,
} from './lib/pg-remediation-client.mjs';
import { runBranchAttributionDryRun as runBranchAttributionDryRunRows } from './lib/branch-resolution.mjs';

loadEnvLocal(repoRoot);
const companyId = parseArg('--company-id');

export async function runBranchAttributionDryRun(connectionString, cid = null) {
  return withPgClient(connectionString, (client) => runBranchAttributionDryRunRows(client, cid));
}

export { runBranchAttributionDryRun as runBranchDryRun };

async function main() {
  let target;
  try {
    target = assertRemediationTarget();
  } catch (e) {
    fail(e.message);
  }
  printMaskedTarget(target);
  const cs = getConnectionString();
  if (!cs) fail('DATABASE_URL required');

  const rows = await runBranchAttributionDryRun(cs, companyId);
  const safe = rows.filter((r) => r.safe_apply).length;
  console.log(`Branch attribution dry-run: ${rows.length} rows, safe_apply=${safe}`);
}

main().catch((e) => fail(e.message));
