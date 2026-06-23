#!/usr/bin/env node
/**
 * Phase 1.6 Bundle 2 — merged dry-run summary (JSON + CSV + SHA256 manifest).
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  initRemediationEnv,
  getConnectionString,
  withPgClient,
  parseCompanyId,
  ensureReportsDir,
  timestampStamp,
  repoRoot,
  reportsDir,
  runDiagnostics,
} from './lib/pg-remediation-client.mjs';
import { loadEnvLocal, assertRemediationTarget, printMaskedTarget, sha256Text } from './remediation-env-guard.mjs';
import { runPaymentContactDryRun } from './dry-run-payment-contact-backfill.mjs';
import { runBranchDryRun } from './dry-run-branch-attribution.mjs';
import { runOpeningBalanceDryRun } from './dry-run-opening-balance-ar-ap-risk.mjs';
import { summarizeRows } from './lib/confidence-rules.mjs';

loadEnvLocal(repoRoot);
initRemediationEnv();

function fail(msg, code = 1) {
  console.error(`❌ ${msg}`);
  process.exit(code);
}

function rowsToCsv(rows) {
  if (!rows.length) return '';
  const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const esc = (v) => {
    const s = v == null ? '' : String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [keys.join(',')];
  for (const r of rows) {
    lines.push(keys.map((k) => esc(r[k])).join(','));
  }
  return lines.join('\n');
}

async function main() {
  console.log('========================================');
  console.log('PHASE 1.6 — REMEDIATION DRY-RUN SUMMARY');
  console.log('========================================\n');

  let target;
  try {
    target = assertRemediationTarget({ inventoryOnly: true });
  } catch (e) {
    fail(e.message);
  }
  printMaskedTarget(target);

  const cs = getConnectionString();
  if (!cs) fail('DATABASE_URL required');

  const companyId = parseCompanyId();
  const runAt = new Date().toISOString();

  const diagnostics = await withPgClient(cs, runDiagnostics);
  const paymentRows = await runPaymentContactDryRun(cs, companyId);
  const branchRows = await runBranchDryRun(cs, companyId);
  const openingResult = await runOpeningBalanceDryRun(cs, companyId);

  const applyRows = [...paymentRows, ...branchRows];
  const safe_apply_total = applyRows.filter((r) => r.safe_apply).length;
  const manual_review_total = applyRows.filter((r) => r.manual_review).length;

  const byCompanyIssue = summarizeRows(
    applyRows.map((r) => ({
      company_name: r.company_name,
      issue_type: r.issue_type,
      safe_apply: r.safe_apply,
      manual_review: r.manual_review,
    })),
    ['company_name', 'issue_type']
  );

  const envelope = {
    run_at: runAt,
    staging_guard: 'UNIFIED_LEDGER_STAGING=1',
    clone_database: target.database,
    diagnostics_summary: diagnostics?.summary,
    sections: {
      payment_contact: { rows: paymentRows, count: paymentRows.length },
      branch_attribution: { rows: branchRows, count: branchRows.length },
      opening_balance: openingResult,
    },
    rows: applyRows,
    summary: {
      payment_contact_count: paymentRows.length,
      branch_attribution_count: branchRows.length,
      opening_balance_je_count: openingResult.opening_balance_rows.length,
      safe_apply_total,
      manual_review_total,
      by_company_issue: byCompanyIssue,
    },
  };

  const jsonText = JSON.stringify(envelope, null, 2);
  const sha256 = sha256Text(jsonText);
  envelope.manifest = { sha256, algorithm: 'sha256', generated_at: runAt };
  const finalText = JSON.stringify(envelope, null, 2);
  const finalSha = sha256Text(finalText);

  ensureReportsDir();
  const stamp = timestampStamp(runAt);
  const jsonPath = path.join(reportsDir, `remediation-dry-run-${stamp}.json`);
  const csvPath = path.join(reportsDir, `remediation-dry-run-${stamp}.csv`);
  fs.writeFileSync(jsonPath, finalText, 'utf8');
  fs.writeFileSync(csvPath, rowsToCsv(applyRows), 'utf8');

  console.log(`Dry-run JSON: ${jsonPath}`);
  console.log(`Dry-run CSV: ${csvPath}`);
  console.log(`SHA256: ${finalSha}`);
  console.log(`safe_apply=${safe_apply_total}, manual_review=${manual_review_total}`);

  const diagPayment = (diagnostics?.companies || []).reduce(
    (s, c) => s + (Number(c.payments_missing_contact_sale_linked) || 0),
    0
  );
  const diagBranch = (diagnostics?.companies || []).reduce(
    (s, c) => s + (Number(c.branch_attribution_risk) || 0),
    0
  );

  if (paymentRows.length !== diagPayment || branchRows.length !== diagBranch) {
    console.warn(
      `⚠ Drift vs diagnostics: payment ${paymentRows.length}/${diagPayment}, branch ${branchRows.length}/${diagBranch}`
    );
    process.exit(2);
  }
}

main().catch((e) => fail(e.message));
