#!/usr/bin/env node
/**
 * Phase 1.6 Bundle 3 — clone-only branch attribution apply.
 *
 * Usage:
 *   REMEDIATION_APPLY_CONFIRM=1 UNIFIED_LEDGER_STAGING=1 UNIFIED_LEDGER_VPS_CLONE=1 \
 *     node scripts/ledger-remediation/apply-branch-attribution-clone.mjs \
 *       --dry-run-file reports/single-core-ledger/remediation-dry-run-*.json \
 *       --expected-safe-count 4
 */
import {
  loadEnvLocal,
  assertRemediationTarget,
  printMaskedTarget,
  verifyDryRunFile,
} from './remediation-env-guard.mjs';
import {
  repoRoot,
  getConnectionString,
  parseArg,
  fail,
  withPgClient,
  writeJsonReport,
} from './lib/pg-remediation-client.mjs';

loadEnvLocal(repoRoot);

const dryRunFile = parseArg('--dry-run-file');
const expectedSafeCount = parseArg('--expected-safe-count');
const companyFilter = parseArg('--company-id');

async function snapshotJournalEntries(client, ids) {
  if (!ids.length) return [];
  const { rows } = await client.query(
    `SELECT id, company_id, entry_no, branch_id, reference_type, reference_id, is_void
     FROM journal_entries WHERE id = ANY($1::uuid[])`,
    [ids]
  );
  return rows;
}

async function main() {
  console.log('========================================');
  console.log('PHASE 1.6 — APPLY BRANCH ATTRIBUTION (CLONE)');
  console.log('========================================\n');

  let target;
  try {
    target = assertRemediationTarget({ requireApply: true });
  } catch (e) {
    fail(e.message);
  }
  printMaskedTarget(target);

  const cs = getConnectionString();
  if (!cs) fail('DATABASE_URL required');

  const { parsed, fileHash } = verifyDryRunFile(dryRunFile, undefined, { scope: 'branch_attribution' });

  let applyRows = (parsed.branch_attribution?.rows ?? []).filter((r) => r.safe_apply);
  if (!applyRows.length) {
    applyRows = (parsed.rows ?? []).filter(
      (r) => r.issue_type === 'branch_attribution_risk' && r.safe_apply
    );
  }
  if (companyFilter) {
    applyRows = applyRows.filter((r) => String(r.company_id) === companyFilter);
  }

  const branchExpected = expectedSafeCount != null ? Number(expectedSafeCount) : applyRows.length;

  if (expectedSafeCount != null && applyRows.length !== branchExpected) {
    fail(`Branch safe_apply rows in file (${applyRows.length}) != --expected-safe-count (${branchExpected})`);
  }

  const runAt = new Date().toISOString();
  const jeIds = applyRows.map((r) => r.journal_entry_id);

  const beforeRows = await withPgClient(cs, (c) => snapshotJournalEntries(c, jeIds));

  let applied = 0;
  const auditEntries = [];
  const errors = [];

  await withPgClient(cs, async (client) => {
    await client.query('BEGIN');
    try {
      for (const row of applyRows) {
        const { rows: upd } = await client.query(
          `UPDATE journal_entries SET branch_id = $1::uuid
           WHERE id = $2::uuid AND branch_id IS NULL AND COALESCE(is_void, FALSE) = FALSE
           RETURNING id, company_id, branch_id, entry_no`,
          [row.proposed_branch_id, row.journal_entry_id]
        );
        if (!upd.length) continue;

        applied++;
        await client.query(
          `INSERT INTO party_repair_audit
             (company_id, table_name, row_id, column_name, old_value, new_value, reason_code, metadata)
           VALUES ($1::uuid, 'journal_entries', $2::uuid, 'branch_id', $3, $4, 'BRANCH_ATTRIBUTION_METADATA', $5::jsonb)`,
          [
            row.company_id,
            row.journal_entry_id,
            '',
            String(row.proposed_branch_id),
            JSON.stringify({
              repair_type: 'branch_attribution_metadata',
              entry_no: row.entry_no,
              reference_type: row.reference_type,
              reference_id: row.reference_id,
              dry_run_sha256: fileHash,
            }),
          ]
        );
        auditEntries.push({
          journal_entry_id: row.journal_entry_id,
          entry_no: row.entry_no,
          company_id: row.company_id,
          old_branch_id: null,
          new_branch_id: row.proposed_branch_id,
        });
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    }
  });

  const afterRows = await withPgClient(cs, (c) => snapshotJournalEntries(c, jeIds));

  if (applied !== applyRows.length) {
    errors.push(`Applied ${applied} but expected ${applyRows.length} branch updates`);
  }

  const beforeReport = writeJsonReport('remediation-apply-before-branch', {
    run_at: runAt,
    scope: 'branch_attribution',
    rows: beforeRows,
    dry_run_file: dryRunFile,
    dry_run_sha256: fileHash,
  });

  const afterReport = writeJsonReport('remediation-apply-after-branch', {
    run_at: new Date().toISOString(),
    scope: 'branch_attribution',
    rows: afterRows,
    applied_count: applied,
  });

  const auditReport = writeJsonReport('remediation-apply-audit-branch', {
    run_at: new Date().toISOString(),
    scope: 'branch_attribution',
    dry_run_file: dryRunFile,
    dry_run_sha256: fileHash,
    expected_safe_count: branchExpected,
    applied_count: applied,
    audit_entries: auditEntries,
    errors,
  });

  console.log(`Applied: ${applied} branch attribution updates`);
  console.log(`Before: ${beforeReport.jsonPath}`);
  console.log(`After:  ${afterReport.jsonPath}`);
  console.log(`Audit:  ${auditReport.jsonPath}`);

  if (errors.length) fail(errors.join('; '));
}

main().catch((e) => fail(e.message));
