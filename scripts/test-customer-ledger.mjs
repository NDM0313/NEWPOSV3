/**
 * Test Customer Ledger Fix
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

async function testCustomerLedger() {
  console.log('Testing Customer Ledger Logic...\n');

  // Get a customer
  const { data: customers } = await supabase
    .from('contacts')
    .select('id, name, type')
    .eq('type', 'customer')
    .limit(1);

  if (!customers || customers.length === 0) {
    console.log('No customers found');
    return;
  }

  const customer = customers[0];
  const customerId = customer.id;
  console.log(`Testing with customer: ${customer.name} (ID: ${customerId})\n`);

  // Get company_id (from first customer)
  const companyId = customer.company_id || '5aac3c47-af92-44f4-aa7d-4ca5bd4c135b';

  // Get AR account
  const { data: arAccounts } = await supabase
    .from('accounts')
    .select('id, code, name')
    .eq('company_id', companyId)
    .or('code.eq.2000,code.eq.1100,name.ilike.%Accounts Receivable%')
    .limit(1);

  if (!arAccounts || arAccounts.length === 0) {
    console.log('AR account not found');
    return;
  }

  const arAccountId = arAccounts[0].id;
  console.log(`AR Account: ${arAccounts[0].name} (${arAccounts[0].code})\n`);

  // Get journal entry lines for AR
  const { data: lines } = await supabase
    .from('journal_entry_lines')
    .select(`
      *,
      journal_entry:journal_entries(
        id,
        entry_no,
        entry_date,
        description,
        reference_type,
        reference_id,
        payment_id
      )
    `)
    .eq('account_id', arAccountId)
    .order('created_at', { ascending: true });

  console.log(`Total AR journal entry lines: ${lines?.length || 0}\n`);

  // Get customer sales
  const { data: customerSales } = await supabase
    .from('sales')
    .select('id, invoice_no, customer_id')
    .eq('company_id', companyId)
    .eq('customer_id', customerId);

  console.log(`Customer sales: ${customerSales?.length || 0}`);
  customerSales?.forEach(s => {
    console.log(`  - ${s.invoice_no}: ${s.id}`);
  });

  // Get customer payments (via sales)
  const saleIds = customerSales?.map(s => s.id) || [];
  const { data: customerPayments } = await supabase
    .from('payments')
    .select('id, reference_number, reference_id, reference_type')
    .eq('company_id', companyId)
    .eq('reference_type', 'sale')
    .in('reference_id', saleIds.length > 0 ? saleIds : ['00000000-0000-0000-0000-000000000000']);

  console.log(`\nCustomer payments: ${customerPayments?.length || 0}`);
  customerPayments?.forEach(p => {
    console.log(`  - ${p.reference_number || p.id}: Sale ${p.reference_id}`);
  });

  // Filter lines
  const salesMap = new Map();
  customerSales?.forEach(s => salesMap.set(s.id, s));

  const paymentIds = customerPayments?.map(p => p.id) || [];
  const paymentDetailsMap = new Map();
  customerPayments?.forEach(p => paymentDetailsMap.set(p.id, p));

  const customerLines = (lines || []).filter((line) => {
    const entry = line.journal_entry;
    if (!entry) return false;

    // Check sale entries
    if (entry.reference_type === 'sale' && entry.reference_id) {
      const sale = salesMap.get(entry.reference_id);
      if (sale && sale.customer_id === customerId) {
        return true;
      }
    }

    // Check payment entries
    if (entry.reference_type === 'payment' && entry.reference_id) {
      if (paymentIds.includes(entry.reference_id)) {
        return true;
      }
      const payment = paymentDetailsMap.get(entry.reference_id);
      if (payment && payment.reference_id) {
        const sale = salesMap.get(payment.reference_id);
        if (sale && sale.customer_id === customerId) {
          return true;
        }
      }
    }

    return false;
  }) || [];

  console.log(`\nFiltered customer lines: ${customerLines.length}`);
  customerLines.forEach((line) => {
    const entry = line.journal_entry;
    console.log(`  - ${entry.entry_no || entry.id}: ${entry.description}`);
    console.log(`    Type: ${entry.reference_type}, Debit: ${line.debit}, Credit: ${line.credit}`);
  });

  // Calculate totals
  const totalDebit = customerLines.reduce((sum, l) => sum + (l.debit || 0), 0);
  const totalCredit = customerLines.reduce((sum, l) => sum + (l.credit || 0), 0);
  const finalBalance = totalDebit - totalCredit;

  console.log(`\nTotals:`);
  console.log(`  Debit: ${totalDebit}`);
  console.log(`  Credit: ${totalCredit}`);
  console.log(`  Balance: ${finalBalance}`);
}

testCustomerLedger().catch(console.error);
