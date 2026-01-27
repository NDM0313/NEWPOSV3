/**
 * Check Customer Data - Journal Entries, Payments, Sales
 * Replaces direct SQL queries with Supabase client queries
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

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCustomerData(customerIdOrCode) {
  console.log('========================================');
  console.log('CUSTOMER DATA CHECK');
  console.log('========================================\n');
  console.log(`Looking for customer: ${customerIdOrCode}\n`);

  // STEP 1: Find customer by ID or code
  let customer = null;
  
  // Try as UUID first
  const { data: customerById } = await supabase
    .from('contacts')
    .select('id, uuid, code, name, phone')
    .eq('id', customerIdOrCode)
    .or(`uuid.eq.${customerIdOrCode},code.eq.${customerIdOrCode}`)
    .limit(1)
    .single();

  if (customerById) {
    customer = customerById;
  } else {
    // Try by code
    const { data: customerByCode } = await supabase
      .from('contacts')
      .select('id, uuid, code, name, phone')
      .eq('code', customerIdOrCode)
      .limit(1)
      .single();

    if (customerByCode) {
      customer = customerByCode;
    }
  }

  if (!customer) {
    console.error(`❌ Customer not found: ${customerIdOrCode}`);
    console.log('\nAvailable customers (first 20):');
    const { data: customers } = await supabase
      .from('contacts')
      .select('id, uuid, code, name, phone')
      .order('created_at', { ascending: false })
      .limit(20);
    
    if (customers && customers.length > 0) {
      customers.forEach(c => {
        console.log(`  - ${c.code || 'N/A'}: ${c.name || 'N/A'} (UUID: ${c.uuid || c.id})`);
      });
    } else {
      console.log('  No customers found in database');
    }
    console.log('\nUsage: node scripts/check-customer-data.mjs <CUSTOMER_UUID_OR_CODE>');
    return;
  }

  console.log(`✅ Found customer: ${customer.name}`);
  console.log(`   ID: ${customer.id}`);
  console.log(`   UUID: ${customer.uuid}`);
  console.log(`   Code: ${customer.code || 'N/A'}\n`);

  const customerUuid = customer.uuid || customer.id;

  // STEP 2: Check Sales
  console.log('========================================');
  console.log('STEP 2: CHECK SALES');
  console.log('========================================\n');

  const { data: sales, error: salesError } = await supabase
    .from('sales')
    .select('id, invoice_no, total, paid_amount, due_amount, customer_id, journal_entry_id, created_at')
    .eq('customer_id', customerUuid)
    .order('created_at', { ascending: false })
    .limit(20);

  if (salesError) {
    console.error('❌ Error fetching sales:', salesError.message);
  } else {
    console.log(`Found ${sales?.length || 0} sales:\n`);
    sales?.forEach(s => {
      console.log(`  Invoice: ${s.invoice_no}`);
      console.log(`    Total: ${s.total}, Paid: ${s.paid_amount}, Due: ${s.due_amount}`);
      console.log(`    Journal Entry: ${s.journal_entry_id || 'MISSING'}`);
      console.log('');
    });
  }

  // STEP 3: Check Payments
  console.log('========================================');
  console.log('STEP 3: CHECK PAYMENTS');
  console.log('========================================\n');

  const { data: payments, error: paymentsError } = await supabase
    .from('payments')
    .select('id, reference_number, amount, contact_id, journal_entry_id, created_at')
    .eq('contact_id', customerUuid)
    .order('created_at', { ascending: false })
    .limit(20);

  if (paymentsError) {
    console.error('❌ Error fetching payments:', paymentsError.message);
  } else {
    console.log(`Found ${payments?.length || 0} payments:\n`);
    payments?.forEach(p => {
      console.log(`  Reference: ${p.reference_number || p.id}`);
      console.log(`    Amount: ${p.amount}`);
      console.log(`    Journal Entry: ${p.journal_entry_id || 'MISSING'}`);
      console.log('');
    });
  }

  // STEP 4: Check Journal Entries (via AR account)
  console.log('========================================');
  console.log('STEP 4: CHECK JOURNAL ENTRIES (AR Account)');
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

  // Get journal entries linked to this customer via sales or payments
  const { data: journalEntries, error: jeError } = await supabase
    .from('journal_entries')
    .select(`
      id,
      entry_no,
      entry_date,
      description,
      reference_type,
      reference_id,
      payment_id,
      journal_entry_lines!inner(
        debit,
        credit,
        account:accounts!inner(id, code)
      )
    `)
    .eq('journal_entry_lines.account.id', arAccount.id)
    .order('entry_date', { ascending: false })
    .limit(50);

  if (jeError) {
    console.error('❌ Error fetching journal entries:', jeError.message);
  } else {
    // Filter entries related to this customer
    const customerEntries = [];
    
    for (const je of journalEntries || []) {
      let isCustomerEntry = false;
      
      // Check if linked to customer's sale
      if (je.reference_type === 'sale' && je.reference_id) {
        const sale = sales?.find(s => s.id === je.reference_id);
        if (sale) isCustomerEntry = true;
      }
      
      // Check if linked to customer's payment
      if (je.payment_id) {
        const payment = payments?.find(p => p.id === je.payment_id);
        if (payment) isCustomerEntry = true;
      }
      
      if (isCustomerEntry) {
        customerEntries.push(je);
      }
    }

    console.log(`Found ${customerEntries.length} journal entries for this customer:\n`);
    customerEntries.forEach(je => {
      const line = je.journal_entry_lines?.[0];
      console.log(`  Entry: ${je.entry_no || je.id}`);
      console.log(`    Date: ${je.entry_date}`);
      console.log(`    Description: ${je.description}`);
      console.log(`    Debit: ${line?.debit || 0}, Credit: ${line?.credit || 0}`);
      console.log(`    Type: ${je.reference_type}, Payment ID: ${je.payment_id || 'N/A'}`);
      console.log('');
    });
  }

  // STEP 5: Summary
  console.log('========================================');
  console.log('SUMMARY');
  console.log('========================================\n');
  console.log(`Customer: ${customer.name}`);
  console.log(`Sales: ${sales?.length || 0}`);
  console.log(`Payments: ${payments?.length || 0}`);
  console.log(`Journal Entries: ${customerEntries?.length || 0}`);
  console.log('\n========================================');
}

// Get customer ID from command line or use default
const customerId = process.argv[2] || 'CUS-018';
checkCustomerData(customerId).catch(console.error);
