/**
 * STEP-BY-STEP ACCOUNTING DATA VERIFICATION SCRIPT
 * Runs all SQL verification queries and reports results
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyAccountingData() {
  console.log('========================================');
  console.log('ACCOUNTING DATA VERIFICATION');
  console.log('========================================\n');

  // STEP 4: Check for data corruption (both debit and credit > 0)
  console.log('STEP 4: Checking for DATA CORRUPTION...');
  const { data: corruptionData, error: corruptionError } = await supabase.rpc('exec_sql', {
    query: `
      SELECT 
        je.id,
        je.entry_no,
        je.description,
        jel.debit,
        jel.credit,
        je.reference_type,
        je.payment_id,
        je.reference_id
      FROM journal_entries je
      JOIN journal_entry_lines jel ON je.id = jel.journal_entry_id
      JOIN accounts a ON jel.account_id = a.id
      WHERE a.code = '2000'
        AND jel.debit > 0 
        AND jel.credit > 0
      ORDER BY je.created_at DESC
      LIMIT 10;
    `
  });

  if (corruptionError) {
    // Try direct query instead
    const { data: lines, error: linesError } = await supabase
      .from('journal_entry_lines')
      .select(`
        debit,
        credit,
        journal_entry:journal_entries(
          id,
          entry_no,
          description,
          reference_type,
          payment_id
        ),
        account:accounts(code)
      `)
      .eq('account.code', '2000')
      .gt('debit', 0)
      .gt('credit', 0)
      .limit(10);

    if (linesError) {
      console.error('❌ Error checking corruption:', linesError);
    } else if (lines && lines.length > 0) {
      console.error(`❌ DATA CORRUPTION FOUND: ${lines.length} entries with both debit and credit > 0`);
      lines.forEach((line: any) => {
        console.error(`  - Entry: ${line.journal_entry?.entry_no}, Debit: ${line.debit}, Credit: ${line.credit}`);
      });
    } else {
      console.log('✅ No data corruption found (no entries with both debit and credit > 0)');
    }
  } else if (corruptionData && corruptionData.length > 0) {
    console.error(`❌ DATA CORRUPTION FOUND: ${corruptionData.length} entries`);
    corruptionData.forEach((entry: any) => {
      console.error(`  - ${entry.entry_no}: Debit=${entry.debit}, Credit=${entry.credit}`);
    });
  } else {
    console.log('✅ No data corruption found');
  }

  // STEP 3: Verify accounting rules
  console.log('\nSTEP 3: Verifying accounting rules...');
  
  // Check sales (should be DEBIT)
  const { data: salesData, error: salesError } = await supabase
    .from('journal_entries')
    .select(`
      id,
      entry_no,
      reference_type,
      journal_entry_lines!inner(
        debit,
        credit,
        account:accounts!inner(code)
      )
    `)
    .eq('reference_type', 'sale')
    .eq('journal_entry_lines.account.code', '2000')
    .gt('journal_entry_lines.debit', 0)
    .limit(5);

  if (salesError) {
    console.error('❌ Error checking sales:', salesError);
  } else {
    console.log(`✅ Sales entries: ${salesData?.length || 0} found (should be DEBIT)`);
  }

  // Check payments (should be CREDIT)
  const { data: paymentsData, error: paymentsError } = await supabase
    .from('journal_entries')
    .select(`
      id,
      entry_no,
      payment_id,
      journal_entry_lines!inner(
        debit,
        credit,
        account:accounts!inner(code)
      )
    `)
    .not('payment_id', 'is', null)
    .eq('journal_entry_lines.account.code', '2000')
    .gt('journal_entry_lines.credit', 0)
    .limit(5);

  if (paymentsError) {
    console.error('❌ Error checking payments:', paymentsError);
  } else {
    console.log(`✅ Payment entries: ${paymentsData?.length || 0} found (should be CREDIT)`);
  }

  // STEP 5: Check payment linkage
  console.log('\nSTEP 5: Checking payment → journal entry linkage...');
  const { data: unlinkedPayments, error: unlinkedError } = await supabase
    .from('payments')
    .select('id, reference_number, journal_entry_id, contact_id, amount')
    .is('journal_entry_id', null)
    .limit(10);

  if (unlinkedError) {
    console.error('❌ Error checking payment linkage:', unlinkedError);
  } else if (unlinkedPayments && unlinkedPayments.length > 0) {
    console.error(`❌ ${unlinkedPayments.length} payments without journal_entry_id:`);
    unlinkedPayments.forEach((p: any) => {
      console.error(`  - Payment ${p.reference_number || p.id}: Amount ${p.amount}`);
    });
  } else {
    console.log('✅ All payments are linked to journal entries');
  }

  // STEP 4: Check entry_no uniqueness
  console.log('\nSTEP 4: Checking entry_no uniqueness...');
  const { data: duplicateEntries, error: duplicateError } = await supabase
    .from('journal_entries')
    .select('entry_no, count')
    .not('entry_no', 'is', null)
    .neq('entry_no', '');

  if (duplicateError) {
    console.error('❌ Error checking duplicates:', duplicateError);
  } else {
    // Group by entry_no and find duplicates
    const entryNoMap = new Map<string, number>();
    duplicateEntries?.forEach((entry: any) => {
      const count = entryNoMap.get(entry.entry_no) || 0;
      entryNoMap.set(entry.entry_no, count + 1);
    });

    const duplicates = Array.from(entryNoMap.entries())
      .filter(([_, count]) => count > 1)
      .map(([entryNo, count]) => ({ entryNo, count }));

    if (duplicates.length > 0) {
      console.error(`❌ Found ${duplicates.length} duplicate entry_no values:`);
      duplicates.forEach((d: any) => {
        console.error(`  - ${d.entryNo}: appears ${d.count} times`);
      });
    } else {
      console.log('✅ All entry_no values are unique');
    }
  }

  console.log('\n========================================');
  console.log('VERIFICATION COMPLETE');
  console.log('========================================');
}

// Run verification
verifyAccountingData()
  .then(() => {
    console.log('\n✅ Verification script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Verification script failed:', error);
    process.exit(1);
  });
