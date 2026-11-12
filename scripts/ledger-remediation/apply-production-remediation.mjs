#!/usr/bin/env node
/**
 * Phase 1.6.2 — production metadata remediation apply (NOT for clone).
 * Requires PRODUCTION_REMEDIATION_APPROVED=1, PRODUCTION_BACKUP_ID, approval manifest.
 * DO NOT RUN without explicit finance approval.
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
} from './remediation-env-guard.mjs';
import {
  assertProductionRemediationTarget,
  printMaskedProductionTarget,
  parseProductionArgs,
} from './production-remediation-env-guard.mjs';

loadEnvLocal(repoRoot);
initRemediationEnv();

async function main() {
  console.log('========================================');
  console.log('PRODUCTION REMEDIATION — METADATA APPLY');
  console.log('========================================\n');

  let guard;
  try {
    guard = assertProductionRemediationTarget({ requireApply: true });
  } catch (e) {
    fail(e.message);
  }
  printMaskedProductionTarget(guard);

  const cs = getConnectionString();
  if (!cs) fail('DATABASE_URL required');

  const runAt = new Date().toISOString();
  const stamp = timestampStamp(runAt);
  ensureReportsDir();

  const beforePath = path.join(reportsDir, `production-remediation-apply-before-${stamp}.json`);
  const afterPath = path.join(reportsDir, `production-remediation-apply-after-${stamp}.json`);
  const auditPath = path.join(reportsDir, `production-remediation-apply-audit-${stamp}.json`);

  const before = { run_at: runAt, backup_id: guard.backupId, rows: [] };
  const audit = {
    run_at: runAt,
    manifest_path: guard.manifestPath,
    manifest_sha256: guard.manifestHash,
    backup_id: guard.backupId,
    updates: [],
    skipped: [],
  };

  const result = await withPgClient(cs, async (client) => {
    await client.query('BEGIN');
    try {
      for (const row of guard.applyRows) {
        if (row.entity_type === 'payment' && row.repair_type === 'payment_contact_backfill') {
          const { rows: snap } = await client.query(
            `SELECT id, contact_id, company_id, voided_at FROM payments WHERE id = $1`,
            [row.entity_id]
          );
          const prev = snap[0];
          if (!prev) {
            audit.skipped.push({ entity_id: row.entity_id, reason: 'payment_not_found' });
            continue;
          }
          if (prev.contact_id != null) {
            audit.skipped.push({ entity_id: row.entity_id, reason: 'contact_id_already_set' });
            continue;
          }
          if (prev.voided_at) {
            audit.skipped.push({ entity_id: row.entity_id, reason: 'payment_voided' });
            continue;
          }
          before.rows.push({ ...prev, repair_type: row.repair_type });

          const { rowCount } = await client.query(
            `UPDATE payments SET contact_id = $1
             WHERE id = $2 AND contact_id IS NULL AND voided_at IS NULL`,
            [row.proposed_after_value, row.entity_id]
          );
          if (rowCount !== 1) throw new Error(`Expected 1 payment update for ${row.entity_id}, got ${rowCount}`);
          audit.updates.push({ ...row, table: 'payments' });
        } else if (row.entity_type === 'journal_entry') {
          const { rows: snap } = await client.query(
            `SELECT id, branch_id, company_id, COALESCE(is_void, false) AS is_void FROM journal_entries WHERE id = $1`,
            [row.entity_id]
          );
          const prev = snap[0];
          if (!prev) {
            audit.skipped.push({ entity_id: row.entity_id, reason: 'je_not_found' });
            continue;
          }
          if (prev.branch_id != null) {
            audit.skipped.push({ entity_id: row.entity_id, reason: 'branch_id_already_set' });
            continue;
          }
          if (prev.is_void) {
            audit.skipped.push({ entity_id: row.entity_id, reason: 'je_void' });
            continue;
          }
          before.rows.push({ ...prev, repair_type: row.repair_type });

          const { rowCount } = await client.query(
            `UPDATE journal_entries SET branch_id = $1
             WHERE id = $2 AND branch_id IS NULL AND COALESCE(is_void, FALSE) = FALSE`,
            [row.proposed_after_value, row.entity_id]
          );
          if (rowCount !== 1) throw new Error(`Expected 1 JE update for ${row.entity_id}, got ${rowCount}`);
          audit.updates.push({ ...row, table: 'journal_entries' });
        } else {
          audit.skipped.push({ entity_id: row.entity_id, reason: 'unknown_entity_type' });
        }
      }

      if (audit.updates.length !== guard.expectedCount) {
        throw new Error(`Updated ${audit.updates.length} rows but expected ${guard.expectedCount}`);
      }

      await client.query('COMMIT');
      return audit;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    }
  });

  const after = { run_at: runAt, rows: [] };
  await withPgClient(cs, async (client) => {
    for (const u of result.updates) {
      if (u.table === 'payments') {
        const { rows } = await client.query(`SELECT id, contact_id, company_id FROM payments WHERE id = $1`, [
          u.entity_id,
        ]);
        after.rows.push(rows[0]);
      } else {
        const { rows } = await client.query(`SELECT id, branch_id, company_id FROM journal_entries WHERE id = $1`, [
          u.entity_id,
        ]);
        after.rows.push(rows[0]);
      }
    }
  });

  fs.writeFileSync(beforePath, JSON.stringify(before, null, 2), 'utf8');
  fs.writeFileSync(afterPath, JSON.stringify(after, null, 2), 'utf8');
  fs.writeFileSync(auditPath, JSON.stringify(result, null, 2), 'utf8');

  console.log(`Updated: ${result.updates.length}`);
  console.log(`Before: ${beforePath}`);
  console.log(`After: ${afterPath}`);
  console.log(`Audit: ${auditPath}`);
}

main().catch((e) => fail(e.message));
