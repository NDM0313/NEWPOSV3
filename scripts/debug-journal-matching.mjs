/**
 * Debug Journal Entry Matching
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

async function debug() {
  const customerId = 'b004659d-1c6e-4954-b89f-6d5def451c36';
  const companyId = '5aac3c47-af92-44f4-aa7d-4ca5bd4c135b';

  // Get customer sales
  const { data: sales } = await supabase
    .from('sales')
    .select('id, invoice_no')
    .eq('customer_id', customerId)
    .limit(5);

  console.log('Customer Sales:');
  sales?.forEach(s => console.log(`  ${s.invoice_no}: ${s.id}`));

  // Check journal entries for these sales
  if (sales && sales.length > 0) {
    const saleIds = sales.map(s => s.id);
    console.log('\nJournal Entries for Sales:');
    const { data: saleJournalEntries } = await supabase
      .from('journal_entries')
      .select('id, entry_no, reference_type, reference_id, description')
      .eq('reference_type', 'sale')
      .in('reference_id', saleIds);

    saleJournalEntries?.forEach(je => {
      console.log(`  ${je.entry_no || je.id}: reference_id=${je.reference_id}, description=${je.description}`);
    });
  }

  // Get customer payments
  const saleIds = sales?.map(s => s.id) || [];
  const { data: payments } = await supabase
    .from('payments')
    .select('id, reference_number, reference_id')
    .eq('reference_type', 'sale')
    .in('reference_id', saleIds.length > 0 ? saleIds : ['00000000-0000-0000-0000-000000000000']);

  console.log('\nCustomer Payments:');
  payments?.forEach(p => console.log(`  ${p.reference_number || p.id}: reference_id=${p.reference_id}`));

  // Check journal entries for payments
  if (payments && payments.length > 0) {
    const paymentIds = payments.map(p => p.id);
    console.log('\nJournal Entries for Payments:');
    const { data: paymentJournalEntries } = await supabase
      .from('journal_entries')
      .select('id, entry_no, reference_type, reference_id, payment_id, description')
      .or(`reference_type.eq.payment,payment_id.in.(${paymentIds.join(',')})`);

    paymentJournalEntries?.forEach(je => {
      console.log(`  ${je.entry_no || je.id}: reference_type=${je.reference_type}, reference_id=${je.reference_id}, payment_id=${je.payment_id || 'NULL'}`);
    });
  }

  // Get AR account
  const { data: arAccounts } = await supabase
    .from('accounts')
    .select('id, code')
    .eq('company_id', companyId)
    .or('code.eq.2000,code.eq.1100')
    .limit(1);

  if (arAccounts && arAccounts.length > 0) {
    const arAccountId = arAccounts[0].id;
    console.log(`\nAR Account ID: ${arAccountId}`);

    // Get all AR lines
    const { data: arLines } = await supabase
      .from('journal_entry_lines')
      .select(`
        debit,
        credit,
        journal_entry:journal_entries(
          id,
          entry_no,
          reference_type,
          reference_id,
          payment_id
        )
      `)
      .eq('account_id', arAccountId)
      .limit(20);

    console.log('\nAR Journal Entry Lines (first 20):');
    arLines?.forEach(line => {
      const je = line.journal_entry;
      console.log(`  ${je.entry_no || je.id}: type=${je.reference_type}, ref_id=${je.reference_id || 'N/A'}, payment_id=${je.payment_id || 'NULL'}, debit=${line.debit}, credit=${line.credit}`);
    });
  }
}

debug().catch(console.error);
