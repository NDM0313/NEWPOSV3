/**
 * Check if Commission entries are in AR account (SHOULD NOT BE)
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  console.log('Checking for Commission entries in AR account (2000)...\n');

  const companyId = '5aac3c47-af92-44f4-aa7d-4ca5bd4c135b';

  // Get AR account
  const { data: arAccount } = await supabase
    .from('accounts')
    .select('id, code, name')
    .eq('company_id', companyId)
    .eq('code', '2000')
    .single();

  if (!arAccount) {
    console.log('AR account code 2000 not found');
    return;
  }

  console.log(`AR Account: ${arAccount.name} (${arAccount.code}) - ID: ${arAccount.id}\n`);

  // Get all journal entries with commission in description
  const { data: commissionJournalEntries } = await supabase
    .from('journal_entries')
    .select('id, entry_no, description, reference_type')
    .ilike('description', '%commission%')
    .limit(20);

  console.log(`Journal entries with 'commission' in description: ${commissionJournalEntries?.length || 0}`);

  // Check if any commission entries are linked to AR account
  const jeIds = commissionJournalEntries?.map(je => je.id) || [];
  if (jeIds.length > 0) {
    const { data: arCommissionLines } = await supabase
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
      .in('journal_entry_id', jeIds);

    console.log(`\n❌ COMMISSION ENTRIES IN AR ACCOUNT (SHOULD BE 0): ${arCommissionLines?.length || 0}`);
    
    if (arCommissionLines && arCommissionLines.length > 0) {
      console.error('\nCRITICAL: Commission entries found in AR account!');
      arCommissionLines.forEach(l => {
        const je = l.journal_entry;
        console.error(`  ${je.entry_no || je.id}: ${je.description}`);
        console.error(`    Debit: ${l.debit}, Credit: ${l.credit}`);
      });
    } else {
      console.log('✅ No commission entries in AR account');
    }
  }

  // Also check what accounts commission entries are actually in
  if (jeIds.length > 0) {
    const { data: allCommissionLines } = await supabase
      .from('journal_entry_lines')
      .select(`
        debit,
        credit,
        account:accounts(code, name),
        journal_entry:journal_entries(entry_no, description)
      `)
      .in('journal_entry_id', jeIds)
      .limit(20);

    console.log(`\nCommission entries account breakdown:`);
    const accountMap = new Map();
    allCommissionLines?.forEach(l => {
      const account = l.account;
      const key = `${account.code} - ${account.name}`;
      const count = accountMap.get(key) || 0;
      accountMap.set(key, count + 1);
    });

    accountMap.forEach((count, account) => {
      console.log(`  ${account}: ${count} entries`);
    });
  }
}

check().catch(console.error);
