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
  for (const r of inv.rows || []) {
    if (r.payment_id) ids.add(String(r.payment_id));
    if (r.issue_type === 'payments_missing_contact_sale_linked' && r.payment_id) ids.add(String(r.payment_id));
  }
  if (inv.data?.sections?.payment_contact?.rows) {
    for (const r of inv.data.sections.payment_contact.rows) {
      if (r.payment_id) ids.add(String(r.payment_id));
    }
  }
  if (inv.data?.payment_contact?.rows) {
    for (const r of inv.data.payment_contact.rows) {
      if (r.payment_id) ids.add(String(r.payment_id));
    }
  }
  return ids;
}

function branchJeIds(inv) {
  const ids = new Set();
  const source = inv.data?.rows || inv.rows || [];
  for (const r of source) {
    const id = r.journal_entry_id || r.id;
    if (id) ids.add(String(id));
  }
  return ids;
}

function summaryCounts(data) {
  const s = data.summary || {};
  return {
    payment_gaps: s.payments_missing_contact_sale_linked ?? s.payment_contact_gaps ?? null,
    branch_risk: s.branch_attribution_risk ?? null,
    total_rows: s.total_rows ?? (data.rows?.length ?? null),
    payment_rows: data.sections?.payment_contact?.rows?.length ?? data.payment_contact?.safe_apply ?? null,
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

  const baselineBranch = branchJeIds(
    baseline.data.rows
      ? { data: baseline.data, rows: baseline.data.rows }
      : { rows: [], data: baseline.data }
  );
  const freshBranchInv = findLatest('branch-manual-review-inventory-');
  let freshBranch = new Set();
  if (freshBranchInv) {
    const bi = JSON.parse(fs.readFileSync(freshBranchInv, 'utf8'));
    freshBranch = branchJeIds({ data: bi, rows: bi.rows });
  }

  const baselineBranchInv = fs
    .readdirSync(path.join(repoRoot, 'reports', 'single-core-ledger'))
    .filter((f) => f.startsWith('branch-manual-review-inventory-') && f.endsWith('.json'))
    .sort()
    .reverse()[1];
  let baselineBranch = new Set();
  if (baselineBranchInv) {
    const bi = JSON.parse(
      fs.readFileSync(path.join(repoRoot, 'reports', 'single-core-ledger', baselineBranchInv), 'utf8')
    );
    baselineBranch = branchJeIds({ data: bi, rows: bi.rows });
  } else if (freshBranchInv) {
    baselineBranch = freshBranch;
  }
  const branchDiff = setDiff(baselineBranch, freshBranch);

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
    },
    fresh_counts: {
      payment_ids: freshPayments.size,
      branch_je_ids: freshBranch.size,
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
