/**
 * Accounting Data Verification Script
 * Uses environment variables directly
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read .env.local
const envPath = join(__dirname, '../.env.local');
let envContent = '';
try {
  envContent = readFileSync(envPath, 'utf-8');
} catch (e) {
  console.error('❌ Could not read .env.local');
  process.exit(1);
}

// Parse env variables
const envVars = {};
envContent.split('\n').forEach(line => {
  // Skip comments and empty lines
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return;
  
  const match = trimmed.match(/^([^#=]+)=(.*)$/);
  if (match) {
    const key = match[1].trim();
    let value = match[2].trim();
    // Remove quotes if present
    if ((value.startsWith('"') && value.endsWith('"')) || 
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    envVars[key] = value;
  }
});

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL || envVars.VITE_SUPABASE_URL;
const supabaseKey = envVars.SUPABASE_SERVICE_ROLE_KEY || envVars.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('========================================');
  console.log('ACCOUNTING DATA VERIFICATION');
  console.log('========================================\n');

  // Get AR account
  console.log('Checking for Accounts Receivable account...');
  const { data: arAccounts, error: arError } = await supabase
    .from('accounts')
    .select('id, code, name, type')
    .or('code.eq.2000,code.eq.1100,name.ilike.%Accounts Receivable%')
    .limit(5);

  if (arError) {
    console.error('❌ Error fetching accounts:', arError.message);
    return;
  }

  if (!arAccounts || arAccounts.length === 0) {
    console.error('❌ Accounts Receivable account not found');
    console.log('Available accounts:');
    const { data: allAccounts } = await supabase
      .from('accounts')
      .select('id, code, name, type')
      .limit(10);
    allAccounts?.forEach(a => {
      console.log(`  - ${a.code}: ${a.name} (${a.type})`);
    });
    return;
  }

  const arAccount = arAccounts[0];
  console.log(`✅ Found AR account: ${arAccount.name} (${arAccount.code})\n`);

  console.log(`✅ Found AR account: ${arAccount.name} (${arAccount.code})\n`);

  // STEP 4: Check for corruption
  console.log('STEP 4: Checking for DATA CORRUPTION...');
  const { data: corrupted, error: corruptedError } = await supabase
    .from('journal_entry_lines')
    .select(`
      debit,
      credit,
      journal_entry:journal_entries(
        id,
        entry_no,
        description,
        reference_type
      )
    `)
    .eq('account_id', arAccount.id)
    .gt('debit', 0)
    .gt('credit', 0)
    .limit(10);

  if (corruptedError) {
    console.error('❌ Error:', corruptedError.message);
  } else if (corrupted && corrupted.length > 0) {
    console.error(`❌ DATA CORRUPTION: ${corrupted.length} entries with both debit and credit > 0`);
    corrupted.forEach(c => {
      console.error(`  - ${c.journal_entry?.entry_no || 'N/A'}: Debit=${c.debit}, Credit=${c.credit}`);
    });
  } else {
    console.log('✅ No data corruption found\n');
  }

  // STEP 5: Check payment linkage
  console.log('STEP 5: Checking payment → journal entry linkage...');
  const { data: unlinked, error: unlinkedError } = await supabase
    .from('payments')
    .select('id, reference_number, amount, contact_id')
    .is('journal_entry_id', null)
    .limit(10);

  if (unlinkedError) {
    console.error('❌ Error:', unlinkedError.message);
  } else if (unlinked && unlinked.length > 0) {
    console.error(`❌ ${unlinked.length} payments without journal_entry_id:`);
    unlinked.forEach(p => {
      console.error(`  - ${p.reference_number || p.id}: Amount ${p.amount}`);
    });
  } else {
    console.log('✅ All payments are linked to journal entries\n');
  }

  // STEP 3: Verify accounting rules
  console.log('STEP 3: Verifying accounting rules...\n');
  
  // Get all AR lines to analyze
  const { data: allLines, error: linesError } = await supabase
    .from('journal_entry_lines')
    .select(`
      debit,
      credit,
      journal_entry:journal_entries(
        id,
        entry_no,
        reference_type,
        payment_id,
        description
      )
    `)
    .eq('account_id', arAccount.id)
    .order('created_at', { ascending: false })
    .limit(20);

  if (linesError) {
    console.error('❌ Error fetching lines:', linesError.message);
    return;
  }

  if (!allLines || allLines.length === 0) {
    console.log('⚠️  No journal entries found for AR account');
    return;
  }

  // Analyze entries
  let salesCount = 0;
  let paymentsCount = 0;
  let salesDebit = 0;
  let salesCredit = 0;
  let paymentsDebit = 0;
  let paymentsCredit = 0;
  let otherDebit = 0;
  let otherCredit = 0;

  console.log('\nDetailed Entry Analysis:');
  allLines.slice(0, 10).forEach((line, idx) => {
    const entry = line.journal_entry;
    console.log(`\nEntry ${idx + 1}: ${entry?.entry_no || 'N/A'}`);
    console.log(`  Type: ${entry?.reference_type || 'N/A'}, Payment ID: ${entry?.payment_id || 'N/A'}`);
    console.log(`  Description: ${entry?.description || 'N/A'}`);
    console.log(`  Debit: ${line.debit}, Credit: ${line.credit}`);
    
    if (entry?.reference_type === 'sale' && !entry?.payment_id) {
      salesCount++;
      if (line.debit > 0) salesDebit += line.debit;
      if (line.credit > 0) {
        salesCredit += line.credit;
        console.error(`  ❌ Sale ${entry.entry_no} has CREDIT (should be DEBIT)`);
      }
    } else if (entry?.payment_id) {
      paymentsCount++;
      if (line.credit > 0) paymentsCredit += line.credit;
      if (line.debit > 0) {
        paymentsDebit += line.debit;
        console.error(`  ❌ Payment ${entry.entry_no} has DEBIT (should be CREDIT)`);
      }
    } else {
      if (line.debit > 0) otherDebit += line.debit;
      if (line.credit > 0) otherCredit += line.credit;
    }
  });

  console.log(`Sales entries: ${salesCount} (Total DEBIT: ${salesDebit.toFixed(2)})`);
  console.log(`Payment entries: ${paymentsCount} (Total CREDIT: ${paymentsCredit.toFixed(2)})`);
  console.log(`Other entries: DEBIT=${otherDebit.toFixed(2)}, CREDIT=${otherCredit.toFixed(2)}`);

  // Check entry_no
  console.log('\nSTEP 4: Checking entry_no uniqueness...');
  const { data: entries, error: entriesError } = await supabase
    .from('journal_entries')
    .select('entry_no')
    .not('entry_no', 'is', null)
    .neq('entry_no', '');

  if (entriesError) {
    console.error('❌ Error:', entriesError.message);
  } else {
    const entryNoMap = new Map();
    entries?.forEach(e => {
      const count = entryNoMap.get(e.entry_no) || 0;
      entryNoMap.set(e.entry_no, count + 1);
    });

    const duplicates = Array.from(entryNoMap.entries())
      .filter(([_, count]) => count > 1);

    if (duplicates.length > 0) {
      console.error(`❌ Found ${duplicates.length} duplicate entry_no values`);
      duplicates.slice(0, 5).forEach(([entryNo, count]) => {
        console.error(`  - ${entryNo}: appears ${count} times`);
      });
    } else {
      console.log('✅ All entry_no values are unique');
    }
  }

  console.log('\n========================================');
  console.log('VERIFICATION COMPLETE');
  console.log('========================================');
}

main().catch(console.error);
