#!/usr/bin/env node
/**
 * Phase 1.6 Bundle 2C — opening balance / AR-AP risk report (read-only, no apply).
 */
import {
  initRemediationEnv,
  getConnectionString,
  withPgClient,
  readSqlFile,
  parseCompanyId,
  repoRoot,
} from './lib/pg-remediation-client.mjs';
import { loadEnvLocal, assertRemediationTarget, printMaskedTarget } from './remediation-env-guard.mjs';
import { classifyOpeningBalanceRiskRow } from './lib/confidence-rules.mjs';

loadEnvLocal(repoRoot);
initRemediationEnv();

function fail(msg) {
  console.error(`❌ ${msg}`);
  process.exit(1);
}

export async function runOpeningBalanceDryRun(connectionString, companyId = null) {
  return withPgClient(connectionString, async (client) => {
    const openingSql = readSqlFile('inventory-opening-balance-risk.sql');
    const { rows: openingRows } = await client.query(openingSql, [companyId]);

    const arApSnapshot = [];
    const companies = companyId
      ? [{ id: companyId }]
      : (
          await client.query(
            `SELECT id, name FROM companies WHERE COALESCE(is_active, true) = true ORDER BY name`
          )
        ).rows;

    for (const co of companies) {
      const { rows: diag } = await client.query(
        `SELECT opening_balance_null_branch_je_count FROM v_single_core_ledger_company_diagnostics WHERE company_id = $1`,
        [co.id]
      );
      const obCount = Number(diag[0]?.opening_balance_null_branch_je_count) || 0;
      if (obCount > 0) {
        arApSnapshot.push(
          classifyOpeningBalanceRiskRow({
            issue_type: 'opening_balance_null_branch_je_count',
            company_id: co.id,
            company_name: co.name,
            count: obCount,
            reason: 'opening_balance_null_branch_info_only',
          })
        );
      }
    }

    return {
      opening_balance_rows: openingRows.map((r) =>
        classifyOpeningBalanceRiskRow({
          issue_type: 'opening_balance_null_branch_je_count',
          ...r,
          reason: 'opening_balance_je_null_branch',
        })
      ),
      company_snapshots: arApSnapshot,
    };
  });
}

async function main() {
  let target;
  try {
    target = assertRemediationTarget({ inventoryOnly: true });
  } catch (e) {
    fail(e.message);
  }
  printMaskedTarget(target);

  const cs = getConnectionString();
  if (!cs) fail('DATABASE_URL required');

  const result = await runOpeningBalanceDryRun(cs, parseCompanyId());
  console.log(JSON.stringify(result, null, 2));
}

import { fileURLToPath } from 'url';
import path from 'path';

const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  main().catch((e) => fail(e.message));
}
