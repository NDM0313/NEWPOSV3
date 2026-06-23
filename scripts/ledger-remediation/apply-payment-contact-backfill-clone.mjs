#!/usr/bin/env node
/**
 * Phase 1.6 Bundle 3 — clone-only payment contact backfill apply.
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
  sha256File,
} from './remediation-env-guard.mjs';

loadEnvLocal(repoRoot);
initRemediationEnv();

function fail(msg, code = 1) {
  console.error(`❌ ${msg}`);
  process.exit(code);
}

async function main() {
  console.log('========================================');
  console.log('PHASE 1.6 — APPLY PAYMENT CONTACT (CLONE)');
  console.log('========================================\n');

  const { dryRunFile, expectedSafeCount } = parseRemediationArgs();
  let guard;
  try {
    guard = assertRemediationTarget({
      requireApply: true,
      dryRunFile,
      expectedSafeCount,
    });
  } catch (e) {
    fail(e.message);
  }
  printMaskedTarget(guard);

  const cs = getConnectionString();
  if (!cs) fail('DATABASE_URL required');

  const manifest = guard.manifest;
  const paymentRows = (manifest.sections?.payment_contact?.rows || manifest.rows || []).filter(
    (r) => r.issue_type === 'payments_missing_contact_sale_linked' && r.safe_apply
  );

  if (!paymentRows.length) {
    fail('No safe_apply payment contact rows in dry-run file');
  }

  const runAt = new Date().toISOString();
  const before = { run_at: runAt, rows: [] };
  const audit = { updates: [], skipped: [] };

  const updated = await withPgClient(cs, async (client) => {
    await client.query('BEGIN');
    try {
      for (const row of paymentRows) {
        const { rows: snap } = await client.query(
          `SELECT id, contact_id, reference_number, company_id FROM payments WHERE id = $1`,
          [row.payment_id]
        );
        const prev = snap[0];
        if (!prev) {
          audit.skipped.push({ payment_id: row.payment_id, reason: 'not_found' });
          continue;
        }
        before.rows.push(prev);

        const { rowCount } = await client.query(
          `UPDATE payments SET contact_id = $1
           WHERE id = $2 AND contact_id IS NULL AND voided_at IS NULL`,
          [row.proposed_contact_id, row.payment_id]
        );

        if (rowCount === 1) {
          await client.query(
            `INSERT INTO party_repair_audit (company_id, table_name, row_id, column_name, old_value, new_value, reason_code, metadata)
             VALUES ($1, 'payments', $2, 'contact_id', NULL, $3, 'payment_contact_backfill', $4::jsonb)`,
            [
              row.company_id,
              row.payment_id,
              String(row.proposed_contact_id),
              JSON.stringify({
                phase: '1.6',
                dry_run_sha256: guard.fileHash,
                reference_number: row.reference_number,
                sale_id: row.sale_id,
              }),
            ]
          );
          audit.updates.push({
            payment_id: row.payment_id,
            proposed_contact_id: row.proposed_contact_id,
          });
        } else {
          audit.skipped.push({ payment_id: row.payment_id, reason: 'predicate_no_match' });
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
    fail(`Updated ${updated} rows, expected ${expectedSafeCount}`);
  }

  const after = await withPgClient(cs, async (client) => {
    const ids = paymentRows.map((r) => r.payment_id);
    const { rows } = await client.query(
      `SELECT id, contact_id, reference_number, company_id FROM payments WHERE id = ANY($1::uuid[])`,
      [ids]
    );
    return { run_at: new Date().toISOString(), rows };
  });

  ensureReportsDir();
  const stamp = timestampStamp(runAt);
  const beforePath = path.join(reportsDir, `remediation-apply-before-payment-${stamp}.json`);
  const afterPath = path.join(reportsDir, `remediation-apply-after-payment-${stamp}.json`);
  const auditPath = path.join(reportsDir, `remediation-apply-audit-${stamp}.json`);

  const auditEnvelope = {
    run_at: runAt,
    repair_type: 'payment_contact_backfill',
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

  console.log(`Updated: ${updated} payments`);
  console.log(`Audit: ${auditPath}`);
}

main().catch((e) => fail(e.message));
