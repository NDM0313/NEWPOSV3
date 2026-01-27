/**
 * PHASE 1 & 2: Verify Accounting Rules and Database Integrity
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
  console.log('PHASE 1 & 2: ACCOUNTING RULES & DB CHECK');
  console.log('========================================\n');

  const companyId = '5aac3c47-af92-44f4-aa7d-4ca5bd4c135b';
  const customerId = 'b004659d-1c6e-4954-b89f-6d5def451c36'; // DIN COLLECTION

  // PHASE 2.1: Check Journal Entries
  console.log('PHASE 2.1: JOURNAL ENTRIES CHECK');
  console.log('----------------------------------------');

  // Get AR account
  const { data: arAccount } = await supabase
    .from('accounts')
    .select('id, code, name')
    .eq('company_id', companyId)
    .eq('code', '2000')
    .single();

  if (!arAccount) {
    console.log('❌ AR account (2000) not found');
    return;
  }

  // Get all AR journal entry lines for this customer
  const { data: customerSales } = await supabase
    .from('sales')
    .select('id')
    .eq('customer_id', customerId);

  const saleIds = customerSales?.map(s => s.id) || [];

  const { data: journalEntries } = await supabase
    .from('journal_entries')
    .select('id, entry_no, description, reference_type, reference_id')
    .eq('reference_type', 'sale')
    .in('reference_id', saleIds.length > 0 ? saleIds : ['00000000-0000-0000-0000-000000000000']);

  const jeIds = journalEntries?.map(je => je.id) || [];

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

  // Check for violations
  const bothNonZero = arLines?.filter(l => (l.debit || 0) > 0 && (l.credit || 0) > 0) || [];
  const commissionEntries = arLines?.filter(l => 
    l.journal_entry?.description?.toLowerCase().includes('commission')
  ) || [];

  console.log(`\n❌ Entries with BOTH debit and credit > 0: ${bothNonZero.length}`);
  if (bothNonZero.length > 0) {
    bothNonZero.forEach(l => {
      console.error(`  ${l.journal_entry?.entry_no}: Debit=${l.debit}, Credit=${l.credit}`);
    });
  }

  console.log(`\n❌ Commission entries in AR: ${commissionEntries.length} (SHOULD BE 0)`);
  if (commissionEntries.length > 0) {
    commissionEntries.forEach(l => {
      console.error(`  ${l.journal_entry?.entry_no}: ${l.journal_entry?.description}`);
      console.error(`    Debit: ${l.debit}, Credit: ${l.credit}`);
    });
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

  console.log(`\nEntry Breakdown:`);
  console.log(`  Sale entries (DEBIT): ${saleEntries.length}`);
  console.log(`  Payment entries (CREDIT): ${paymentEntries.length}`);
  console.log(`  Discount entries (CREDIT): ${discountEntries.length}`);
  console.log(`  Extra expense entries (DEBIT): ${extraExpenseEntries.length}`);
  console.log(`  Commission entries (SHOULD BE 0): ${commissionEntries.length} ❌`);

  // Verify debit/credit rules
  const saleDebitViolations = saleEntries.filter(l => (l.debit || 0) === 0 && (l.credit || 0) > 0);
  const paymentCreditViolations = paymentEntries.filter(l => (l.credit || 0) === 0 && (l.debit || 0) > 0);
  const discountCreditViolations = discountEntries.filter(l => (l.credit || 0) === 0 && (l.debit || 0) > 0);
  const extraExpenseDebitViolations = extraExpenseEntries.filter(l => (l.debit || 0) === 0 && (l.credit || 0) > 0);

  console.log(`\nDebit/Credit Rule Violations:`);
  console.log(`  Sales with CREDIT (should be DEBIT): ${saleDebitViolations.length}`);
  console.log(`  Payments with DEBIT (should be CREDIT): ${paymentCreditViolations.length}`);
  console.log(`  Discounts with DEBIT (should be CREDIT): ${discountCreditViolations.length}`);
  console.log(`  Extra Expenses with CREDIT (should be DEBIT): ${extraExpenseDebitViolations.length}`);

  // Summary
  console.log(`\n========================================`);
  console.log('VERIFICATION SUMMARY');
  console.log('========================================');
  console.log(`${bothNonZero.length === 0 ? '✅' : '❌'} Both debit+credit non-zero: ${bothNonZero.length}`);
  console.log(`${commissionEntries.length === 0 ? '✅' : '❌'} Commission in AR: ${commissionEntries.length}`);
  console.log(`${saleDebitViolations.length === 0 ? '✅' : '❌'} Sale debit violations: ${saleDebitViolations.length}`);
  console.log(`${paymentCreditViolations.length === 0 ? '✅' : '❌'} Payment credit violations: ${paymentCreditViolations.length}`);
  console.log(`${discountCreditViolations.length === 0 ? '✅' : '❌'} Discount credit violations: ${discountCreditViolations.length}`);
  console.log(`${extraExpenseDebitViolations.length === 0 ? '✅' : '❌'} Extra expense debit violations: ${extraExpenseDebitViolations.length}`);
}

verify().catch(console.error);
