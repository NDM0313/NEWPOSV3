#!/usr/bin/env node
/**
 * Phase 1.6 Bundle 2A — payment contact backfill dry-run (read-only).
 */
import {
  initRemediationEnv,
  getConnectionString,
  withPgClient,
  readSqlFile,
  parseCompanyId,
} from './lib/pg-remediation-client.mjs';
import { loadEnvLocal, assertRemediationTarget, printMaskedTarget } from './remediation-env-guard.mjs';
import { repoRoot } from './lib/pg-remediation-client.mjs';
import { classifyPaymentContactRow } from './lib/confidence-rules.mjs';

loadEnvLocal(repoRoot);
initRemediationEnv();

function fail(msg) {
  console.error(`❌ ${msg}`);
  process.exit(1);
}

export async function runPaymentContactDryRun(connectionString, companyId = null) {
  return withPgClient(connectionString, async (client) => {
    const wrongSql = readSqlFile('inventory-wrong-party-payments.sql');
    const { rows: wrongRows } = await client.query(wrongSql, [companyId]);
    const wrongPartyIds = new Set(wrongRows.map((r) => String(r.payment_id)));

    const sql = readSqlFile('inventory-payment-contact-gaps.sql');
    const { rows } = await client.query(sql, [companyId]);

    return rows.map((r) =>
      classifyPaymentContactRow(
        {
          issue_type: 'payments_missing_contact_sale_linked',
          payment_id: r.payment_id,
          reference_number: r.reference_number,
          sale_id: r.sale_id,
          invoice_no: r.invoice_no,
          old_contact_id: r.old_contact_id,
          proposed_contact_id: r.proposed_contact_id,
          proposed_contact_code: r.proposed_contact_code,
          proposed_contact_name: r.proposed_contact_name,
          company_id: r.company_id,
          company_name: r.company_name,
          branch_id: r.branch_id,
          allocation_customer_conflict: Boolean(r.allocation_customer_conflict),
          sale_voided_or_cancelled: Boolean(r.sale_cancelled_at),
          contact_id_already_set: false,
          reason: 'sale_customer_id_match',
        },
        wrongPartyIds
      )
    );
  });
}

async function main() {
  let target;
  try {
    target = assertRemediationTarget({ inventoryOnly: true });
  } catch (e) {
    fail(e.message);
  }
  printMaskedTarget(target);

  const cs = getConnectionString();
  if (!cs) fail('DATABASE_URL required');

  const rows = await runPaymentContactDryRun(cs, parseCompanyId());
  const safe = rows.filter((r) => r.safe_apply).length;
  console.log(`Payment contact dry-run: ${rows.length} rows, safe_apply=${safe}`);
  console.log(JSON.stringify({ rows, summary: { total: rows.length, safe_apply: safe } }, null, 2));
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}`) {
  main().catch((e) => fail(e.message));
}
