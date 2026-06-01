#!/usr/bin/env node
/**
 * Roll back Phase 13 import for a single company (TARGET_COMPANY_ID).
 * Never deletes companies, branches, users, or role tables.
 *
 * Usage:
 *   node rollbackImport.js --dry-run --journals-only
 *   node rollbackImport.js --confirm --journals-only
 *   node rollbackImport.js --confirm --all
 *   node rollbackImport.js --confirm   (interactive mode menu)
 *   node rollbackImport.js --confirm --all --yes   (non-interactive, for scripts)
 */
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { createClient } from '@supabase/supabase-js';
import { loadRollbackEnv } from './lib/loadRollbackEnv.js';
import {
  PROTECTED_TABLES,
  clearBranchSettingsAccountRefs,
  deleteEq,
  deleteImportedContacts,
  deleteInChunks,
  deleteProductSatellites,
  selectIdsByCompany,
} from './lib/companyScopedDelete.js';

async function preflightCompany(supabase, companyId) {
  const { data, error } = await supabase
    .from('companies')
    .select('id, name')
    .eq('id', companyId)
    .maybeSingle();
  if (error) throw new Error(`Company preflight failed: ${error.message}`);
  if (!data) {
    throw new Error(`Company not found: ${companyId}`);
  }
  return data;
}

/**
 * @param {string | null} modeFromEnv
 * @returns {Promise<'journals-only' | 'all'>}
 */
async function resolveMode(modeFromEnv) {
  if (modeFromEnv === 'journals-only' || modeFromEnv === 'all') {
    return modeFromEnv;
  }

  const rl = readline.createInterface({ input, output });
  try {
    console.log('\nRollback scope (imported data only):');
    console.log('  1) Journals + chart of accounts (journal_entry_lines, journal_entries, accounts)');
    console.log(
      '  2) All imported data (+ products, product_variations, contacts except walk-in customer)'
    );
    const answer = await rl.question('\nEnter 1 or 2: ');
    const trimmed = answer.trim();
    if (trimmed === '1') return 'journals-only';
    if (trimmed === '2') return 'all';
    throw new Error('Invalid choice. Use 1 or 2, or pass --journals-only / --all.');
  } finally {
    rl.close();
  }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} companyId
 * @param {{ dryRun: boolean }} opts
 */
async function rollbackJournalsAndAccounts(supabase, companyId, opts) {
  const results = [];
  const entryIds = await selectIdsByCompany(supabase, 'journal_entries', 'company_id', companyId);

  results.push(
    await deleteInChunks(supabase, 'journal_entry_lines', 'journal_entry_id', entryIds, opts)
  );
  results.push(await deleteEq(supabase, 'journal_entries', 'company_id', companyId, opts));
  await clearBranchSettingsAccountRefs(supabase, companyId, opts);
  results.push(await deleteEq(supabase, 'accounts', 'company_id', companyId, opts));
  return results;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} companyId
 * @param {{ dryRun: boolean }} opts
 */
async function rollbackAllImported(supabase, companyId, opts) {
  const results = await rollbackJournalsAndAccounts(supabase, companyId, opts);

  const productIds = await selectIdsByCompany(supabase, 'products', 'company_id', companyId);
  results.push(...(await deleteProductSatellites(supabase, companyId, productIds, opts)));
  results.push(
    await deleteInChunks(supabase, 'product_variations', 'product_id', productIds, opts)
  );
  results.push(await deleteEq(supabase, 'products', 'company_id', companyId, opts));
  results.push(await deleteImportedContacts(supabase, companyId, opts));

  return results;
}

function printSummary(mode, company, dryRun, results) {
  console.log('\n--- Rollback summary ---');
  console.log(`  company: ${company.name} (${company.id})`);
  console.log(`  mode: ${mode}`);
  console.log(`  action: ${dryRun ? 'dry-run (no deletes)' : 'confirmed delete'}`);
  let total = 0;
  for (const r of results) {
    const n = dryRun ? (r.wouldDelete ?? 0) : (r.deleted ?? 0);
    total += n;
    const label = dryRun ? 'would delete' : 'deleted';
    console.log(`  ${r.table}: ${label} ${n}`);
  }
  console.log(`  total rows ${dryRun ? 'that would be removed' : 'removed'}: ${total}`);
  console.log(`  protected (never touched): ${[...PROTECTED_TABLES].join(', ')}`);
}

async function main() {
  let env;
  try {
    env = loadRollbackEnv();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }

  const { dryRun, skipConfirm, targetCompanyId, supabaseUrl, serviceRoleKey, mode: modeFlag } = env;

  console.log('Phase 13 import rollback');
  console.log(`  mode flag: ${modeFlag ?? '(interactive)'}`);
  console.log(`  target company: ${targetCompanyId}`);
  console.log(`  action: ${dryRun ? 'DRY-RUN' : 'LIVE (--confirm)'}`);

  const mode = await resolveMode(modeFlag);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const company = await preflightCompany(supabase, targetCompanyId);
  console.log(`\nTarget: ${company.name} (${company.id})`);

  if (!dryRun && !skipConfirm) {
    const rl = readline.createInterface({ input, output });
    try {
      const typed = await rl.question(
        `\nType the company name exactly to confirm DELETE (${mode}): `
      );
      if (typed.trim() !== company.name) {
        console.error('Confirmation failed — company name did not match. Aborted.');
        process.exit(1);
      }
    } finally {
      rl.close();
    }
  } else if (!dryRun && skipConfirm) {
    console.log(`\n--yes: skipping name prompt; proceeding with DELETE (${mode})`);
  }

  const opts = { dryRun };
  const results =
    mode === 'all'
      ? await rollbackAllImported(supabase, targetCompanyId, opts)
      : await rollbackJournalsAndAccounts(supabase, targetCompanyId, opts);

  printSummary(mode, company, dryRun, results);
  console.log('\nRollback finished.');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
