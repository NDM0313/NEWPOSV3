/**
 * Final Complete Verification - All Rules
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
  console.log('FINAL COMPLETE VERIFICATION');
  console.log('========================================\n');

  const companyId = '5aac3c47-af92-44f4-aa7d-4ca5bd4c135b';

  // Find DIN COLLECTION
  const { data: customer } = await supabase
    .from('contacts')
    .select('id, name')
    .ilike('name', '%DIN COLLECTION%')
    .limit(1)
    .single();

  if (!customer) {
    console.log('Customer not found');
    return;
  }

  const customerId = customer.id;
  console.log(`Customer: ${customer.name} (${customer.id})\n`);

  // STEP 1: Check Sales
  console.log('STEP 1: SALES (Source of Truth)');
  console.log('----------------------------------------');
  const { data: sales } = await supabase
    .from('sales')
    .select('id, invoice_no, total, paid_amount, due_amount')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });

  console.log(`Total Sales: ${sales?.length || 0}`);
  let totalSalesAmount = 0;
  sales?.forEach(s => {
    totalSalesAmount += s.total || 0;
    console.log(`  ${s.invoice_no}: Total=${s.total}, Paid=${s.paid_amount}, Due=${s.due_amount}`);
  });
  console.log(`Total Sales Amount: ${totalSalesAmount}\n`);

  // STEP 2: Check Payments
  console.log('STEP 2: PAYMENTS');
  console.log('----------------------------------------');
  const saleIds = sales?.map(s => s.id) || [];
  const { data: payments } = await supabase
    .from('payments')
    .select('id, reference_number, amount, payment_method')
    .eq('reference_type', 'sale')
    .in('reference_id', saleIds.length > 0 ? saleIds : ['00000000-0000-0000-0000-000000000000']);

  console.log(`Total Payments: ${payments?.length || 0}`);
  let totalPaymentsAmount = 0;
  payments?.forEach(p => {
    totalPaymentsAmount += p.amount || 0;
    console.log(`  ${p.reference_number || p.id}: Amount=${p.amount}`);
  });
  console.log(`Total Payments Amount: ${totalPaymentsAmount}\n`);

  // STEP 3: Check AR Journal Entries (should NOT have commission)
  console.log('STEP 3: AR JOURNAL ENTRIES (Account 2000)');
  console.log('----------------------------------------');
  const { data: arAccount } = await supabase
    .from('accounts')
    .select('id, code, name')
    .eq('company_id', companyId)
    .eq('code', '2000')
    .single();

  if (!arAccount) {
    console.log('AR account not found');
    return;
  }

  // Get journal entries for customer sales
  const { data: journalEntries } = await supabase
    .from('journal_entries')
    .select('id, entry_no, description, reference_type, reference_id')
    .eq('reference_type', 'sale')
    .in('reference_id', saleIds.length > 0 ? saleIds : ['00000000-0000-0000-0000-000000000000']);

  const jeIds = journalEntries?.map(je => je.id) || [];

  // Get AR lines
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

  console.log(`Total AR Lines: ${arLines?.length || 0}`);

  // Check for commission (SHOULD BE 0)
  const commissionLines = arLines?.filter(l => 
    l.journal_entry?.description?.toLowerCase().includes('commission')
  ) || [];

  console.log(`\n❌ Commission entries in AR: ${commissionLines.length} (SHOULD BE 0)`);
  if (commissionLines.length > 0) {
    console.error('CRITICAL: Commission entries found in AR!');
    commissionLines.forEach(l => {
      console.error(`  ${l.journal_entry?.entry_no}: ${l.journal_entry?.description}`);
    });
  }

  // Group by type
  const saleLines = arLines?.filter(l => 
    l.journal_entry?.reference_type === 'sale' &&
    !l.journal_entry?.description?.toLowerCase().includes('payment') &&
    !l.journal_entry?.description?.toLowerCase().includes('discount') &&
    !l.journal_entry?.description?.toLowerCase().includes('commission') &&
    !l.journal_entry?.description?.toLowerCase().includes('extra expense')
  ) || [];

  const paymentLines = arLines?.filter(l => 
    l.journal_entry?.description?.toLowerCase().includes('payment received')
  ) || [];

  const discountLines = arLines?.filter(l => 
    l.journal_entry?.description?.toLowerCase().includes('discount')
  ) || [];

  const extraExpenseLines = arLines?.filter(l => 
    l.journal_entry?.description?.toLowerCase().includes('extra expense')
  ) || [];

  console.log(`\nAR Entry Breakdown:`);
  console.log(`  Sale entries: ${saleLines.length}`);
  console.log(`  Payment entries: ${paymentLines.length}`);
  console.log(`  Discount entries: ${discountLines.length}`);
  console.log(`  Extra expense entries: ${extraExpenseLines.length}`);
  console.log(`  Commission entries: ${commissionLines.length} ❌ (SHOULD BE 0)`);

  // Calculate totals
  const totalDebit = arLines?.reduce((sum, l) => sum + (l.debit || 0), 0) || 0;
  const totalCredit = arLines?.reduce((sum, l) => sum + (l.credit || 0), 0) || 0;
  const balance = totalDebit - totalCredit;

  console.log(`\nAR Totals:`);
  console.log(`  Total Debit: ${totalDebit}`);
  console.log(`  Total Credit: ${totalCredit}`);
  console.log(`  Balance: ${balance}`);

  // Expected: Balance should match (Sales - Payments - Discounts)
  const totalDiscounts = discountLines.reduce((sum, l) => sum + (l.credit || 0), 0);
  const expectedBalance = totalSalesAmount - totalPaymentsAmount - totalDiscounts;
  
  console.log(`\nExpected Balance Calculation:`);
  console.log(`  Sales: ${totalSalesAmount}`);
  console.log(`  Payments: ${totalPaymentsAmount}`);
  console.log(`  Discounts: ${totalDiscounts}`);
  console.log(`  Expected: ${expectedBalance}`);
  console.log(`  Actual AR: ${balance}`);
  console.log(`  Match: ${Math.abs(expectedBalance - balance) < 0.01 ? '✅' : '❌'}`);

  // Summary
  console.log(`\n========================================`);
  console.log('VERIFICATION SUMMARY');
  console.log('========================================');
  console.log(`✅ Sales found: ${sales?.length || 0}`);
  console.log(`✅ Payments found: ${payments?.length || 0}`);
  console.log(`${commissionLines.length === 0 ? '✅' : '❌'} Commission in AR: ${commissionLines.length} (should be 0)`);
  console.log(`${Math.abs(expectedBalance - balance) < 0.01 ? '✅' : '❌'} Balance match: ${Math.abs(expectedBalance - balance) < 0.01 ? 'YES' : 'NO'}`);
}

verify().catch(console.error);
