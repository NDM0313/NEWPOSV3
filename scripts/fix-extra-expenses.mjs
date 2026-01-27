/**
 * Fix Extra Expense Journal Entries
 * Swaps CREDIT to DEBIT for AR account entries
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read .env.local
const envPath = join(__dirname, '../.env.local');
const envContent = readFileSync(envPath, 'utf-8');

const envVars = {};
envContent.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return;
  const match = trimmed.match(/^([^#=]+)=(.*)$/);
  if (match) {
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || 
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    envVars[match[1].trim()] = value;
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
  console.log('FIXING EXTRA EXPENSE ENTRIES');
  console.log('========================================\n');

  // Get AR account
  const { data: arAccounts } = await supabase
    .from('accounts')
    .select('id, code, name')
    .or('code.eq.2000,code.eq.1100,name.ilike.%Accounts Receivable%')
    .limit(1);
  
  const arAccount = arAccounts?.[0];

  if (!arAccount) {
    console.error('❌ AR account not found');
    return;
  }

  // Find extra expense entries with CREDIT (WRONG)
  const { data: wrongEntries, error: findError } = await supabase
    .from('journal_entry_lines')
    .select(`
      id,
      debit,
      credit,
      journal_entry:journal_entries(
        id,
        entry_no,
        description,
        reference_type,
        payment_id
      )
    `)
    .eq('account_id', arAccount.id)
    .gt('credit', 0)
    .eq('debit', 0);

  if (findError) {
    console.error('❌ Error:', findError.message);
    return;
  }

  // Filter for extra expenses
  const extraExpenses = wrongEntries?.filter(entry => {
    const je = entry.journal_entry;
    return je?.description?.toLowerCase().includes('extra expense') &&
           je?.reference_type === 'sale' &&
           !je?.payment_id;
  }) || [];

  if (extraExpenses.length === 0) {
    console.log('✅ No extra expense entries to fix');
    return;
  }

  console.log(`Found ${extraExpenses.length} extra expense entries with CREDIT (should be DEBIT)\n`);

  // Fix each entry
  let fixed = 0;
  for (const entry of extraExpenses) {
    const je = entry.journal_entry;
    console.log(`Fixing ${je?.entry_no}: Credit ${entry.credit} → Debit ${entry.credit}`);
    
    const { error: updateError } = await supabase
      .from('journal_entry_lines')
      .update({
        debit: entry.credit,
        credit: 0
      })
      .eq('id', entry.id);

    if (updateError) {
      console.error(`  ❌ Error: ${updateError.message}`);
    } else {
      fixed++;
      console.log(`  ✅ Fixed`);
    }
  }

  console.log(`\n✅ Fixed ${fixed} out of ${extraExpenses.length} entries`);
  
  // Verify
  console.log('\nVerifying fix...');
  const { data: verify } = await supabase
    .from('journal_entry_lines')
    .select('debit, credit, journal_entry:journal_entries(entry_no, description)')
    .eq('account_id', arAccount.id)
    .in('journal_entry_id', extraExpenses.map(e => e.journal_entry.id));

  const stillWrong = verify?.filter(v => v.credit > 0 && v.debit === 0) || [];
  if (stillWrong.length > 0) {
    console.error(`❌ ${stillWrong.length} entries still have CREDIT`);
  } else {
    console.log('✅ All extra expense entries are now DEBIT');
  }
}

main().catch(console.error);
