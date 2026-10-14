#!/usr/bin/env node
/**
 * Phase 1.6.2 — export unified production remediation approval manifest (approval-only).
 */
import fs from 'fs';
import path from 'path';
import {
  repoRoot,
  writeJsonReport,
  writeCsvReport,
  fail,
  sha256,
} from './lib/pg-remediation-client.mjs';

const APPROVAL_COLUMNS = [
  'repair_type',
  'entity_type',
  'entity_id',
  'company_id',
  'company_name',
  'display_ref',
  'before_value',
  'proposed_after_value',
  'proposed_after_label',
  'source_evidence',
  'clone_validation_timestamp',
  'dry_run_sha256',
  'risk_level',
  'finance_approval',
  'production_apply_status',
];

function findLatest(prefix) {
  const dir = path.join(repoRoot, 'reports', 'single-core-ledger');
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir).filter((f) => f.startsWith(prefix) && f.endsWith('.json')).sort().reverse();
  return files.length ? path.join(dir, files[0]) : null;
}

function parseArg(flag) {
  const idx = process.argv.indexOf(flag);
  return idx >= 0 ? process.argv[idx + 1] : null;
}

function main() {
  const dryRunPath = parseArg('--dry-run-file') || findLatest('remediation-dry-run-');
  const branchApprovedPath =
    parseArg('--branch-manifest') || findLatest('branch-manual-review-approved-');
  const comparisonPath = parseArg('--comparison-file') || findLatest('fresh-clone-comparison-');

  if (!dryRunPath || !fs.existsSync(dryRunPath)) fail('Dry-run file required');
  const dryRun = JSON.parse(fs.readFileSync(dryRunPath, 'utf8'));
  const dryRunHash = dryRun.manifest?.sha256 || sha256(JSON.stringify({ ...dryRun, manifest: undefined }, null, 2));

  const cloneTs = dryRun.run_at || new Date().toISOString();
  const rows = [];

  const paymentRows =
    dryRun.sections?.payment_contact?.rows ??
    dryRun.payment_contact?.rows ??
    (dryRun.rows || []).filter((r) => r.issue_type === 'payments_missing_contact_sale_linked');

  for (const r of paymentRows.filter((x) => x.safe_apply)) {
    rows.push({
      repair_type: 'payment_contact_backfill',
      entity_type: 'payment',
      entity_id: r.payment_id,
      company_id: r.company_id,
      company_name: r.company_name,
      display_ref: r.reference_number || r.invoice_no || r.payment_id,
      before_value: r.old_contact_id ?? null,
      proposed_after_value: r.proposed_contact_id,
      proposed_after_label: r.proposed_contact_name || r.proposed_contact_code || '',
      source_evidence: r.reason || 'sale_customer_id_match',
      clone_validation_timestamp: cloneTs,
      dry_run_sha256: dryRunHash,
      risk_level: 'low',
      finance_approval: '',
      production_apply_status: 'pending',
    });
  }

  const branchAutoRows = (
    dryRun.sections?.branch_attribution?.rows ??
    dryRun.branch_attribution?.rows ??
    (dryRun.rows || []).filter((r) => r.issue_type === 'branch_attribution_risk' && r.safe_apply)
  ).filter((r) => r.safe_apply === true);

  const manualJeIds = new Set();
  if (branchApprovedPath && fs.existsSync(branchApprovedPath)) {
    const branchManifest = JSON.parse(fs.readFileSync(branchApprovedPath, 'utf8'));
    for (const r of branchManifest.rows || []) {
      if (String(r.operator_decision || '').toLowerCase() === 'approve') {
        manualJeIds.add(String(r.journal_entry_id));
      }
    }
  }

  for (const r of branchAutoRows) {
    if (manualJeIds.has(String(r.journal_entry_id))) continue;
    rows.push({
      repair_type: 'branch_auto',
      entity_type: 'journal_entry',
      entity_id: r.journal_entry_id,
      company_id: r.company_id,
      company_name: r.company_name,
      display_ref: r.entry_no,
      before_value: null,
      proposed_after_value: r.proposed_branch_id,
      proposed_after_label: r.recommended_branch_label || '',
      source_evidence: r.reason || r.resolution_source || '',
      clone_validation_timestamp: cloneTs,
      dry_run_sha256: dryRunHash,
      risk_level: 'medium',
      finance_approval: '',
      production_apply_status: 'pending',
    });
  }

  if (branchApprovedPath && fs.existsSync(branchApprovedPath)) {
    const branchManifest = JSON.parse(fs.readFileSync(branchApprovedPath, 'utf8'));
    for (const r of (branchManifest.rows || []).filter(
      (x) => String(x.operator_decision || '').toLowerCase() === 'approve'
    )) {
      rows.push({
        repair_type: 'branch_manual',
        entity_type: 'journal_entry',
        entity_id: r.journal_entry_id,
        company_id: r.company_id,
        company_name: r.company_name,
        display_ref: r.entry_no,
        before_value: null,
        proposed_after_value: r.approved_branch_id,
        proposed_after_label: r.recommended_branch_label || '',
        source_evidence: r.operator_note || r.final_status || '',
        clone_validation_timestamp: branchManifest.approved_at || branchManifest.run_at || cloneTs,
        dry_run_sha256: branchManifest.manifest?.sha256 || dryRunHash,
        risk_level: 'medium',
        finance_approval: '',
        production_apply_status: 'pending',
      });
    }
  }

  let comparison = null;
  if (comparisonPath && fs.existsSync(comparisonPath)) {
    comparison = JSON.parse(fs.readFileSync(comparisonPath, 'utf8'));
  }

  const envelope = {
    run_at: new Date().toISOString(),
    status: 'PROPOSAL_ONLY',
    production_postgres_mutated: false,
    unified_ledger_engine: 'OFF',
    source_dry_run: dryRunPath,
    source_branch_manifest: branchApprovedPath,
    source_comparison: comparisonPath,
    comparison_recommendation: comparison?.recommendation || null,
    expected_counts: {
      payment_contact_backfill: rows.filter((r) => r.repair_type === 'payment_contact_backfill').length,
      branch_auto: rows.filter((r) => r.repair_type === 'branch_auto').length,
      branch_manual: rows.filter((r) => r.repair_type === 'branch_manual').length,
      total: rows.length,
    },
    rows,
  };

  const bodyForHash = { ...envelope };
  const { jsonPath, stamp } = writeJsonReport('production-remediation-approval', bodyForHash);
  const bodyText = fs.readFileSync(jsonPath, 'utf8');
  const bodyParsed = JSON.parse(bodyText);
  const hash = sha256(JSON.stringify(bodyParsed, null, 2));
  bodyParsed.manifest = { sha256: hash, json_path: jsonPath };
  fs.writeFileSync(jsonPath, JSON.stringify(bodyParsed, null, 2), 'utf8');

  const csvPath = writeCsvReport('production-remediation-approval', rows, APPROVAL_COLUMNS, stamp);

  console.log(`Total approval rows: ${rows.length}`);
  console.log(`  payment: ${envelope.expected_counts.payment_contact_backfill}`);
  console.log(`  branch_auto: ${envelope.expected_counts.branch_auto}`);
  console.log(`  branch_manual: ${envelope.expected_counts.branch_manual}`);
  console.log(`JSON: ${jsonPath}`);
  console.log(`CSV: ${csvPath}`);
  console.log(`SHA256: ${hash}`);
  console.log('PROPOSAL ONLY — production not mutated.');
}

main();
