/**
 * Direct SQL Verification - Customer Ledger Data
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

async function verify() {
  console.log('========================================');
  console.log('CUSTOMER LEDGER SQL VERIFICATION');
  console.log('========================================\n');

  // Find DIN COLLECTION customer
  const { data: customer } = await supabase
    .from('contacts')
    .select('id, name, code')
    .ilike('name', '%DIN COLLECTION%')
    .limit(1)
    .single();

  if (!customer) {
    console.log('Customer not found');
    return;
  }

  const customerId = customer.id;
  console.log(`Customer: ${customer.name} (${customer.code || 'N/A'})`);
  console.log(`Customer ID: ${customerId}\n`);

  const companyId = '5aac3c47-af92-44f4-aa7d-4ca5bd4c135b';

  // STEP 1: Check Sales
  console.log('STEP 1: SALES CHECK');
  console.log('----------------------------------------');
  const { data: sales } = await supabase
    .from('sales')
    .select('id, invoice_no, total, grand_total, paid_amount, due_amount, customer_id')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });

  console.log(`Total Sales: ${sales?.length || 0}`);
  let totalSalesAmount = 0;
  sales?.forEach(s => {
    const amount = s.grand_total || s.total || 0;
    totalSalesAmount += amount;
    console.log(`  ${s.invoice_no}: Total=${s.total}, Grand Total=${s.grand_total || 'N/A'}, Due=${s.due_amount}`);
  });
  console.log(`Total Sales Amount: ${totalSalesAmount}\n`);

  // STEP 2: Check Payments
  console.log('STEP 2: PAYMENTS CHECK');
  console.log('----------------------------------------');
  const saleIds = sales?.map(s => s.id) || [];
  const { data: payments } = await supabase
    .from('payments')
    .select('id, reference_number, amount, payment_method, reference_id')
    .eq('reference_type', 'sale')
    .in('reference_id', saleIds.length > 0 ? saleIds : ['00000000-0000-0000-0000-000000000000']);

  console.log(`Total Payments: ${payments?.length || 0}`);
  let totalPaymentsAmount = 0;
  payments?.forEach(p => {
    totalPaymentsAmount += p.amount || 0;
    console.log(`  ${p.reference_number || p.id}: Amount=${p.amount}, Method=${p.payment_method}`);
  });
  console.log(`Total Payments Amount: ${totalPaymentsAmount}\n`);

  // STEP 3: Check AR Journal Entries (should NOT have commission)
  console.log('STEP 3: AR JOURNAL ENTRIES CHECK (Account 2000)');
  console.log('----------------------------------------');
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

  // Get journal entries for customer sales
  const { data: journalEntries } = await supabase
    .from('journal_entries')
    .select('id, entry_no, description, reference_type, reference_id')
    .eq('reference_type', 'sale')
    .in('reference_id', saleIds.length > 0 ? saleIds : ['00000000-0000-0000-0000-000000000000']);

  const jeIds = journalEntries?.map(je => je.id) || [];

  // Get AR lines for these journal entries
  const { data: arLines } = await supabase
    .from('journal_entry_lines')
    .select(`
      debit,
      credit,
      journal_entry:journal_entries(
        id,
        entry_no,
        description,
        reference_type
      )
    `)
    .eq('account_id', arAccount.id)
    .in('journal_entry_id', jeIds.length > 0 ? jeIds : ['00000000-0000-0000-0000-000000000000']);

  console.log(`AR Journal Entry Lines: ${arLines?.length || 0}`);
  
  // Check for commission entries (SHOULD NOT EXIST)
  const commissionEntries = arLines?.filter(l => 
    l.journal_entry?.description?.toLowerCase().includes('commission')
  ) || [];

  console.log(`\n❌ COMMISSION ENTRIES IN AR (SHOULD BE 0): ${commissionEntries.length}`);
  if (commissionEntries.length > 0) {
    console.error('CRITICAL: Commission entries found in AR account!');
    commissionEntries.forEach(l => {
      console.error(`  ${l.journal_entry?.entry_no}: ${l.journal_entry?.description}`);
      console.error(`    Debit: ${l.debit}, Credit: ${l.credit}`);
    });
  } else {
    console.log('✅ No commission entries in AR account');
  }

  // Group by type
  const saleEntries = arLines?.filter(l => 
    l.journal_entry?.reference_type === 'sale' && 
    !l.journal_entry?.description?.toLowerCase().includes('payment') &&
    !l.journal_entry?.description?.toLowerCase().includes('discount') &&
    !l.journal_entry?.description?.toLowerCase().includes('commission') &&
    !l.journal_entry?.description?.toLowerCase().includes('extra expense')
  ) || [];

  const paymentEntries = arLines?.filter(l => 
    l.journal_entry?.description?.toLowerCase().includes('payment received')
  ) || [];

  const discountEntries = arLines?.filter(l => 
    l.journal_entry?.description?.toLowerCase().includes('discount')
  ) || [];

  const extraExpenseEntries = arLines?.filter(l => 
    l.journal_entry?.description?.toLowerCase().includes('extra expense')
  ) || [];

  console.log(`\nAR Entry Breakdown:`);
  console.log(`  Sale entries: ${saleEntries.length}`);
  console.log(`  Payment entries: ${paymentEntries.length}`);
  console.log(`  Discount entries: ${discountEntries.length}`);
  console.log(`  Extra expense entries: ${extraExpenseEntries.length}`);
  console.log(`  Commission entries: ${commissionEntries.length} (SHOULD BE 0)`);

  // Calculate totals
  const totalDebit = arLines?.reduce((sum, l) => sum + (l.debit || 0), 0) || 0;
  const totalCredit = arLines?.reduce((sum, l) => sum + (l.credit || 0), 0) || 0;
  const balance = totalDebit - totalCredit;

  console.log(`\nAR Totals:`);
  console.log(`  Total Debit: ${totalDebit}`);
  console.log(`  Total Credit: ${totalCredit}`);
  console.log(`  Balance: ${balance}`);

  // Expected: Balance should match (Sales - Payments - Discounts)
  const expectedBalance = totalSalesAmount - totalPaymentsAmount;
  console.log(`\nExpected Balance (Sales - Payments): ${expectedBalance}`);
  console.log(`Actual AR Balance: ${balance}`);
  console.log(`Match: ${Math.abs(expectedBalance - balance) < 0.01 ? '✅' : '❌'}`);
}

verify().catch(console.error);
