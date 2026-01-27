/**
 * Check if sale entries exist and are correct
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

async function main() {
  console.log('Checking Sale Journal Entries...\n');

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

  // Check for sale entries (reference_type='sale', no payment_id, no expense description)
  const { data: allLines } = await supabase
    .from('journal_entry_lines')
    .select(`
      debit,
      credit,
      journal_entry:journal_entries(
        id,
        entry_no,
        description,
        reference_type,
        payment_id,
        reference_id
      )
    `)
    .eq('account_id', arAccount.id)
    .order('created_at', { ascending: false })
    .limit(50);

  // Find actual sale entries (not payments, not expenses)
  const saleEntries = allLines?.filter(line => {
    const je = line.journal_entry;
    return je?.reference_type === 'sale' &&
           !je?.payment_id &&
           !je?.description?.toLowerCase().includes('extra expense') &&
           !je?.description?.toLowerCase().includes('discount') &&
           !je?.description?.toLowerCase().includes('commission') &&
           !je?.description?.toLowerCase().includes('payment received');
  }) || [];

  console.log(`Found ${saleEntries.length} actual sale entries (excluding payments/expenses)\n`);

  if (saleEntries.length === 0) {
    console.log('⚠️  No sale entries found!');
    console.log('This means sales are not creating journal entries, or they\'re being created incorrectly.\n');
    
    // Check if sales exist
    const { data: sales } = await supabase
      .from('sales')
      .select('id, invoice_no, total, journal_entry_id')
      .limit(5);
    
    console.log(`Sales in database: ${sales?.length || 0}`);
    sales?.forEach(s => {
      console.log(`  - ${s.invoice_no}: Total ${s.total}, Journal Entry: ${s.journal_entry_id || 'MISSING'}`);
    });
  } else {
    console.log('Sale Entries Analysis:');
    saleEntries.forEach((line, idx) => {
      const je = line.journal_entry;
      const isDebit = line.debit > 0 && line.credit === 0;
      const isCredit = line.credit > 0 && line.debit === 0;
      console.log(`\n${idx + 1}. ${je?.entry_no || 'N/A'}`);
      console.log(`   Description: ${je?.description}`);
      console.log(`   Debit: ${line.debit}, Credit: ${line.credit}`);
      console.log(`   Status: ${isDebit ? '✅ DEBIT (correct)' : isCredit ? '❌ CREDIT (wrong)' : '❌ BOTH/NEITHER (corrupted)'}`);
    });
  }
}

main().catch(console.error);
