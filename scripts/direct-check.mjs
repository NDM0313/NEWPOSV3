/**
 * Direct Check - Compare Journal Entries with Sales
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
    .select('id, invoice_no, customer_id')
    .eq('company_id', companyId)
    .eq('customer_id', customerId);

  console.log('Customer Sales:');
  const saleIds = customerSales?.map(s => s.id) || [];
  customerSales?.forEach(s => {
    console.log(`  ${s.invoice_no}: ${s.id}`);
  });

  // Get AR account
  const { data: arAccounts } = await supabase
    .from('accounts')
    .select('id, code')
    .eq('company_id', companyId)
    .or('code.eq.2000,code.eq.1100')
    .limit(1);

  const arAccountId = arAccounts?.[0]?.id;
  if (!arAccountId) {
    console.log('AR account not found');
    return;
  }

  // Get journal entries for sales
  console.log('\nJournal Entries for Sales:');
  const { data: saleJournalEntries } = await supabase
    .from('journal_entries')
    .select('id, entry_no, reference_type, reference_id, payment_id, description')
    .eq('reference_type', 'sale')
    .in('reference_id', saleIds.length > 0 ? saleIds : ['00000000-0000-0000-0000-000000000000']);

  console.log(`Found ${saleJournalEntries?.length || 0} journal entries`);
  saleJournalEntries?.forEach(je => {
    const isInSaleIds = saleIds.includes(je.reference_id);
    console.log(`  ${je.entry_no || je.id}: ref_id=${je.reference_id}, in_sale_ids=${isInSaleIds}, payment_id=${je.payment_id || 'NULL'}`);
  });

  // Get AR lines for these journal entries
  const jeIds = saleJournalEntries?.map(je => je.id) || [];
  if (jeIds.length > 0) {
    console.log('\nAR Journal Entry Lines:');
    const { data: arLines } = await supabase
      .from('journal_entry_lines')
      .select(`
        debit,
        credit,
        journal_entry:journal_entries(
          id,
          entry_no,
          reference_type,
          reference_id
        )
      `)
      .eq('account_id', arAccountId)
      .in('journal_entry_id', jeIds)
      .limit(20);

    console.log(`Found ${arLines?.length || 0} AR lines`);
    arLines?.forEach(line => {
      const je = line.journal_entry;
      console.log(`  ${je.entry_no || je.id}: debit=${line.debit}, credit=${line.credit}`);
    });
  }
}

check().catch(console.error);
