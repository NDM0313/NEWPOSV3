#!/usr/bin/env node
/**
 * Single Core Ledger — systemwide diagnostics runner (staging/clone only).
 *
 * Requires:
 *   UNIFIED_LEDGER_STAGING=1
 *   DATABASE_URL or DATABASE_POOLER_URL or DATABASE_ADMIN_URL (or Supabase service role)
 *
 * Usage:
 *   UNIFIED_LEDGER_STAGING=1 node scripts/run-single-core-ledger-diagnostics.mjs
 *   UNIFIED_LEDGER_STAGING=1 node scripts/run-single-core-ledger-diagnostics.mjs --write-report
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';

import {
  loadEnvLocal,
  assertStagingTarget,
  printMaskedTarget,
  pgClientOptions,
} from './single-core-ledger/staging-env-guard.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const reportsDir = path.join(root, 'reports', 'single-core-ledger');
const pilotPath = path.join(root, 'scripts', 'single-core-ledger', 'pilot-companies.json');
const diagnosticReportPath = path.join(
  root,
  'docs',
  'accounting',
  'SINGLE_CORE_LEDGER_DIAGNOSTIC_REPORT.md'
);

function loadEnvLocalWrapper() {
  loadEnvLocal(root);
}

loadEnvLocalWrapper();

const writeReport = process.argv.includes('--write-report');

function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function fail(msg, code = 1) {
  console.error(`❌ ${msg}`);
  process.exit(code);
}

async function runViaPg(connectionString) {
  const client = new pg.Client(pgClientOptions(connectionString));
  await client.connect();
  try {
    const { rows } = await client.query(
      'SELECT public.get_single_core_ledger_systemwide_diagnostics() AS payload'
    );
    return rows[0]?.payload ?? null;
  } finally {
    await client.end();
  }
}

async function runViaSupabase(url, key) {
  const supabase = createClient(url, key);
  const { data, error } = await supabase.rpc('get_single_core_ledger_systemwide_diagnostics');
  if (error) throw new Error(error.message);
  return data;
}

const FIX_CLASS_MAP = {
  payments_missing_contact_sale_linked: { fix_class: 'payment_contact_backfill', severity: 'strict' },
  payments_wrong_party_attribution: { fix_class: 'payment_party_attribution_repair', severity: 'strict' },
  branch_attribution_risk: { fix_class: 'branch_attribution_review', severity: 'strict' },
  unposted_final_sales: { fix_class: 'post_sale_gl', severity: 'warning' },
  unposted_final_purchases: { fix_class: 'post_purchase_gl', severity: 'warning' },
  unposted_rentals: { fix_class: 'post_rental_gl', severity: 'warning' },
  correction_reversal_je_count: { fix_class: 'informational_correction_reversal', severity: 'info' },
  opening_balance_null_branch_je_count: { fix_class: 'opening_balance_branch_review', severity: 'info' },
};

function enrichCompanyDiagnostics(company) {
  const issues = [];
  for (const [field, meta] of Object.entries(FIX_CLASS_MAP)) {
    const count = Number(company[field]) || 0;
    if (count > 0) {
      issues.push({ field, count, fix_class: meta.fix_class, severity: meta.severity });
    }
  }
  return { ...company, issues };
}

async function fetchBranchRiskRows(connectionString, pilotCompanyId, limit = 50) {
  if (!connectionString || !pilotCompanyId) return [];
  const client = new pg.Client(pgClientOptions(connectionString));
  await client.connect();
  try {
    const { rows } = await client.query(
      `SELECT journal_entry_id, entry_no, entry_date, reference_type, branch_id, description
       FROM v_single_core_ledger_branch_attribution_risk
       WHERE company_id = $1
       ORDER BY entry_date DESC NULLS LAST
       LIMIT $2`,
      [pilotCompanyId, limit]
    );
    return rows.map((r) => ({ ...r, fix_class: 'branch_attribution_review' }));
  } catch {
    return [];
  } finally {
    await client.end();
  }
}

function pilotSection(payload, pilots, branchRiskRows) {
  const companies = (payload?.companies ?? []).map(enrichCompanyDiagnostics);
  const byId = new Map(companies.map((c) => [c.company_id, c]));
  return pilots.map((p) => ({
    label: p.label,
    company_id: p.company_id,
    diagnostics: byId.get(p.company_id) ?? { error: 'company not in diagnostics output' },
    branch_attribution_risk_rows:
      p.company_id === pilots[0]?.company_id ? branchRiskRows : [],
  }));
}

function buildMarkdownReport(meta) {
  const { runAt, companiesCount, jsonPath, jsonSha, payload, pilotResults, status } = meta;
  const summary = payload?.summary ?? {};
  const lines = [
    '# Single Core Ledger — Systemwide Diagnostic Report',
    '',
    `> Generated from staging/clone run. **Do not treat as production sign-off without applied migrations.**`,
    '',
    '## Run metadata',
    '',
    `| Field | Value |`,
    `|-------|-------|`,
    `| Run timestamp (UTC) | ${runAt} |`,
    `| companies_count | ${companiesCount} |`,
    `| JSON output path | \`${jsonPath}\` |`,
    `| JSON SHA256 | \`${jsonSha}\` |`,
    `| Overall status | **${status}** |`,
    '',
    '## Pass / fail summary',
    '',
    `- strict_pass_count: ${summary.strict_pass_count ?? 'n/a'}`,
    `- strict_fail_count: ${summary.strict_fail_count ?? 'n/a'}`,
    `- branch_attribution_risk_total: ${summary.branch_attribution_risk_total ?? 'n/a'}`,
    `- warnings_unposted_sales: ${summary.warnings_unposted_sales ?? 'n/a'}`,
    `- warnings_unposted_purchases: ${summary.warnings_unposted_purchases ?? 'n/a'}`,
    '',
    '## DIN CHINA pilot section',
    '',
  ];

  for (const p of pilotResults) {
    lines.push(`### ${p.label} (\`${p.company_id}\`)`);
    lines.push('');
    lines.push('**Per-company metrics + fix_class:**');
    lines.push('');
    lines.push('```json');
    lines.push(JSON.stringify(p.diagnostics, null, 2));
    lines.push('```');
    lines.push('');
    if (p.branch_attribution_risk_rows?.length) {
      lines.push('**branch_attribution_risk sample rows:**');
      lines.push('');
      lines.push('```json');
      lines.push(JSON.stringify(p.branch_attribution_risk_rows, null, 2));
      lines.push('```');
      lines.push('');
    }
  }

  lines.push('## Per-company diagnostics (all companies)');
  lines.push('');
  const allCos = (payload?.companies ?? []).map(enrichCompanyDiagnostics);
  for (const c of allCos.slice(0, 40)) {
    lines.push(`- **${c.company_name}**: strict_pass=${c.strict_pass}, issues=${JSON.stringify(c.issues ?? [])}`);
  }
  if (allCos.length > 40) lines.push(`- … ${allCos.length - 40} more companies in JSON`);

  const failed = allCos.filter((c) => !c.strict_pass);
  lines.push('## Unresolved differences (strict fail companies)');
  lines.push('');
  if (!failed.length) {
    lines.push('_None — all companies passed strict gate._');
  } else {
    for (const c of failed.slice(0, 25)) {
      lines.push(
        `- **${c.company_name}** (\`${c.company_id}\`): branch_risk=${c.branch_attribution_risk}, missing_contact=${c.payments_missing_contact_sale_linked}, wrong_party=${c.payments_wrong_party_attribution}`
      );
    }
    if (failed.length > 25) lines.push(`- … and ${failed.length - 25} more`);
  }

  lines.push('');
  return lines.join('\n');
}

async function main() {
  console.log('========================================');
  console.log('SINGLE CORE LEDGER — SYSTEMWIDE DIAGNOSTICS');
  console.log('========================================\n');

  let target;
  try {
    target = assertStagingTarget();
  } catch (e) {
    fail(e.message);
  }
  printMaskedTarget(target);

  const connectionString =
    process.env.DATABASE_ADMIN_URL ||
    process.env.DATABASE_URL ||
    process.env.DATABASE_POOLER_URL;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

  let payload;
  let runMode;
  let pgError;

  if (connectionString) {
    runMode = 'pg';
    try {
      payload = await runViaPg(connectionString);
    } catch (e) {
      pgError = e.message;
      console.warn(`PG diagnostics failed (${pgError}); trying Supabase RPC…`);
    }
  }

  if (!payload && supabaseUrl && supabaseKey) {
    runMode = 'supabase';
    try {
      payload = await runViaSupabase(supabaseUrl, supabaseKey);
    } catch (e) {
      if (pgError) {
        fail(`PG: ${pgError}; Supabase: ${e.message}. Apply migrations 20260621120000+ on staging.`);
      }
      fail(`Supabase RPC failed: ${e.message}. Apply migrations 20260621120000+ on staging.`);
    }
  } else if (!payload) {
    const runAt = new Date().toISOString();
    const blocked = {
      run_at: runAt,
      status: 'BLOCKED',
      reason: pgError
        ? `PG failed: ${pgError}; Supabase credentials missing or RPC unavailable`
        : 'No DATABASE_URL or SUPABASE_SERVICE_ROLE_KEY configured for staging',
      companies_count: 0,
      summary: { strict_pass_count: 0, strict_fail_count: 0, branch_attribution_risk_total: 0 },
      companies: [],
    };
    fs.mkdirSync(reportsDir, { recursive: true });
    const jsonPath = path.join(reportsDir, `diagnostics-blocked-${runAt.replace(/[:.]/g, '-')}.json`);
    const jsonText = JSON.stringify(blocked, null, 2);
    fs.writeFileSync(jsonPath, jsonText, 'utf8');
    console.log(`Blocked run recorded: ${jsonPath}`);
    console.log(`SHA256: ${sha256(jsonText)}`);
    if (writeReport) {
      fs.writeFileSync(
        diagnosticReportPath,
        buildMarkdownReport({
          runAt,
          companiesCount: 0,
          jsonPath,
          jsonSha: sha256(jsonText),
          payload: blocked,
          pilotResults: [],
          status: 'BLOCKED',
        }),
        'utf8'
      );
    }
    fail('Staging diagnostics blocked — apply Phase 1.5 migrations and configure staging .env.local.');
  }

  const runAt = new Date().toISOString();
  const pilots = fs.existsSync(pilotPath)
    ? JSON.parse(fs.readFileSync(pilotPath, 'utf8')).pilots ?? []
    : [];
  const enrichedCompanies = (payload.companies ?? []).map(enrichCompanyDiagnostics);
  const pilotCompanyId = pilots[0]?.company_id;
  const branchRiskRows = await fetchBranchRiskRows(connectionString, pilotCompanyId);

  const envelope = {
    run_at: runAt,
    run_mode: runMode,
    staging_guard: 'UNIFIED_LEDGER_STAGING=1',
    ...payload,
    companies: enrichedCompanies,
    pilot_branch_attribution_risk_sample: branchRiskRows,
  };

  fs.mkdirSync(reportsDir, { recursive: true });
  const stamp = runAt.replace(/[:.]/g, '-');
  const jsonPath = path.join(reportsDir, `diagnostics-${stamp}.json`);
  const jsonText = JSON.stringify(envelope, null, 2);
  fs.writeFileSync(jsonPath, jsonText, 'utf8');
  const jsonSha = sha256(jsonText);

  const companiesCount = envelope.companies_count ?? (envelope.companies?.length ?? 0);
  const strictFail = envelope.summary?.strict_fail_count ?? 0;
  const status = strictFail === 0 ? 'PASS' : 'FAIL';

  const pilotResults = pilotSection(envelope, pilots, branchRiskRows);

  console.log(`Run timestamp: ${runAt}`);
  console.log(`companies_count: ${companiesCount}`);
  console.log(`JSON path: ${jsonPath}`);
  console.log(`SHA256: ${jsonSha}`);
  console.log(`Status: ${status}`);
  console.log(`strict_pass: ${envelope.summary?.strict_pass_count ?? 'n/a'}`);
  console.log(`strict_fail: ${strictFail}`);
  console.log(`branch_attribution_risk_total: ${envelope.summary?.branch_attribution_risk_total ?? 'n/a'}`);

  if (writeReport) {
    const md = buildMarkdownReport({
      runAt,
      companiesCount,
      jsonPath,
      jsonSha,
      payload: envelope,
      pilotResults,
      status,
    });
    fs.writeFileSync(diagnosticReportPath, md, 'utf8');
    console.log(`Report written: ${diagnosticReportPath}`);
  }

  if (status === 'FAIL') process.exit(2);
}

main().catch((e) => fail(e.message));
