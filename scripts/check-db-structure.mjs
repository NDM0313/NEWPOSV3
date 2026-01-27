/**
 * Check Database Structure - Customer Ledger Root Cause
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
  console.log('========================================');
  console.log('DATABASE STRUCTURE CHECK');
  console.log('========================================\n');

  // STEP 1: Check contacts structure
  console.log('STEP 1: Checking contacts structure...');
  const { data: contacts, error: contactsError } = await supabase
    .from('contacts')
    .select('id, uuid, code, name, type')
    .limit(5);

  if (contactsError) {
    console.error('❌ Error:', contactsError.message);
  } else {
    console.log(`✅ Found ${contacts?.length || 0} contacts (sample):`);
    contacts?.forEach(c => {
      console.log(`  - ${c.code || 'N/A'}: ${c.name}`);
      console.log(`    ID: ${c.id}, UUID: ${c.uuid || 'N/A'}, Type: ${c.type || 'N/A'}`);
    });
  }

  // STEP 2: Check sales structure
  console.log('\nSTEP 2: Checking sales structure...');
  const { data: sales, error: salesError } = await supabase
    .from('sales')
    .select('id, invoice_no, customer_id, customer_name, total, paid_amount, due_amount')
    .limit(5);

  if (salesError) {
    console.error('❌ Error:', salesError.message);
  } else {
    console.log(`✅ Found ${sales?.length || 0} sales (sample):`);
    sales?.forEach(s => {
      console.log(`  - ${s.invoice_no || 'N/A'}: Customer ID: ${s.customer_id}, Total: ${s.total}`);
    });
  }

  // STEP 3: Check payments structure
  console.log('\nSTEP 3: Checking payments structure...');
  const { data: payments, error: paymentsError } = await supabase
    .from('payments')
    .select('id, reference_number, contact_id, sale_id, amount, payment_method')
    .limit(5);

  if (paymentsError) {
    console.error('❌ Error:', paymentsError.message);
  } else {
    console.log(`✅ Found ${payments?.length || 0} payments (sample):`);
    payments?.forEach(p => {
      console.log(`  - ${p.reference_number || p.id}: Contact ID: ${p.contact_id}, Amount: ${p.amount}`);
    });
  }

  // STEP 4: Check journal entries structure
  console.log('\nSTEP 4: Checking journal entries structure...');
  const { data: journalEntries, error: jeError } = await supabase
    .from('journal_entries')
    .select('id, entry_no, reference_type, reference_id, payment_id, description')
    .limit(10);

  if (jeError) {
    console.error('❌ Error:', jeError.message);
  } else {
    console.log(`✅ Found ${journalEntries?.length || 0} journal entries (sample):`);
    journalEntries?.forEach(je => {
      console.log(`  - ${je.entry_no || je.id}: Type: ${je.reference_type}, Ref: ${je.reference_id || 'N/A'}, Payment: ${je.payment_id || 'N/A'}`);
    });
  }

  // STEP 5: Check AR account and lines
  console.log('\nSTEP 5: Checking AR account and journal entry lines...');
  const { data: arAccounts } = await supabase
    .from('accounts')
    .select('id, code, name')
    .or('code.eq.2000,code.eq.1100,name.ilike.%Accounts Receivable%')
    .limit(1);

  if (arAccounts && arAccounts.length > 0) {
    const arAccount = arAccounts[0];
    console.log(`✅ AR Account: ${arAccount.name} (${arAccount.code}) - ID: ${arAccount.id}`);

    const { data: lines, error: linesError } = await supabase
      .from('journal_entry_lines')
      .select(`
        id,
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
      .eq('account_id', arAccount.id)
      .limit(10);

    if (linesError) {
      console.error('❌ Error fetching lines:', linesError.message);
    } else {
      console.log(`✅ Found ${lines?.length || 0} AR journal entry lines (sample):`);
      lines?.forEach(l => {
        const je = l.journal_entry;
        console.log(`  - Entry: ${je?.entry_no || je?.id}`);
        console.log(`    Type: ${je?.reference_type}, Ref: ${je?.reference_id || 'N/A'}, Payment: ${je?.payment_id || 'N/A'}`);
        console.log(`    Debit: ${l.debit}, Credit: ${l.credit}`);
      });
    }
  }

  // STEP 6: Check matching - Find a customer and trace their data
  console.log('\nSTEP 6: Checking customer data linkage...');
  if (contacts && contacts.length > 0) {
    const testContact = contacts[0];
    console.log(`\nTesting with contact: ${testContact.name} (UUID: ${testContact.uuid || testContact.id})`);

    // Check sales for this customer
    const customerId = testContact.uuid || testContact.id;
    const { data: customerSales } = await supabase
      .from('sales')
      .select('id, invoice_no, customer_id')
      .eq('customer_id', customerId)
      .limit(5);

    console.log(`  Sales with customer_id=${customerId}: ${customerSales?.length || 0}`);
    customerSales?.forEach(s => {
      console.log(`    - ${s.invoice_no}: customer_id=${s.customer_id}`);
    });

    // Check payments for this customer
    const { data: customerPayments } = await supabase
      .from('payments')
      .select('id, reference_number, contact_id')
      .eq('contact_id', customerId)
      .limit(5);

    console.log(`  Payments with contact_id=${customerId}: ${customerPayments?.length || 0}`);
    customerPayments?.forEach(p => {
      console.log(`    - ${p.reference_number || p.id}: contact_id=${p.contact_id}`);
    });

    // Check if there's a mismatch
    if (customerSales && customerSales.length > 0) {
      const sale = customerSales[0];
      console.log(`\n  Checking journal entry for sale ${sale.invoice_no}...`);
      const { data: saleJournal } = await supabase
        .from('journal_entries')
        .select('id, entry_no, reference_id, reference_type')
        .eq('reference_type', 'sale')
        .eq('reference_id', sale.id)
        .limit(1);

      console.log(`    Journal entries found: ${saleJournal?.length || 0}`);
    }

    if (customerPayments && customerPayments.length > 0) {
      const payment = customerPayments[0];
      console.log(`\n  Checking journal entry for payment ${payment.reference_number || payment.id}...`);
      const { data: paymentJournal } = await supabase
        .from('journal_entries')
        .select('id, entry_no, payment_id')
        .eq('payment_id', payment.id)
        .limit(1);

      console.log(`    Journal entries found: ${paymentJournal?.length || 0}`);
    }
  }

  console.log('\n========================================');
}

main().catch(console.error);
