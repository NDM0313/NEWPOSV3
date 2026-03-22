#!/usr/bin/env node
/**
 * Journal source-of-truth validation (non-void journals, line integrity, TB tie-out).
 * Requires: v_accounting_* views from migrations/20260326_journal_sot_validation_views.sql
 *
 * Usage:
 *   node scripts/verify-journal-source-of-truth.mjs
 *   node scripts/verify-journal-source-of-truth.mjs --company=<uuid>   # scope TB diff to one company
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (or VITE_* fallbacks)
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const companyArg = process.argv.find((a) => a.startsWith('--company='));
const companyFilter = companyArg ? companyArg.split('=')[1]?.trim() : null;

function fail(msg) {
  console.error(`❌ ${msg}`);
  process.exitCode = 1;
}

async function countView(supabase, view, filter) {
  let q = supabase.from(view).select('*', { count: 'exact', head: true });
  if (filter) q = q.eq('company_id', filter);
  const { error, count } = await q;
  if (error) {
    fail(`${view}: ${error.message} (did you apply migrations/20260326_journal_sot_validation_views.sql?)`);
    return -1;
  }
  return count ?? 0;
}

async function fetchSample(supabase, view, filter, limit = 5) {
  let q = supabase.from(view).select('*').limit(limit);
  if (filter) q = q.eq('company_id', filter);
  const { data, error } = await q;
  if (error) return [];
  return data || [];
}

async function tbTotals(supabase, filter) {
  let q = supabase.from('v_accounting_tb_company_totals').select('company_id,total_debit,total_credit,difference');
  if (filter) q = q.eq('company_id', filter);
  const { data, error } = await q;
  if (error) {
    fail(`v_accounting_tb_company_totals: ${error.message}`);
    return [];
  }
  return data || [];
}

async function main() {
  console.log('========================================');
  console.log('JOURNAL SOURCE OF TRUTH — VALIDATION');
  console.log('========================================\n');

  if (!supabaseUrl || !supabaseKey) {
    fail('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const scope = companyFilter ? `company_id = ${companyFilter}` : 'all companies';
  console.log(`Scope: ${scope}\n`);

  const unbalanced = await countView(supabase, 'v_accounting_unbalanced_journals', companyFilter);
  const orphans = await countView(supabase, 'v_accounting_lines_orphan_journal', null);
  const bothSides = await countView(supabase, 'v_accounting_lines_both_sides', companyFilter);
  const missingLines = await countView(supabase, 'v_accounting_journals_missing_lines', companyFilter);

  if (unbalanced < 0 || orphans < 0 || bothSides < 0 || missingLines < 0) {
    process.exit(1);
  }

  console.log(`Unbalanced journals (non-void):     ${unbalanced}`);
  console.log(`Orphan lines (no journal row):      ${orphans}`);
  console.log(`Lines with debit AND credit > 0:   ${bothSides}`);
  console.log(`Journals with zero lines (non-void): ${missingLines}`);

  const rows = await tbTotals(supabase, companyFilter);
  const EPS = 0.01;
  const tbOk = rows.every((r) => Math.abs(Number(r.difference) || 0) < EPS);
  for (const r of rows) {
    const d = Math.abs(Number(r.difference) || 0);
    if (d >= EPS) {
      console.log(
        `\n⚠️  TB not tied for company ${r.company_id}: debit=${r.total_debit} credit=${r.total_credit} diff=${r.difference}`
      );
    }
  }
  if (rows.length === 0) {
    console.log('\n(No rows in v_accounting_tb_company_totals — no non-void journal lines in scope, or view missing.)');
  }

  if (unbalanced > 0) {
    console.log('\nSample unbalanced journals:');
    console.table(await fetchSample(supabase, 'v_accounting_unbalanced_journals', companyFilter));
  }
  if (orphans > 0) {
    console.log('\nSample orphan lines:');
    console.table(await fetchSample(supabase, 'v_accounting_lines_orphan_journal', null));
  }
  if (bothSides > 0) {
    console.log('\nSample both-sides lines:');
    console.table(await fetchSample(supabase, 'v_accounting_lines_both_sides', companyFilter));
  }

  const structuralOk =
    unbalanced === 0 && orphans === 0 && bothSides === 0 && tbOk;

  if (structuralOk) {
    if (missingLines > 0) {
      console.log(
        '\n⚠️  Non-void journals with no lines (drafts or pipeline): ' +
          `${missingLines} — review if unexpected.`
      );
    }
    console.log('\nALL SYSTEM CONSISTENT ✅\n');
    return;
  }

  if (missingLines > 0) {
    console.log('\n⚠️  Non-void journals with no lines — review drafts vs posting bugs.');
  }

  fail('One or more journal integrity checks failed (see above).');
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
