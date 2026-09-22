#!/usr/bin/env node
/**
 * Phase 1.6.2 — compare fresh prodcheck clone pre-apply inventory vs Phase 1.6 baseline.
 */
import fs from 'fs';
import path from 'path';
import { repoRoot, writeJsonReport, fail } from './lib/pg-remediation-client.mjs';

function parseArg(flag) {
  const idx = process.argv.indexOf(flag);
  return idx >= 0 ? process.argv[idx + 1] : null;
}

function findLatest(prefix) {
  const dir = path.join(repoRoot, 'reports', 'single-core-ledger');
  const files = fs.readdirSync(dir).filter((f) => f.startsWith(prefix) && f.endsWith('.json')).sort().reverse();
  return files.length ? path.join(dir, files[0]) : null;
}

function loadInventory(filePath) {
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const rows = data.rows || data.companies || [];
  return { data, rows, path: filePath };
}

function paymentIds(inv) {
  const ids = new Set();
  const sources = [
    ...(inv.data?.payment_contact_rows || []),
    ...(inv.data?.rows || []),
    ...(inv.rows || []),
    ...(inv.data?.sections?.payment_contact?.rows || []),
    ...(inv.data?.payment_contact?.rows || []),
  ];
  for (const r of sources) {
    if (r.payment_id) ids.add(String(r.payment_id));
  }
  return ids;
}

function branchJeIds(inv) {
  const ids = new Set();
  const sources = [
    ...(inv.data?.branch_attribution_rows || []),
    ...(inv.data?.rows || []),
    ...(inv.rows || []),
  ];
  for (const r of sources) {
    const id = r.journal_entry_id || r.id;
    if (id) ids.add(String(id));
  }
  return ids;
}

function inventoryTotals(data) {
  const t = data.totals || {};
  return {
    payment_gaps: t.payment_contact_count ?? null,
    branch_risk: t.branch_attribution_count ?? data.diagnostics_summary?.branch_attribution_risk_total ?? null,
    manual_review: t.manual_review ?? null,
  };
}

function setDiff(a, b) {
  const onlyA = [...a].filter((x) => !b.has(x));
  const onlyB = [...b].filter((x) => !a.has(x));
  const both = [...a].filter((x) => b.has(x));
  return { onlyA, onlyB, bothCount: both.length };
}

function main() {
  const baselinePath =
    parseArg('--baseline-inventory') ||
    findLatest('remediation-inventory-') ||
    fail('No baseline inventory; pass --baseline-inventory');
  const freshPath =
    parseArg('--fresh-inventory') ||
    findLatest('remediation-inventory-') ||
    fail('No fresh inventory; pass --fresh-inventory');

  if (baselinePath === freshPath) fail('Baseline and fresh inventory must differ');

  const baseline = loadInventory(baselinePath);
  const fresh = loadInventory(freshPath);

  const baselinePayments = paymentIds(baseline);
  const freshPayments = paymentIds(fresh);
  const paymentDiff = setDiff(baselinePayments, freshPayments);

  const baselineBranch = branchJeIds(baseline);
  const freshBranch = branchJeIds(fresh);
  const branchDiff = setDiff(baselineBranch, freshBranch);

  const baselineTotals = inventoryTotals(baseline.data);
  const freshTotals = inventoryTotals(fresh.data);

  const paymentCountDelta = freshPayments.size - baselinePayments.size;
  const branchCountDelta = freshBranch.size - baselineBranch.size;

  let recommendation = 'APPROVE_MANIFEST';
  const blockers = [];
  if (Math.abs(paymentCountDelta) > 5) {
    recommendation = 'REVIEW_REQUIRED';
    blockers.push(`payment_gap_count_delta=${paymentCountDelta}`);
  }
  if (paymentDiff.onlyA.length > 0 || paymentDiff.onlyB.length > 0) {
    if (paymentDiff.onlyA.length + paymentDiff.onlyB.length > 5) recommendation = 'REVIEW_REQUIRED';
  }
  if (Math.abs(branchCountDelta) > 2) {
    recommendation = 'REVIEW_REQUIRED';
    blockers.push(`branch_risk_count_delta=${branchCountDelta}`);
  }
  if (freshPayments.size === 0 && baselinePayments.size > 0) {
    recommendation = 'BLOCK_PRODUCTION';
    blockers.push('fresh_clone_has_zero_payment_gaps');
  }

  const envelope = {
    run_at: new Date().toISOString(),
    baseline_inventory: baselinePath,
    fresh_inventory: freshPath,
    baseline_counts: {
      payment_ids: baselinePayments.size,
      branch_je_ids: baselineBranch.size,
      totals: baselineTotals,
    },
    fresh_counts: {
      payment_ids: freshPayments.size,
      branch_je_ids: freshBranch.size,
      totals: freshTotals,
    },
    deltas: {
      payment_count: paymentCountDelta,
      branch_count: branchCountDelta,
    },
    payment_id_diff: {
      only_in_baseline: paymentDiff.onlyA.slice(0, 20),
      only_in_fresh: paymentDiff.onlyB.slice(0, 20),
      overlap: paymentDiff.bothCount,
    },
    branch_je_id_diff: {
      only_in_baseline: branchDiff.onlyA.slice(0, 20),
      only_in_fresh: branchDiff.onlyB.slice(0, 20),
      overlap: branchDiff.bothCount,
    },
    recommendation,
    blockers,
  };

  const { jsonPath, hash } = writeJsonReport('fresh-clone-comparison', envelope);
  console.log(`Recommendation: ${recommendation}`);
  console.log(`Payment IDs: baseline=${baselinePayments.size} fresh=${freshPayments.size} delta=${paymentCountDelta}`);
  console.log(`Branch JEs: baseline=${baselineBranch.size} fresh=${freshBranch.size} delta=${branchCountDelta}`);
  console.log(`JSON: ${jsonPath}`);
  console.log(`SHA256: ${hash}`);

  if (recommendation === 'BLOCK_PRODUCTION') process.exit(2);
  if (recommendation === 'REVIEW_REQUIRED') process.exit(1);
}

main();
