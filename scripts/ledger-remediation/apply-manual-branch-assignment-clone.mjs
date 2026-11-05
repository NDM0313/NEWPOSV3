#!/usr/bin/env node
/**
 * Phase 1.6.1 Bundle 3 — clone-only operator-approved branch assignment apply.
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
  fail,
} from './lib/pg-remediation-client.mjs';
import {
  loadEnvLocal,
  assertManualBranchManifest,
  printMaskedTarget,
} from './remediation-env-guard.mjs';
import { countApprovedRows } from './lib/manifest-schema.mjs';

loadEnvLocal(repoRoot);
initRemediationEnv();

async function fetchCurrentRiskIds(client) {
  const { rows } = await client.query(
    `SELECT journal_entry_id, company_id FROM v_single_core_ledger_branch_attribution_risk`
  );
  return new Map(rows.map((r) => [String(r.journal_entry_id), String(r.company_id)]));
}

async function main() {
  console.log('========================================');
  console.log('PHASE 1.6.1 — APPLY MANUAL BRANCH ASSIGNMENT (CLONE)');
  console.log('========================================\n');

  let guard;
  try {
    guard = assertManualBranchManifest({ requireApply: true });
  } catch (e) {
    fail(e.message);
  }
  printMaskedTarget(guard);

  const cs = getConnectionString();
  if (!cs) fail('DATABASE_URL required');

  const approvedRows = guard.approvedRows;
  const runAt = new Date().toISOString();
  const stamp = timestampStamp(runAt);
  ensureReportsDir();

  const beforePath = path.join(reportsDir, `branch-manual-apply-before-${stamp}.json`);
  const afterPath = path.join(reportsDir, `branch-manual-apply-after-${stamp}.json`);
  const auditPath = path.join(reportsDir, `branch-manual-apply-audit-${stamp}.json`);

  const result = await withPgClient(cs, async (client) => {
    const riskMap = await fetchCurrentRiskIds(client);
    const before = { run_at: runAt, rows: [] };
    const after = { run_at: runAt, rows: [] };
    const audit = {
      run_at: runAt,
      clone_db: guard.cloneDb,
      manifest_path: guard.manifestPath,
      manifest_sha256: guard.manifestHash,
      updates: [],
      skipped: [],
    };

    await client.query('BEGIN');
    try {
      for (const row of approvedRows) {
        const jeId = String(row.journal_entry_id);
        const companyId = String(row.company_id);
        const approvedBranchId = String(row.approved_branch_id);

        if (!riskMap.has(jeId)) {
          audit.skipped.push({ journal_entry_id: jeId, reason: 'not_in_current_diagnostic_risk_list' });
          continue;
        }
        if (riskMap.get(jeId) !== companyId) {
          audit.skipped.push({ journal_entry_id: jeId, reason: 'company_id_mismatch' });
          continue;
        }

        const decision = String(row.operator_decision || '').trim().toLowerCase();
        if (decision !== 'approve') {
          audit.skipped.push({ journal_entry_id: jeId, reason: `operator_decision_${decision || 'empty'}` });
          continue;
        }

        const { rows: branchCheck } = await client.query(
          `SELECT id FROM branches WHERE id = $1 AND company_id = $2`,
          [approvedBranchId, companyId]
        );
        if (!branchCheck.length) {
          audit.skipped.push({ journal_entry_id: jeId, reason: 'approved_branch_not_in_company' });
          continue;
        }

        const { rows: snap } = await client.query(
          `SELECT id, branch_id, entry_no, company_id, reference_type, is_void
           FROM journal_entries WHERE id = $1`,
          [jeId]
        );
        const prev = snap[0];
        if (!prev) {
          audit.skipped.push({ journal_entry_id: jeId, reason: 'je_not_found' });
          continue;
        }
        if (prev.branch_id != null) {
          audit.skipped.push({ journal_entry_id: jeId, reason: 'branch_id_already_set' });
          continue;
        }
        if (prev.is_void) {
          audit.skipped.push({ journal_entry_id: jeId, reason: 'je_is_void' });
          continue;
        }

        before.rows.push(prev);

        const { rowCount } = await client.query(
          `UPDATE journal_entries SET branch_id = $1
           WHERE id = $2 AND company_id = $3 AND branch_id IS NULL AND COALESCE(is_void, FALSE) = FALSE`,
          [approvedBranchId, jeId, companyId]
        );

        if (rowCount !== 1) {
          throw new Error(`Expected 1 update for JE ${jeId}, got ${rowCount}`);
        }

        audit.updates.push({
          journal_entry_id: jeId,
          entry_no: prev.entry_no,
          company_id: companyId,
          approved_branch_id: approvedBranchId,
          operator_note: row.operator_note || '',
        });

        await client.query('SAVEPOINT branch_audit');
        try {
          await client.query(
            `INSERT INTO party_repair_audit (
              company_id, repair_type, entity_type, entity_id,
              before_state, after_state, reason_code, created_at
            ) VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, now())`,
            [
              companyId,
              'branch_manual_assignment_metadata',
              'journal_entry',
              jeId,
              JSON.stringify({ branch_id: null }),
              JSON.stringify({ branch_id: approvedBranchId }),
              'phase_161_manual_branch',
            ]
          );
        } catch {
          await client.query('ROLLBACK TO SAVEPOINT branch_audit');
        }
      }

      if (audit.updates.length !== guard.expectedCount) {
        throw new Error(`Updated ${audit.updates.length} rows but expected ${guard.expectedCount}`);
      }

      await client.query('COMMIT');

      for (const u of audit.updates) {
        const { rows: post } = await client.query(
          `SELECT id, branch_id, entry_no, company_id FROM journal_entries WHERE id = $1`,
          [u.journal_entry_id]
        );
        after.rows.push(post[0]);
      }

      return { before, after, audit };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    }
  });

  fs.writeFileSync(beforePath, JSON.stringify(result.before, null, 2), 'utf8');
  fs.writeFileSync(afterPath, JSON.stringify(result.after, null, 2), 'utf8');
  fs.writeFileSync(auditPath, JSON.stringify(result.audit, null, 2), 'utf8');

  console.log(`Updated: ${result.audit.updates.length}`);
  console.log(`Skipped: ${result.audit.skipped.length}`);
  console.log(`Before: ${beforePath}`);
  console.log(`After: ${afterPath}`);
  console.log(`Audit: ${auditPath}`);
}

main().catch((e) => fail(e.message));
