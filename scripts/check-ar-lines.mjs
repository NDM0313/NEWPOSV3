/**
 * Check AR Lines - Find why they're not matching
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
  const customerId = 'b004659d-1c6e-4954-b89f-6d5def451c36';
  const companyId = '5aac3c47-af92-44f4-aa7d-4ca5bd4c135b';

  // Get customer sales
  const { data: customerSales } = await supabase
    .from('sales')
    .select('id, invoice_no')
    .eq('customer_id', customerId)
    .limit(3);

  const saleIds = customerSales?.map(s => s.id) || [];
  console.log('Customer Sales:', saleIds);

  // Get journal entries for these sales
  const { data: saleJournalEntries } = await supabase
    .from('journal_entries')
    .select('id, entry_no, reference_id')
    .eq('reference_type', 'sale')
    .in('reference_id', saleIds.length > 0 ? saleIds : ['00000000-0000-0000-0000-000000000000'])
    .limit(5);

  const jeIds = saleJournalEntries?.map(je => je.id) || [];
  console.log(`\nJournal Entry IDs: ${jeIds.length}`);

  // Get ALL journal entry lines for these journal entries
  const { data: allLines } = await supabase
    .from('journal_entry_lines')
    .select(`
      debit,
      credit,
      account_id,
      account:accounts(id, code, name),
      journal_entry:journal_entries(id, entry_no)
    `)
    .in('journal_entry_id', jeIds.length > 0 ? jeIds : ['00000000-0000-0000-0000-000000000000']);

  console.log(`\nTotal Journal Entry Lines: ${allLines?.length || 0}`);
  allLines?.forEach(line => {
    const account = line.account;
    console.log(`  ${line.journal_entry.entry_no || line.journal_entry.id}: Account=${account.code || account.id} (${account.name}), Debit=${line.debit}, Credit=${line.credit}`);
  });

  // Get AR account
  const { data: arAccounts } = await supabase
    .from('accounts')
    .select('id, code, name')
    .eq('company_id', companyId)
    .or('code.eq.2000,code.eq.1100')
    .limit(1);

  const arAccountId = arAccounts?.[0]?.id;
  console.log(`\nAR Account: ${arAccounts?.[0]?.name} (${arAccounts?.[0]?.code}) - ID: ${arAccountId}`);

  // Check if any lines are linked to AR
  const arLines = allLines?.filter(l => l.account_id === arAccountId) || [];
  console.log(`\nAR Lines: ${arLines.length}`);
  arLines.forEach(line => {
    console.log(`  ${line.journal_entry.entry_no || line.journal_entry.id}: Debit=${line.debit}, Credit=${line.credit}`);
  });
}

check().catch(console.error);
