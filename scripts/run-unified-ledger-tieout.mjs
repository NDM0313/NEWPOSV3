#!/usr/bin/env node
/**
 * All-company unified ledger tie-out (staging/clone only).
 *
 * Requires:
 *   UNIFIED_LEDGER_STAGING=1
 *   UNIFIED_LEDGER_TIEOUT_STAGING=1
 *
 * Usage:
 *   node scripts/run-unified-ledger-tieout.mjs --pilot-only --write-report
 *   node scripts/run-unified-ledger-tieout.mjs --write-report
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
import {
  loadEnvLocal,
  assertStagingTarget,
  printMaskedTarget,
  pgClientOptions,
} from './single-core-ledger/staging-env-guard.mjs';
import {
  withPgClient,
  fetchCompaniesPg,
  fetchBranchesPg,
  fetchContactsForPatternsPg,
  legacyGlBalancePg,
  unifiedBalancePg,
  pilotRpcChecksPg,
} from './single-core-ledger/pg-rpc-client.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const reportsDir = path.join(root, 'reports', 'single-core-ledger');
const pilotPath = path.join(root, 'scripts', 'single-core-ledger', 'pilot-companies.json');
const tieOutReportPath = path.join(
  root,
  'docs',
  'accounting',
  'SINGLE_CORE_LEDGER_ALL_COMPANY_TIEOUT_REPORT.md'
);

const BASES = ['official_gl', 'effective_party', 'audit_full_history'];

loadEnvLocal(root);

const writeReport = process.argv.includes('--write-report');
const pilotOnly = process.argv.includes('--pilot-only');

function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function fail(msg, code = 1) {
  console.error(`❌ ${msg}`);
  process.exit(code);
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

async function fetchCompanies(supabase, pilotIds) {
  let q = supabase.from('companies').select('id, name').eq('is_active', true).order('name');
  if (pilotOnly && pilotIds.length) q = q.in('id', pilotIds);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data || [];
}

async function fetchBranches(supabase, companyId) {
  const { data, error } = await supabase
    .from('branches')
    .select('id, name, code')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('code');
  if (error) throw new Error(error.message);
  return data || [];
}

async function resolvePilotBranchesFromList(branches, branchMatchers) {
  const resolved = [{ branchId: null, branchLabel: 'All branches' }];
  for (const m of branchMatchers || []) {
    const match = branches.find((b) => {
      if (m.match?.code) return String(b.code || '').toUpperCase() === String(m.match.code).toUpperCase();
      if (m.match?.name) return String(b.name || '').toLowerCase().includes(String(m.match.name).toLowerCase());
      return false;
    });
    if (match) {
      resolved.push({
        branchId: match.id,
        branchLabel: m.label || match.name,
        branchCode: match.code,
      });
    }
  }
  return resolved;
}

async function resolvePilotBranches(supabase, companyId, branchMatchers) {
  const branches = await fetchBranches(supabase, companyId);
  return resolvePilotBranchesFromList(branches, branchMatchers);
}

async function fetchContactsForPatterns(supabase, companyId, patterns) {
  const out = [];
  for (const p of patterns) {
    let q = supabase
      .from('contacts')
      .select('id, name, code, type')
      .eq('company_id', companyId)
      .limit(3);
    if (p.code) q = q.eq('code', p.code);
    else if (p.namePattern) q = q.ilike('name', `%${p.namePattern}%`);
    const { data } = await q;
    for (const c of data || []) {
      out.push({
        contactId: c.id,
        contactName: c.name,
        contactCode: c.code,
        partyType: p.partyType || (c.type === 'supplier' ? 'supplier' : 'customer'),
        patternLabel: p.label,
      });
    }
  }
  return out;
}

async function legacyGlBalance(supabase, companyId, partyType, contactId, branchId) {
  const rpcName =
    partyType === 'customer'
      ? 'get_customer_ar_gl_ledger_for_contact'
      : partyType === 'supplier'
        ? 'get_supplier_ap_gl_ledger_for_contact'
        : 'get_worker_party_gl_ledger_for_contact';

  const { data, error } = await supabase.rpc(rpcName, {
    p_company_id: companyId,
    p_contact_id: contactId,
    p_branch_id: branchId,
    p_start_date: null,
    p_end_date: null,
  });

  if (error) return { error: error.message, balance: 0, rowCount: 0 };
  const rows = Array.isArray(data) ? data : data?.rows || [];
  const balance =
    rows.length > 0
      ? round2(Number(rows[rows.length - 1].running_balance ?? rows[rows.length - 1].balance) || 0)
      : 0;
  return { balance, rowCount: rows.length };
}

async function unifiedBalance(supabase, companyId, partyType, contactId, branchId, basis) {
  const { data, error } = await supabase.rpc('get_unified_party_ledger', {
    p_company_id: companyId,
    p_party_type: partyType,
    p_party_id: contactId,
    p_branch_id: branchId,
    p_start_date: null,
    p_end_date: null,
    p_basis: basis,
  });
  if (error) return { error: error.message, balance: 0, rowCount: 0 };
  const rows = data?.rows || [];
  const balance =
    rows.length > 0
      ? round2(Number(rows[rows.length - 1].running_balance) || 0)
      : round2(Number(data?.period_opening_balance) || 0);
  return { balance, rowCount: Number(data?.row_count) || rows.length };
}

async function pilotRpcChecks(supabase, companyId, branchId) {
  const [tb, cash] = await Promise.all([
    supabase.rpc('get_unified_trial_balance', {
      p_company_id: companyId,
      p_branch_id: branchId,
      p_as_of_date: null,
      p_basis: 'official_gl',
    }),
    supabase.rpc('get_unified_cash_bank_ledger', {
      p_company_id: companyId,
      p_branch_id: branchId,
      p_start_date: null,
      p_end_date: null,
      p_basis: 'official_gl',
      p_liquidity: 'all',
    }),
  ]);

  return {
    trial_balance: tb.error
      ? { error: tb.error.message }
      : {
          total_debit: round2(Number(tb.data?.total_debit) || 0),
          total_credit: round2(Number(tb.data?.total_credit) || 0),
          difference: round2(Number(tb.data?.difference) || 0),
          account_count: Number(tb.data?.account_count) || 0,
          balanced: Math.abs(Number(tb.data?.difference) || 0) <= 0.01,
        },
    cash_bank: cash.error
      ? { error: cash.error.message }
      : {
          row_count: Number(cash.data?.row_count) || 0,
          liquidity_account_count: Number(cash.data?.liquidity_account_count) || 0,
          period_opening_balance: round2(Number(cash.data?.period_opening_balance) || 0),
        },
  };
}

function buildMarkdown(meta) {
  const {
    runAt,
    companiesCount,
    jsonPath,
    jsonSha,
    summary,
    pilotSection,
    status,
    pilotRpc,
    comparisons,
  } = meta;

  const lines = [
    '# Single Core Ledger — All-Company Tie-Out Report',
    '',
    '## Run metadata',
    '',
    '| Field | Value |',
    '|-------|-------|',
    `| Run timestamp (UTC) | ${runAt} |`,
    `| companies_count | ${companiesCount} |`,
    `| pilot_only | ${pilotOnly} |`,
    `| JSON output path | \`${jsonPath}\` |`,
    `| JSON SHA256 | \`${jsonSha}\` |`,
    `| Overall status | **${status}** |`,
    '',
    '## Pass / fail summary',
    '',
    `- comparisons_total: ${summary.comparisons_total}`,
    `- pass_count: ${summary.pass_count}`,
    `- fail_count: ${summary.fail_count}`,
    `- max_abs_difference: ${summary.max_abs_difference}`,
    '',
    '## DIN CHINA pilot — trial balance & cash/bank',
    '',
    '```json',
    JSON.stringify(pilotRpc, null, 2),
    '```',
    '',
    '## DIN CHINA pilot — party comparisons',
    '',
    '```json',
    JSON.stringify(pilotSection, null, 2),
    '```',
    '',
    '## Every comparison row',
    '',
    '| company | branch | contact | basis | old_source | old | new | diff | pass |',
    '|---------|--------|---------|-------|------------|-----|-----|------|------|',
  ];

  for (const c of comparisons) {
    lines.push(
      `| ${c.company_name} | ${c.branch_label ?? 'all'} | ${c.contact_name} (${c.contact_code ?? '—'}) | ${c.basis} | ${c.old_source} | ${c.old_balance} | ${c.new_balance} | ${c.difference} | ${c.pass ? 'PASS' : 'FAIL'} |`
    );
  }

  lines.push('', '## Unresolved differences', '');
  const unresolved = comparisons.filter((c) => !c.pass);
  if (!unresolved.length) lines.push('_None._');
  else {
    for (const u of unresolved) {
      lines.push(
        `- **${u.company_name}** / ${u.branch_label} / ${u.contact_name} / ${u.basis} / ${u.old_source}: diff=${u.difference} (legacy=${u.old_balance}, unified=${u.new_balance})${u.legacy_error ? ` legacy_err=${u.legacy_error}` : ''}${u.unified_error ? ` unified_err=${u.unified_error}` : ''}`
      );
    }
  }
  lines.push(
    '',
    '## Notes',
    '',
    '- `legacy_gl_rpc`: existing AR/AP/worker GL journal RPCs.',
    '- `hybrid_frontend_equivalent`: Account Statements hybrid path — compare in dev UI `/admin/unified-ledger-tieout` (not replicated in CLI).',
    '- `operational_open_items`: Phase 2 RPC not yet available.',
    ''
  );
  return lines.join('\n');
}

async function main() {
  console.log('========================================');
  console.log('UNIFIED LEDGER — TIE-OUT (STAGING)');
  console.log('========================================\n');

  let target;
  try {
    target = assertStagingTarget({ requireTieOut: true });
  } catch (e) {
    fail(e.message);
  }
  printMaskedTarget(target);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
  const connectionString =
    process.env.DATABASE_ADMIN_URL ||
    process.env.DATABASE_URL ||
    process.env.DATABASE_POOLER_URL;
  const pgOnly =
    process.env.UNIFIED_LEDGER_PG_ONLY === '1' ||
    target.targetType === 'vps_isolated_clone' ||
    (!supabaseUrl || !supabaseKey);
  const runAt = new Date().toISOString();

  if (!pgOnly && (!supabaseUrl || !supabaseKey)) {
    fail('Missing staging Supabase URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  }
  if (pgOnly && !connectionString) {
    fail('PG-only tie-out requires DATABASE_URL to staging/clone.');
  }

  const pilots = fs.existsSync(pilotPath)
    ? JSON.parse(fs.readFileSync(pilotPath, 'utf8')).pilots ?? []
    : [];
  const pilotIds = pilots.map((p) => p.company_id);

  const comparisons = [];
  const pilotSection = [];
  let pilotRpc = {};
  let companies = [];

  const runCompanyLoop = async (api) => {
    companies = await api.fetchCompanies(pilotIds);
    for (const co of companies) {
      const pilot = pilots.find((p) => p.company_id === co.id);
      const branchScopes = pilot
        ? await api.resolvePilotBranches(co.id, pilot.branches)
        : [{ branchId: null, branchLabel: 'All branches' }];

      const contacts = pilot?.golden_contact_patterns?.length
        ? await api.fetchContacts(co.id, pilot.golden_contact_patterns)
        : [];

      const coPilotRows = [];

      if (pilot) {
        pilotRpc = {};
        for (const scope of branchScopes) {
          pilotRpc[scope.branchLabel] = await api.pilotRpcChecks(co.id, scope.branchId);
        }
      }

      for (const scope of branchScopes) {
        for (const ct of contacts) {
          for (const basis of BASES) {
            const [legacy, unified] = await Promise.all([
              api.legacyGlBalance(co.id, ct.partyType, ct.contactId, scope.branchId),
              api.unifiedBalance(co.id, ct.partyType, ct.contactId, scope.branchId, basis),
            ]);

            const difference = round2((legacy.balance || 0) - (unified.balance || 0));
            const row = {
              company_id: co.id,
              company_name: co.name,
              branch_id: scope.branchId,
              branch_label: scope.branchLabel,
              branch_code: scope.branchCode ?? null,
              contact_id: ct.contactId,
              contact_name: ct.contactName,
              contact_code: ct.contactCode,
              party_type: ct.partyType,
              pattern_label: ct.patternLabel,
              basis,
              old_source: 'legacy_gl_rpc',
              new_engine: 'get_unified_party_ledger',
              old_balance: legacy.balance,
              new_balance: unified.balance,
              difference,
              old_row_count: legacy.rowCount,
              new_row_count: unified.rowCount,
              legacy_error: legacy.error ?? null,
              unified_error: unified.error ?? null,
              pass: Math.abs(difference) <= 0.01 && !legacy.error && !unified.error,
              hybrid_note:
                ct.partyType === 'customer'
                  ? 'hybrid_frontend_equivalent: use /admin/unified-ledger-tieout UI'
                  : null,
              operational_open_items_note: 'operational_open_items: Phase 2 RPC pending',
            };
            comparisons.push(row);
            if (pilot) coPilotRows.push(row);
          }
        }
      }

      if (pilot) {
        pilotSection.push({
          label: pilot.label,
          company_id: co.id,
          branch_scopes: branchScopes.map((b) => b.branchLabel),
          comparisons: coPilotRows,
        });
      }
    }
  };

  if (pgOnly) {
    await withPgClient(connectionString, async (client) => {
      await runCompanyLoop({
        fetchCompanies: (ids) => fetchCompaniesPg(client, ids),
        resolvePilotBranches: async (companyId, matchers) => {
          const branches = await fetchBranchesPg(client, companyId);
          return resolvePilotBranchesFromList(branches, matchers);
        },
        fetchContacts: (companyId, patterns) => fetchContactsForPatternsPg(client, companyId, patterns),
        legacyGlBalance: (companyId, partyType, contactId, branchId) =>
          legacyGlBalancePg(client, companyId, partyType, contactId, branchId),
        unifiedBalance: (companyId, partyType, contactId, branchId, basis) =>
          unifiedBalancePg(client, companyId, partyType, contactId, branchId, basis),
        pilotRpcChecks: (companyId, branchId) => pilotRpcChecksPg(client, companyId, branchId),
      });
    });
  } else {
    const supabase = createClient(supabaseUrl, supabaseKey);
    await runCompanyLoop({
      fetchCompanies: (ids) => fetchCompanies(supabase, ids),
      resolvePilotBranches: (companyId, matchers) => resolvePilotBranches(supabase, companyId, matchers),
      fetchContacts: (companyId, patterns) => fetchContactsForPatterns(supabase, companyId, patterns),
      legacyGlBalance: (companyId, partyType, contactId, branchId) =>
        legacyGlBalance(supabase, companyId, partyType, contactId, branchId),
      unifiedBalance: (companyId, partyType, contactId, branchId, basis) =>
        unifiedBalance(supabase, companyId, partyType, contactId, branchId, basis),
      pilotRpcChecks: (companyId, branchId) => pilotRpcChecks(supabase, companyId, branchId),
    });
  }

  /* removed duplicate loop — see runCompanyLoop above */

  const passCount = comparisons.filter((c) => c.pass).length;
  const failCount = comparisons.length - passCount;
  const maxAbs = comparisons.reduce((m, c) => Math.max(m, Math.abs(c.difference)), 0);
  const status =
    failCount === 0 && comparisons.length > 0 ? 'PASS' : comparisons.length === 0 ? 'NO_DATA' : 'FAIL';

  const envelope = {
    run_at: runAt,
    run_mode: pgOnly ? 'pg' : 'supabase',
    staging_guard: 'UNIFIED_LEDGER_STAGING=1',
    tieout_guard: 'UNIFIED_LEDGER_TIEOUT_STAGING=1',
    pilot_only: pilotOnly,
    companies_count: companies.length,
    bases: BASES,
    summary: {
      comparisons_total: comparisons.length,
      pass_count: passCount,
      fail_count: failCount,
      max_abs_difference: round2(maxAbs),
      unresolved: comparisons.filter((c) => !c.pass),
    },
    pilot_rpc_checks: pilotRpc,
    pilot_section: pilotSection,
    comparisons,
  };

  fs.mkdirSync(reportsDir, { recursive: true });
  const jsonPath = path.join(reportsDir, `tieout-${runAt.replace(/[:.]/g, '-')}.json`);
  const jsonText = JSON.stringify(envelope, null, 2);
  fs.writeFileSync(jsonPath, jsonText, 'utf8');
  const jsonSha = sha256(jsonText);

  console.log(`Run timestamp: ${runAt}`);
  console.log(`companies_count: ${companies.length}`);
  console.log(`comparisons: ${comparisons.length}`);
  console.log(`JSON path: ${jsonPath}`);
  console.log(`SHA256: ${jsonSha}`);
  console.log(`Status: ${status}`);
  console.log(`pass: ${passCount} / fail: ${failCount}`);

  if (writeReport) {
    fs.writeFileSync(
      tieOutReportPath,
      buildMarkdown({
        runAt,
        companiesCount: companies.length,
        jsonPath,
        jsonSha,
        summary: envelope.summary,
        pilotSection,
        pilotRpc,
        status,
        comparisons,
      }),
      'utf8'
    );
    console.log(`Report: ${tieOutReportPath}`);
  }

  if (status === 'FAIL') process.exit(2);
}

main().catch((e) => fail(e.message));
