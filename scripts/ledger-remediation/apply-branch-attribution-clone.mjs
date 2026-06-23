#!/usr/bin/env node
/**
 * Phase 1.6 Bundle 3 — clone-only journal_entries.branch_id apply (safe_apply only).
 */
import fs from 'fs';
import path from 'path';
import {
  initRemediationEnv,
  getConnectionString,
  withPgClient,
  ensureReportsDir,
  timestampStamp,
  repoRoot,
  reportsDir,
} from './lib/pg-remediation-client.mjs';
import {
  loadEnvLocal,
  assertRemediationTarget,
  printMaskedTarget,
  parseRemediationArgs,
} from './remediation-env-guard.mjs';

loadEnvLocal(repoRoot);
initRemediationEnv();

function fail(msg, code = 1) {
  console.error(`❌ ${msg}`);
  process.exit(code);
}

async function main() {
  console.log('========================================');
  console.log('PHASE 1.6 — APPLY BRANCH ATTRIBUTION (CLONE)');
  console.log('========================================\n');

  const { dryRunFile, expectedSafeCount } = parseRemediationArgs();
  let guard;
  try {
    guard = assertRemediationTarget({
      requireApply: true,
      dryRunFile,
      expectedSafeCount: expectedSafeCount ?? undefined,
    });
  } catch (e) {
    fail(e.message);
  }
  printMaskedTarget(guard);

  const cs = getConnectionString();
  if (!cs) fail('DATABASE_URL required');

  const manifest = guard.manifest;
  const branchRows = (manifest.sections?.branch_attribution?.rows || manifest.rows || []).filter(
    (r) => r.issue_type === 'branch_attribution_risk' && r.safe_apply
  );

  const runAt = new Date().toISOString();
  const before = { run_at: runAt, rows: [] };
  const audit = { updates: [], skipped: [] };

  const updated = await withPgClient(cs, async (client) => {
    await client.query('BEGIN');
    try {
      for (const row of branchRows) {
        const { rows: snap } = await client.query(
          `SELECT id, branch_id, entry_no, company_id, reference_type FROM journal_entries WHERE id = $1`,
          [row.journal_entry_id]
        );
        const prev = snap[0];
        if (!prev) {
          audit.skipped.push({ journal_entry_id: row.journal_entry_id, reason: 'not_found' });
          continue;
        }
        before.rows.push(prev);

        const { rowCount } = await client.query(
          `UPDATE journal_entries SET branch_id = $1
           WHERE id = $2 AND branch_id IS NULL AND COALESCE(is_void, FALSE) = FALSE`,
          [row.proposed_branch_id, row.journal_entry_id]
        );

        if (rowCount === 1) {
          await client.query(
            `INSERT INTO party_repair_audit (company_id, table_name, row_id, column_name, old_value, new_value, reason_code, metadata)
             VALUES ($1, 'journal_entries', $2, 'branch_id', NULL, $3, 'branch_attribution_metadata', $4::jsonb)`,
            [
              row.company_id,
              row.journal_entry_id,
              String(row.proposed_branch_id),
              JSON.stringify({
                phase: '1.6',
                dry_run_sha256: guard.fileHash,
                entry_no: row.entry_no,
                reference_type: row.reference_type,
              }),
            ]
          );
          audit.updates.push({
            journal_entry_id: row.journal_entry_id,
            proposed_branch_id: row.proposed_branch_id,
          });
        } else {
          audit.skipped.push({ journal_entry_id: row.journal_entry_id, reason: 'predicate_no_match' });
        }
      }
      await client.query('COMMIT');
      return audit.updates.length;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    }
  });

  if (expectedSafeCount != null && updated !== expectedSafeCount) {
    fail(`Updated ${updated} JEs, expected ${expectedSafeCount}`);
  }

  const after = await withPgClient(cs, async (client) => {
    const ids = branchRows.map((r) => r.journal_entry_id);
    if (!ids.length) return { run_at: new Date().toISOString(), rows: [] };
    const { rows } = await client.query(
      `SELECT id, branch_id, entry_no, company_id FROM journal_entries WHERE id = ANY($1::uuid[])`,
      [ids]
    );
    return { run_at: new Date().toISOString(), rows };
  });

  ensureReportsDir();
  const stamp = timestampStamp(runAt);
  const beforePath = path.join(reportsDir, `remediation-apply-before-branch-${stamp}.json`);
  const afterPath = path.join(reportsDir, `remediation-apply-after-branch-${stamp}.json`);
  const auditPath = path.join(reportsDir, `remediation-apply-audit-branch-${stamp}.json`);

  const auditEnvelope = {
    run_at: runAt,
    repair_type: 'branch_attribution_metadata',
    dry_run_file: dryRunFile,
    dry_run_sha256: guard.fileHash,
    updated_count: updated,
    expected_safe_count: expectedSafeCount,
    before_path: beforePath,
    after_path: afterPath,
    audit,
  };

  fs.writeFileSync(beforePath, JSON.stringify(before, null, 2), 'utf8');
  fs.writeFileSync(afterPath, JSON.stringify(after, null, 2), 'utf8');
  fs.writeFileSync(auditPath, JSON.stringify(auditEnvelope, null, 2), 'utf8');

  console.log(`Updated: ${updated} journal entries`);
  console.log(`Audit: ${auditPath}`);
}

main().catch((e) => fail(e.message));
