/**
 * Phase B read-only verification — queries sample refs + COA counts (no writes).
 * Usage: npx tsx scripts/verify-phase-b-readonly.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

function loadEnv() {
  for (const f of ['.env.local', '.env']) {
    const p = resolve(process.cwd(), f);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m && !process.env[m[1].trim()]) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  }
}

loadEnv();
const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const sb = createClient(url, key);
const COMPANY = '597a5292-14c8-4cd8-96bd-c61b5a0d8c92';

async function main() {
  const { count: acctCount } = await sb
    .from('accounts')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', COMPANY);

  const { data: groups } = await sb
    .from('accounts')
    .select('id, code, name, is_group')
    .eq('company_id', COMPANY)
    .eq('is_group', true);

  const samples = {};

  for (const q of ['HQ-RCV-0006', 'JE-0012']) {
    const { data: pay } = await sb
      .from('payments')
      .select('id, reference_number, reference_type, amount, journal_entry_id')
      .eq('company_id', COMPANY)
      .or(`reference_number.ilike.%${q}%,reference_number.eq.${q}`)
      .limit(3);
    const { data: je } = await sb
      .from('journal_entries')
      .select('id, entry_no, reference_type, payment_id')
      .eq('company_id', COMPANY)
      .eq('entry_no', q)
      .limit(3);
    samples[q] = { payments: pay, journal_entries: je };
  }

  const { data: salePay } = await sb
    .from('payments')
    .select('reference_number, reference_type, amount')
    .eq('company_id', COMPANY)
    .eq('reference_type', 'sale')
    .not('reference_number', 'is', null)
    .limit(1)
    .maybeSingle();

  const { data: rentalPay } = await sb
    .from('rental_payments')
    .select('reference_number, amount, journal_entry_id')
    .eq('company_id', COMPANY)
    .not('reference_number', 'is', null)
    .limit(1)
    .maybeSingle();

  const { data: expPay } = await sb
    .from('payments')
    .select('reference_number, reference_type, amount')
    .eq('company_id', COMPANY)
    .eq('reference_type', 'expense')
    .not('reference_number', 'is', null)
    .limit(1)
    .maybeSingle();

  const { data: obJe } = await sb
    .from('journal_entries')
    .select('entry_no, reference_type, reference_id')
    .eq('company_id', COMPANY)
    .like('reference_type', 'opening_balance%')
    .limit(1)
    .maybeSingle();

  console.log(JSON.stringify({
    accounts_count: acctCount,
    group_accounts: groups?.length ?? 0,
    samples,
    trace_refs: {
      sale_payment: salePay?.reference_number,
      rental_payment: rentalPay?.reference_number,
      expense_payment: expPay?.reference_number,
      opening_balance_je: obJe?.entry_no,
      opening_balance_type: obJe?.reference_type,
    },
  }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
