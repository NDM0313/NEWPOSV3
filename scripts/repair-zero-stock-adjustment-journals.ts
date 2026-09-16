/**
 * One-off repair: re-post stock_adjustment JEs that have zero line amounts.
 *
 * Usage (from repo root, with env pointing at target Supabase):
 *   npx tsx scripts/repair-zero-stock-adjustment-journals.ts [companyId]
 *
 * If companyId is omitted, repairs all companies that have zero-amount stock_adjustment JEs.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL / service role or anon key in env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const MONEY_EPS = 0.02;

async function sumJeLines(jeId: string): Promise<number> {
  const { data } = await supabase
    .from('journal_entry_lines')
    .select('debit, credit')
    .eq('journal_entry_id', jeId);
  if (!data?.length) return 0;
  const d = data.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const c = data.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  return Math.max(d, c);
}

async function main() {
  const companyArg = process.argv[2];
  let query = supabase
    .from('journal_entries')
    .select('id, company_id, entry_no, reference_id')
    .eq('reference_type', 'stock_adjustment')
    .or('is_void.is.null,is_void.eq.false');
  if (companyArg) query = query.eq('company_id', companyArg);

  const { data: jes, error } = await query;
  if (error) {
    console.error('List JEs failed:', error.message);
    process.exit(1);
  }

  const zeroJes = [];
  for (const je of jes || []) {
    const total = await sumJeLines(je.id);
    if (total < MONEY_EPS) zeroJes.push(je);
  }

  console.log(`Found ${zeroJes.length} zero-amount stock_adjustment JEs (of ${jes?.length ?? 0} active).`);
  if (zeroJes.length === 0) return;

  // Dynamic import app service (requires Vite path aliases — use relative repair inline if tsx fails)
  const { stockAdjustmentJournalService } = await import(
    '../src/app/services/stockAdjustmentJournalService.ts'
  );

  const companies = [...new Set(zeroJes.map((j) => j.company_id))];
  for (const companyId of companies) {
    console.log(`Repairing company ${companyId}...`);
    const result = await stockAdjustmentJournalService.repairZeroAmountStockAdjustmentsForCompany(
      companyId,
      { suppressNotify: true }
    );
    console.log('  result:', result);
  }

  for (const je of zeroJes.slice(0, 10)) {
    const after = await sumJeLines(je.id);
    console.log(`  ${je.entry_no}: lines before repair path — check movement ${je.reference_id}`);
    if (after >= MONEY_EPS) console.log(`    still active JE ${je.id} line total=${after}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
