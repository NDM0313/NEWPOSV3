#!/usr/bin/env node
/**
 * Phase 1.6.1 Bundle 2 — export finance/operator branch review manifest (CSV + JSON).
 */
import fs from 'fs';
import path from 'path';
import {
  initRemediationEnv,
  writeJsonReport,
  writeCsvReport,
  repoRoot,
  fail,
} from './lib/pg-remediation-client.mjs';
import { loadEnvLocal, assertRemediationTarget, printMaskedTarget } from './remediation-env-guard.mjs';
import { MANIFEST_COLUMNS } from './lib/manifest-schema.mjs';

loadEnvLocal(repoRoot);
initRemediationEnv();

function parseInventoryFile() {
  const idx = process.argv.indexOf('--inventory-file');
  if (idx >= 0) return process.argv[idx + 1];
  const reportsDir = path.join(repoRoot, 'reports', 'single-core-ledger');
  if (!fs.existsSync(reportsDir)) fail('No reports dir; run inventory first');
  const files = fs
    .readdirSync(reportsDir)
    .filter((f) => f.startsWith('branch-manual-review-inventory-') && f.endsWith('.json'))
    .sort()
    .reverse();
  if (!files.length) fail('No inventory JSON found; run inventory-branch-manual-review.mjs first');
  return path.join(reportsDir, files[0]);
}

function toManifestRow(r) {
  return {
    entry_no: r.entry_no,
    journal_entry_id: r.journal_entry_id,
    company_name: r.company_name,
    company_id: r.company_id,
    reference_type: r.reference_type,
    date: r.entry_date,
    description: r.description || '',
    amount: r.amount,
    from_account: r.from_account || '',
    to_account: r.to_account || '',
    current_branch: r.current_branch_id || '',
    candidate_branch_1: r.candidate_branch_1 || '',
    candidate_branch_1_reason: r.candidate_branch_1_reason || '',
    candidate_branch_2: r.candidate_branch_2 || '',
    candidate_branch_2_reason: r.candidate_branch_2_reason || '',
    recommended_branch_id: r.recommended_branch_id || '',
    recommended_branch_label: r.recommended_branch_label || '',
    confidence: r.confidence || '',
    approval_required: r.approval_required ? 'true' : 'false',
    final_status: r.final_status || '',
    operator_decision: '',
    operator_note: '',
    approved_branch_id: '',
  };
}

async function main() {
  console.log('========================================');
  console.log('PHASE 1.6.1 — EXPORT BRANCH MANUAL REVIEW MANIFEST');
  console.log('========================================\n');

  let guard;
  try {
    guard = assertRemediationTarget({ inventoryOnly: true });
  } catch (e) {
    fail(e.message);
  }
  printMaskedTarget(guard);

  const inventoryPath = parseInventoryFile();
  const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
  const manifestRows = (inventory.rows || []).map(toManifestRow);

  const runAt = new Date().toISOString();
  const envelope = {
    run_at: runAt,
    clone_db: guard.cloneDb,
    source_inventory: inventoryPath,
    source_inventory_sha256: inventory.manifest?.sha256 || null,
    summary: {
      total_rows: manifestRows.length,
      approval_required: manifestRows.filter((r) => r.approval_required === 'true').length,
      safe_recommendation: manifestRows.filter((r) => r.final_status === 'safe_recommendation').length,
    },
    rows: manifestRows,
  };

  const { jsonPath, hash, stamp } = writeJsonReport('branch-manual-review', envelope);
  envelope.manifest = { sha256: hash, json_path: jsonPath };
  fs.writeFileSync(jsonPath, JSON.stringify(envelope, null, 2), 'utf8');

  const csvPath = writeCsvReport('branch-manual-review', manifestRows, MANIFEST_COLUMNS, stamp);

  console.log(`Rows: ${manifestRows.length}`);
  console.log(`JSON: ${jsonPath}`);
  console.log(`CSV: ${csvPath}`);
  console.log(`SHA256: ${hash}`);
  console.log('\nFill operator_decision / approved_branch_id in JSON, then apply.');
}

main().catch((e) => fail(e.message));
