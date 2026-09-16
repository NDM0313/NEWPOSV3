#!/usr/bin/env node
/**
 * Merge operator branch decisions into manifest for clone apply.
 * Usage: node prepare-operator-branch-manifest.mjs [--manifest-file path] [--decisions-file path]
 */
import fs from 'fs';
import path from 'path';
import { repoRoot, fail, writeJsonReport } from './lib/pg-remediation-client.mjs';

function parseArg(flag) {
  const idx = process.argv.indexOf(flag);
  return idx >= 0 ? process.argv[idx + 1] : null;
}

function findLatestManifest() {
  const reportsDir = path.join(repoRoot, 'reports', 'single-core-ledger');
  const files = fs
    .readdirSync(reportsDir)
    .filter((f) => f.startsWith('branch-manual-review-') && f.endsWith('.json') && !f.includes('inventory') && !f.includes('approved'))
    .sort()
    .reverse();
  if (!files.length) fail('No branch-manual-review manifest found');
  return path.join(reportsDir, files[0]);
}

function main() {
  const manifestPath = parseArg('--manifest-file') || findLatestManifest();
  const decisionsPath =
    parseArg('--decisions-file') ||
    path.join(repoRoot, 'scripts/ledger-remediation/clone-operator-branch-decisions.example.json');

  if (!fs.existsSync(manifestPath)) fail(`Manifest not found: ${manifestPath}`);
  if (!fs.existsSync(decisionsPath)) fail(`Decisions file not found: ${decisionsPath}`);

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const decisions = JSON.parse(fs.readFileSync(decisionsPath, 'utf8'));
  const byJe = new Map((decisions.decisions || []).map((d) => [String(d.journal_entry_id), d]));

  let merged = 0;
  for (const row of manifest.rows || []) {
    const d = byJe.get(String(row.journal_entry_id));
    if (!d) continue;
    row.operator_decision = 'approve';
    row.approved_branch_id = d.approved_branch_id;
    row.operator_note = d.operator_note || '';
    row.recommended_branch_label = d.approved_branch_label || row.recommended_branch_label;
    merged += 1;
  }

  delete manifest.manifest;
  manifest.operator_decisions_source = decisionsPath;
  manifest.operator_decisions_merged_at = new Date().toISOString();
  manifest.summary = manifest.summary || {};
  manifest.summary.operator_approved = merged;

  const { jsonPath, hash } = writeJsonReport('branch-manual-review-approved', manifest);
  manifest.manifest = { sha256: hash, json_path: jsonPath, source_manifest: manifestPath };
  fs.writeFileSync(jsonPath, JSON.stringify(manifest, null, 2), 'utf8');

  console.log(`Merged operator decisions: ${merged} / ${(manifest.rows || []).length}`);
  console.log(`Output: ${jsonPath}`);
  console.log(`SHA256: ${hash}`);
}

main();
