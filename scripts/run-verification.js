/**
 * Quick verification script using Supabase client
 * Can be run with: node scripts/run-verification.js
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('🔍 Verifying Accounting Data...\n');

  // STEP 4: Check for corruption
  console.log('STEP 4: Checking for data corruption...');
  const { data: arAccount } = await supabase
    .from('accounts')
    .select('id')
    .eq('code', '2000')
    .single();

  if (!arAccount) {
    console.error('❌ Accounts Receivable account (2000) not found');
    return;
  }

  const { data: lines, error: linesError } = await supabase
    .from('journal_entry_lines')
    .select(`
      debit,
      credit,
      journal_entry:journal_entries(
        id,
        entry_no,
        description
      )
    `)
    .eq('account_id', arAccount.id)
    .gt('debit', 0)
    .gt('credit', 0)
    .limit(10);

  if (linesError) {
    console.error('❌ Error:', linesError.message);
  } else if (lines && lines.length > 0) {
    console.error(`❌ DATA CORRUPTION: ${lines.length} entries with both debit and credit > 0`);
    lines.forEach(l => {
      console.error(`  - ${l.journal_entry?.entry_no}: Debit=${l.debit}, Credit=${l.credit}`);
    });
  } else {
    console.log('✅ No data corruption found');
  }

  // STEP 5: Check payment linkage
  console.log('\nSTEP 5: Checking payment linkage...');
  const { data: unlinked, error: unlinkedError } = await supabase
    .from('payments')
    .select('id, reference_number')
    .is('journal_entry_id', null)
    .limit(10);

  if (unlinkedError) {
    console.error('❌ Error:', unlinkedError.message);
  } else if (unlinked && unlinked.length > 0) {
    console.error(`❌ ${unlinked.length} payments without journal_entry_id`);
  } else {
    console.log('✅ All payments are linked');
  }

  // STEP 3: Verify rules
  console.log('\nSTEP 3: Verifying accounting rules...');
  
  // Get sample sales (should be DEBIT)
  const { data: sales, error: salesError } = await supabase
    .from('journal_entries')
    .select(`
      id,
      entry_no,
      reference_type,
      journal_entry_lines!inner(debit, credit, account:accounts!inner(code))
    `)
    .eq('reference_type', 'sale')
    .eq('journal_entry_lines.account.code', '2000')
    .limit(5);

  if (salesError) {
    console.error('❌ Error checking sales:', salesError.message);
  } else {
    console.log(`✅ Found ${sales?.length || 0} sales (checking if DEBIT)...`);
    sales?.forEach(s => {
      const line = s.journal_entry_lines?.[0];
      if (line) {
        const isDebit = line.debit > 0 && line.credit === 0;
        console.log(`  - ${s.entry_no}: ${isDebit ? '✅ DEBIT' : '❌ NOT DEBIT'} (Debit: ${line.debit}, Credit: ${line.credit})`);
      }
    });
  }

  // Get sample payments (should be CREDIT)
  const { data: payments, error: paymentsError } = await supabase
    .from('journal_entries')
    .select(`
      id,
      entry_no,
      payment_id,
      journal_entry_lines!inner(debit, credit, account:accounts!inner(code))
    `)
    .not('payment_id', 'is', null)
    .eq('journal_entry_lines.account.code', '2000')
    .limit(5);

  if (paymentsError) {
    console.error('❌ Error checking payments:', paymentsError.message);
  } else {
    console.log(`✅ Found ${payments?.length || 0} payments (checking if CREDIT)...`);
    payments?.forEach(p => {
      const line = p.journal_entry_lines?.[0];
      if (line) {
        const isCredit = line.credit > 0 && line.debit === 0;
        console.log(`  - ${p.entry_no}: ${isCredit ? '✅ CREDIT' : '❌ NOT CREDIT'} (Debit: ${line.debit}, Credit: ${line.credit})`);
      }
    });
  }

  console.log('\n✅ Verification complete!');
}

main().catch(console.error);
