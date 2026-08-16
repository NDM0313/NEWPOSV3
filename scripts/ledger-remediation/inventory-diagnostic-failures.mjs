#!/usr/bin/env node
/**
 * Phase 1.6 Bundle 1 — diagnostic failure inventory (read-only, clone only).
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  initRemediationEnv,
  getConnectionString,
  withPgClient,
  readSqlFile,
  parseCompanyId,
  ensureReportsDir,
  timestampStamp,
  repoRoot,
  reportsDir,
} from './lib/pg-remediation-client.mjs';
import {
  loadEnvLocal,
  assertRemediationTarget,
  printMaskedTarget,
} from './remediation-env-guard.mjs';
import { classifyPaymentContactRow } from './lib/confidence-rules.mjs';
import { resolveBranchForJe } from './lib/branch-resolution.mjs';

const FIX_CLASS_MAP = {
  payments_missing_contact_sale_linked: { fix_class: 'payment_contact_backfill', severity: 'strict' },
  payments_wrong_party_attribution: { fix_class: 'payment_party_attribution_repair', severity: 'strict' },
  branch_attribution_risk: { fix_class: 'branch_attribution_review', severity: 'strict' },
  opening_balance_null_branch_je_count: { fix_class: 'opening_balance_branch_review', severity: 'info' },
};

function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function fail(msg, code = 1) {
  console.error(`❌ ${msg}`);
  process.exit(code);
}

async function fetchWrongPartyIds(client, companyId) {
  const sql = readSqlFile('inventory-wrong-party-payments.sql');
  const { rows } = await client.query(sql, [companyId]);
  return new Set(rows.map((r) => String(r.payment_id)));
}

async function fetchPaymentGaps(client, companyId, wrongPartyIds) {
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
}

async function fetchBranchRisk(client, companyId) {
  const sql = readSqlFile('inventory-branch-attribution-risk.sql');
  const { rows } = await client.query(sql, [companyId]);
  const out = [];
  for (const r of rows) {
    out.push(await resolveBranchForJe(client, r));
  }
  return out;
}

async function main() {
  console.log('========================================');
  console.log('PHASE 1.6 — DIAGNOSTIC FAILURE INVENTORY');
  console.log('========================================\n');

  loadEnvLocal(repoRoot);
  initRemediationEnv();

  let target;
  try {
    target = assertRemediationTarget({ inventoryOnly: true });
  } catch (e) {
    fail(e.message);
  }
  printMaskedTarget(target);

  const connectionString = getConnectionString();
  if (!connectionString) fail('DATABASE_URL required');

  const companyId = parseCompanyId();
  const runAt = new Date().toISOString();

  const envelope = await withPgClient(connectionString, async (client) => {
    const diagnostics = await (async () => {
      const { rows } = await client.query(
        'SELECT public.get_single_core_ledger_systemwide_diagnostics() AS payload'
      );
      return rows[0]?.payload ?? null;
    })();

    if (!diagnostics) fail('Diagnostics RPC returned no payload');

    const wrongPartyIds = await fetchWrongPartyIds(client, companyId);
    const paymentRows = await fetchPaymentGaps(client, companyId, wrongPartyIds);
    const branchRows = await fetchBranchRisk(client, companyId);

    const openingSql = readSqlFile('inventory-opening-balance-risk.sql');
    const { rows: openingRows } = await client.query(openingSql, [companyId]);

    const strictCompanies = (diagnostics.companies || []).filter((c) => !c.strict_pass);
    const inventorySummary = [];

    for (const c of strictCompanies) {
      for (const [field, meta] of Object.entries(FIX_CLASS_MAP)) {
        const count = Number(c[field]) || 0;
        if (count > 0 && meta.severity === 'strict') {
          let sample_refs = [];
          if (field === 'payments_missing_contact_sale_linked') {
            sample_refs = paymentRows
              .filter((r) => r.company_id === c.company_id)
              .slice(0, 10)
              .map((r) => r.payment_id);
          } else if (field === 'branch_attribution_risk') {
            sample_refs = branchRows
              .filter((r) => r.company_id === c.company_id)
              .slice(0, 10)
              .map((r) => r.entry_no || r.journal_entry_id);
          }
          inventorySummary.push({
            company_id: c.company_id,
            company_name: c.company_name,
            issue_type: field,
            issue_count: count,
            fix_class: meta.fix_class,
            sample_refs,
          });
        }
      }
    }

    const allRows = [...paymentRows, ...branchRows];
    const safe_apply = allRows.filter((r) => r.safe_apply).length;
    const manual_review = allRows.filter((r) => r.manual_review).length;

    return {
      run_at: runAt,
      staging_guard: 'UNIFIED_LEDGER_STAGING=1',
      clone_database: target.database,
      diagnostics_summary: diagnostics.summary,
      diagnostics_companies: diagnostics.companies,
      inventory_summary: inventorySummary,
      payment_contact_rows: paymentRows,
      branch_attribution_rows: branchRows,
      opening_balance_rows: openingRows,
      totals: {
        payment_contact_count: paymentRows.length,
        branch_attribution_count: branchRows.length,
        opening_balance_count: openingRows.length,
        safe_apply,
        manual_review,
      },
    };
  });

  ensureReportsDir();
  const stamp = timestampStamp(runAt);
  const jsonPath = path.join(reportsDir, `remediation-inventory-${stamp}.json`);
  const jsonText = JSON.stringify(envelope, null, 2);
  fs.writeFileSync(jsonPath, jsonText, 'utf8');
  const jsonSha = sha256(jsonText);

  console.log(`Inventory JSON: ${jsonPath}`);
  console.log(`SHA256: ${jsonSha}`);
  console.log(`Payment gaps: ${envelope.totals.payment_contact_count}`);
  console.log(`Branch risk: ${envelope.totals.branch_attribution_count}`);
  console.log(`safe_apply: ${envelope.totals.safe_apply}, manual_review: ${envelope.totals.manual_review}`);

  const diagPayment =
    (envelope.diagnostics_companies || []).reduce(
      (s, c) => s + (Number(c.payments_missing_contact_sale_linked) || 0),
      0
    );
  const diagBranch =
    (envelope.diagnostics_companies || []).reduce(
      (s, c) => s + (Number(c.branch_attribution_risk) || 0),
      0
    );

  if (
    envelope.totals.payment_contact_count !== diagPayment ||
    envelope.totals.branch_attribution_count !== diagBranch
  ) {
    console.warn(
      `⚠ Row-count drift: inventory payment=${envelope.totals.payment_contact_count} vs diag=${diagPayment}, branch=${envelope.totals.branch_attribution_count} vs diag=${diagBranch}`
    );
    process.exit(2);
  }
}

main().catch((e) => fail(e.message));
