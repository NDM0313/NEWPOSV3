#!/usr/bin/env node
/**
 * Phase 1.6.1 Bundle 1 — exact branch attribution risk inventory with enrichment.
 */
import fs from 'fs';
import path from 'path';
import {
  initRemediationEnv,
  getConnectionString,
  withPgClient,
  readSqlFile,
  writeJsonReport,
  repoRoot,
  fail,
} from './lib/pg-remediation-client.mjs';
import {
  loadEnvLocal,
  assertRemediationTarget,
  printMaskedTarget,
} from './remediation-env-guard.mjs';
import { resolveTransferBranchCandidates } from './lib/transfer-branch-candidates.mjs';
import { resolveManualReceiptBranchCandidates } from './lib/manual-receipt-branch-candidates.mjs';
import { resolveBranchForJe } from './lib/branch-resolution.mjs';

loadEnvLocal(repoRoot);
initRemediationEnv();

function parseCompanyId() {
  const idx = process.argv.indexOf('--company-id');
  return idx >= 0 ? process.argv[idx + 1] : null;
}

function parseLines(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function loadBranches(client, companyIds) {
  const map = new Map();
  const { rows } = await client.query(
    `SELECT id, company_id, code, name FROM branches WHERE company_id = ANY($1::uuid[]) AND is_active = true`,
    [companyIds]
  );
  for (const b of rows) map.set(String(b.id), b);
  return map;
}

async function enrichRow(client, row, branchesById) {
  const refType = String(row.reference_type || '').toLowerCase().trim();
  let enrichment = {};
  if (refType === 'transfer') {
    enrichment = resolveTransferBranchCandidates(row, branchesById);
  } else if (refType === 'manual_receipt') {
    enrichment = await resolveManualReceiptBranchCandidates(client, row, branchesById);
  } else {
    const baseline = await resolveBranchForJe(client, {
      ...row,
      branch_id: row.current_je_branch_id,
    });
    enrichment = {
      from_account: '',
      to_account: '',
      candidate_branch_1: baseline.proposed_branch_id || '',
      candidate_branch_1_reason: baseline.reason || baseline.resolution_source || '',
      candidate_branch_2: '',
      candidate_branch_2_reason: '',
      recommended_branch_id: baseline.proposed_branch_id || null,
      recommended_branch_label: baseline.proposed_branch_id
        ? branchesById.get(String(baseline.proposed_branch_id))?.name || baseline.proposed_branch_id
        : '',
      confidence: baseline.confidence || 'low',
      final_status: baseline.safe_apply ? 'safe_recommendation' : 'finance_required',
      approval_required: !baseline.safe_apply,
      possible_branch_candidates: baseline.proposed_branch_id
        ? [{ branch_id: baseline.proposed_branch_id, reason: baseline.reason }]
        : [],
      evidence: [baseline.reason || 'baseline_branch_resolution'],
    };
  }

  const debitLines = parseLines(row.debit_lines);
  const creditLines = parseLines(row.credit_lines);

  return {
    company_id: row.company_id,
    company_name: row.company_name,
    journal_entry_id: row.journal_entry_id,
    entry_no: row.entry_no,
    entry_date: row.entry_date,
    reference_type: row.reference_type,
    reference_id: row.reference_id,
    current_branch_id: row.current_je_branch_id,
    description: row.description,
    amount: Number(row.total_amount || 0),
    created_by: row.created_by,
    created_by_email: row.created_by_email,
    linked_payment_id: row.linked_payment_id,
    payment_branch_id: row.payment_branch_id,
    debit_accounts: debitLines.map((l) => ({
      code: l.code,
      name: l.name,
      account_id: l.account_id,
      branch_id: l.branch_id,
      debit: l.debit,
    })),
    credit_accounts: creditLines.map((l) => ({
      code: l.code,
      name: l.name,
      account_id: l.account_id,
      branch_id: l.branch_id,
      credit: l.credit,
    })),
    issue_type: 'branch_attribution_risk',
    fix_class: 'branch_attribution_review',
    ...enrichment,
  };
}

function renderMarkdown(envelope) {
  const lines = [
    '# Single Core Ledger — Phase 1.6.1 Branch Manual Review',
    '',
    `**Run at:** ${envelope.run_at}`,
    `**Clone DB:** ${envelope.clone_db}`,
    `**Row count:** ${envelope.summary.total_rows}`,
    '',
    '## Summary by company',
    '',
    '| Company | Rows | safe_recommendation | finance_required | exception_candidate |',
    '|---------|-----:|--------------------:|-----------------:|--------------------:|',
  ];

  for (const s of envelope.summary.by_company) {
    lines.push(
      `| ${s.company_name} | ${s.total} | ${s.safe_recommendation} | ${s.finance_required} | ${s.exception_candidate} |`
    );
  }

  lines.push('', '## Row detail', '');
  for (const r of envelope.rows) {
    lines.push(`### ${r.company_name} — ${r.entry_no} (${r.reference_type})`);
    lines.push('');
    lines.push(`- **journal_entry_id:** \`${r.journal_entry_id}\``);
    lines.push(`- **date:** ${r.entry_date}`);
    lines.push(`- **description:** ${r.description || 'n/a'}`);
    lines.push(`- **amount:** ${r.amount}`);
    lines.push(`- **final_status:** ${r.final_status}`);
    lines.push(`- **confidence:** ${r.confidence}`);
    if (r.recommended_branch_id) {
      lines.push(`- **recommended_branch:** ${r.recommended_branch_label} (\`${r.recommended_branch_id}\`)`);
    }
    if (r.evidence?.length) {
      lines.push('- **evidence:**');
      for (const e of r.evidence) lines.push(`  - ${e}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

async function main() {
  console.log('========================================');
  console.log('PHASE 1.6.1 — BRANCH MANUAL REVIEW INVENTORY');
  console.log('========================================\n');

  let guard;
  try {
    guard = assertRemediationTarget({ inventoryOnly: true });
  } catch (e) {
    fail(e.message);
  }
  printMaskedTarget(guard);

  const cs = getConnectionString();
  if (!cs) fail('DATABASE_URL required');

  const companyId = parseCompanyId();
  const runAt = new Date().toISOString();

  const envelope = await withPgClient(cs, async (client) => {
    const sql = readSqlFile('inventory-branch-manual-review-detail.sql');
    const { rows: rawRows } = await client.query(sql, [companyId]);
    const companyIds = [...new Set(rawRows.map((r) => r.company_id))];
    const branchesById = await loadBranches(client, companyIds);

    const enriched = [];
    for (const row of rawRows) {
      enriched.push(await enrichRow(client, row, branchesById));
    }

    const byCompany = {};
    for (const r of enriched) {
      if (!byCompany[r.company_name]) {
        byCompany[r.company_name] = {
          company_name: r.company_name,
          total: 0,
          safe_recommendation: 0,
          finance_required: 0,
          exception_candidate: 0,
        };
      }
      byCompany[r.company_name].total += 1;
      byCompany[r.company_name][r.final_status] =
        (byCompany[r.company_name][r.final_status] || 0) + 1;
    }

    const diag = await client.query(
      'SELECT public.get_single_core_ledger_systemwide_diagnostics() AS payload'
    );
    const diagPayload = diag.rows[0]?.payload ?? {};
    const branchRiskTotal =
      diagPayload.companies?.reduce((s, c) => s + (c.branch_attribution_risk || 0), 0) ?? null;

    return {
      run_at: runAt,
      clone_db: guard.cloneDb,
      staging_guard: 'UNIFIED_LEDGER_STAGING=1',
      diagnostics_branch_attribution_risk_total: branchRiskTotal,
      inventory_row_count: enriched.length,
      summary: {
        total_rows: enriched.length,
        by_company: Object.values(byCompany),
        safe_recommendation: enriched.filter((r) => r.final_status === 'safe_recommendation').length,
        finance_required: enriched.filter((r) => r.final_status === 'finance_required').length,
        exception_candidate: enriched.filter((r) => r.final_status === 'exception_candidate').length,
      },
      rows: enriched,
    };
  });

  if (envelope.diagnostics_branch_attribution_risk_total != null &&
      envelope.inventory_row_count !== envelope.diagnostics_branch_attribution_risk_total) {
    console.warn(
      `⚠️  Inventory count ${envelope.inventory_row_count} != diagnostics total ${envelope.diagnostics_branch_attribution_risk_total}`
    );
  }

  const { jsonPath, hash } = writeJsonReport('branch-manual-review-inventory', envelope);
  envelope.manifest = { sha256: hash, json_path: jsonPath };

  const docPath = path.join(repoRoot, 'docs/accounting/SINGLE_CORE_LEDGER_PHASE_1_6_1_BRANCH_MANUAL_REVIEW.md');
  fs.writeFileSync(docPath, renderMarkdown(envelope), 'utf8');

  console.log(`Rows: ${envelope.summary.total_rows}`);
  console.log(`JSON: ${jsonPath}`);
  console.log(`SHA256: ${hash}`);
  console.log(`Doc: ${docPath}`);
  console.log('\nInventory complete (read-only).');
}

main().catch((e) => fail(e.message));
