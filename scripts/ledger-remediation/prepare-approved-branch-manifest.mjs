#!/usr/bin/env node
/**
 * Auto-fill operator_decision=approve for safe_recommendation rows (clone validation helper).
 * Finance-required rows remain blank for manual review.
 */
import fs from 'fs';
import path from 'path';
import { repoRoot, fail, writeJsonReport } from './lib/pg-remediation-client.mjs';

function parseManifestFile() {
  const idx = process.argv.indexOf('--manifest-file');
  if (idx >= 0) return process.argv[idx + 1];
  const reportsDir = path.join(repoRoot, 'reports', 'single-core-ledger');
  const files = fs
    .readdirSync(reportsDir)
    .filter((f) => f.startsWith('branch-manual-review-') && f.endsWith('.json') && !f.includes('inventory'))
    .sort()
    .reverse();
  if (!files.length) fail('No manifest JSON found');
  return path.join(reportsDir, files[0]);
}

function main() {
  const manifestPath = parseManifestFile();
  const parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  let approved = 0;
  for (const row of parsed.rows || []) {
    if (row.final_status === 'safe_recommendation' && row.recommended_branch_id) {
      row.operator_decision = 'approve';
      row.approved_branch_id = row.recommended_branch_id;
      row.operator_note = row.operator_note || 'auto-approved safe_recommendation (Phase 1.6.1 clone validation)';
      approved += 1;
    }
  }
  delete parsed.manifest;
  parsed.summary = parsed.summary || {};
  parsed.summary.operator_approved = approved;
  parsed.approved_at = new Date().toISOString();

  const { jsonPath, hash } = writeJsonReport('branch-manual-review-approved', parsed);
  parsed.manifest = { sha256: hash, json_path: jsonPath, source: manifestPath };
  fs.writeFileSync(jsonPath, JSON.stringify(parsed, null, 2), 'utf8');

  console.log(`Approved safe_recommendation rows: ${approved}`);
  console.log(`Output: ${jsonPath}`);
  console.log(`SHA256: ${hash}`);
}

main();
