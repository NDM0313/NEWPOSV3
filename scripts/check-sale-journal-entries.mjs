/**
 * Check why sale journal entries are not in AR lines
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
  const companyId = '5aac3c47-af92-44f4-aa7d-4ca5bd4c135b';
  const customerId = 'b004659d-1c6e-4954-b89f-6d5def451c36';

  // Get customer sales
  const { data: sales } = await supabase
    .from('sales')
    .select('id, invoice_no, total')
    .eq('customer_id', customerId)
    .limit(5);

  console.log('Customer Sales:');
  sales?.forEach(s => {
    console.log(`  ${s.invoice_no}: ${s.id}, Total=${s.total}`);
  });

  const saleIds = sales?.map(s => s.id) || [];
  console.log(`\nSale IDs: ${saleIds.length}`);

  // Get journal entries for these sales
  const { data: journalEntries } = await supabase
    .from('journal_entries')
    .select('id, entry_no, description, reference_type, reference_id')
    .eq('reference_type', 'sale')
    .in('reference_id', saleIds.length > 0 ? saleIds : ['00000000-0000-0000-0000-000000000000']);

  console.log(`\nJournal Entries for Sales: ${journalEntries?.length || 0}`);
  journalEntries?.forEach(je => {
    console.log(`  ${je.entry_no || je.id}: ${je.description}`);
  });

  // Get AR account
  const { data: arAccount } = await supabase
    .from('accounts')
    .select('id, code')
    .eq('company_id', companyId)
    .eq('code', '2000')
    .single();

  if (!arAccount) {
    console.log('AR account not found');
    return;
  }

  // Get ALL journal entry lines for these journal entries
  const jeIds = journalEntries?.map(je => je.id) || [];
  console.log(`\nJournal Entry IDs: ${jeIds.length}`);

  const { data: allLines } = await supabase
    .from('journal_entry_lines')
    .select(`
      debit,
      credit,
      account_id,
      account:accounts(code, name),
      journal_entry:journal_entries(entry_no, description, reference_type)
    `)
    .in('journal_entry_id', jeIds.length > 0 ? jeIds : ['00000000-0000-0000-0000-000000000000']);

  console.log(`\nTotal Journal Entry Lines: ${allLines?.length || 0}`);
  console.log('\nLines by Account:');
  const accountMap = new Map();
  allLines?.forEach(l => {
    const account = l.account;
    const key = `${account.code} - ${account.name}`;
    if (!accountMap.has(key)) {
      accountMap.set(key, []);
    }
    accountMap.get(key).push(l);
  });

  accountMap.forEach((lines, account) => {
    console.log(`\n  ${account}: ${lines.length} entries`);
    lines.slice(0, 3).forEach(l => {
      const je = l.journal_entry;
      console.log(`    ${je.entry_no || 'N/A'}: Debit=${l.debit}, Credit=${l.credit}`);
    });
  });

  // Check AR lines specifically
  const arLines = allLines?.filter(l => l.account_id === arAccount.id) || [];
  console.log(`\nAR Lines (Account 2000): ${arLines.length}`);
  
  // Group AR lines by type
  const saleARLines = arLines.filter(l => 
    l.journal_entry?.reference_type === 'sale' &&
    !l.journal_entry?.description?.toLowerCase().includes('payment') &&
    !l.journal_entry?.description?.toLowerCase().includes('discount') &&
    !l.journal_entry?.description?.toLowerCase().includes('commission') &&
    !l.journal_entry?.description?.toLowerCase().includes('extra expense')
  );

  console.log(`  Sale AR Lines: ${saleARLines.length}`);
  saleARLines.forEach(l => {
    const je = l.journal_entry;
    console.log(`    ${je.entry_no}: ${je.description}, Debit=${l.debit}, Credit=${l.credit}`);
  });
}

check().catch(console.error);
