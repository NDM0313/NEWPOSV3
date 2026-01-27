/**
 * PHASE 7: Final Validation - All Rules Check
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

async function validate() {
  console.log('========================================');
  console.log('PHASE 7: FINAL VALIDATION');
  console.log('========================================\n');

  const companyId = '5aac3c47-af92-44f4-aa7d-4ca5bd4c135b';
  const customerId = 'b004659d-1c6e-4954-b89f-6d5def451c36'; // DIN COLLECTION

  // Get customer sales
  const { data: sales } = await supabase
    .from('sales')
    .select('id, invoice_no, subtotal, total, discount_amount, expenses, paid_amount, due_amount')
    .eq('customer_id', customerId);

  console.log(`Customer Sales: ${sales?.length || 0}`);
  
  let totalSales = 0;
  let totalPaid = 0;
  let totalDue = 0;

  sales?.forEach(s => {
    totalSales += s.total || 0;
    totalPaid += s.paid_amount || 0;
    totalDue += s.due_amount || 0;
    
    // Validate: Sale total = items + expenses - discount (commission NOT included)
    const calculatedTotal = (s.subtotal || 0) + (s.expenses || 0) - (s.discount_amount || 0);
    const match = Math.abs((s.total || 0) - calculatedTotal) < 0.01;
    
    console.log(`  ${s.invoice_no}:`);
    console.log(`    Subtotal: ${s.subtotal || 0}`);
    console.log(`    Expenses: ${s.expenses || 0}`);
    console.log(`    Discount: ${s.discount_amount || 0}`);
    console.log(`    Total: ${s.total || 0}`);
    console.log(`    Calculated: ${calculatedTotal}`);
    console.log(`    Match: ${match ? '✅' : '❌'}`);
  });

  // Get AR account
  const { data: arAccount } = await supabase
    .from('accounts')
    .select('id, code')
    .eq('company_id', companyId)
    .eq('code', '2000')
    .single();

  if (!arAccount) {
    console.log('❌ AR account not found');
    return;
  }

  // Check commission entries in AR (should be 0)
  const saleIds = sales?.map(s => s.id) || [];
  const { data: journalEntries } = await supabase
    .from('journal_entries')
    .select('id')
    .eq('reference_type', 'sale')
    .in('reference_id', saleIds.length > 0 ? saleIds : ['00000000-0000-0000-0000-000000000000']);

  const jeIds = journalEntries?.map(je => je.id) || [];

  const { data: arLines } = await supabase
    .from('journal_entry_lines')
    .select(`
      debit,
      credit,
      journal_entry:journal_entries(description)
    `)
    .eq('account_id', arAccount.id)
    .in('journal_entry_id', jeIds.length > 0 ? jeIds : ['00000000-0000-0000-0000-000000000000']);

  const commissionInAR = arLines?.filter(l => 
    l.journal_entry?.description?.toLowerCase().includes('commission')
  ) || [];

  // Calculate AR totals
  const totalDebit = arLines?.reduce((sum, l) => sum + (l.debit || 0), 0) || 0;
  const totalCredit = arLines?.reduce((sum, l) => sum + (l.credit || 0), 0) || 0;
  const arBalance = totalDebit - totalCredit;

  console.log(`\n========================================`);
  console.log('VALIDATION RESULTS');
  console.log('========================================');
  console.log(`✅ Total Sales: ${totalSales}`);
  console.log(`✅ Total Paid: ${totalPaid}`);
  console.log(`✅ Total Due: ${totalDue}`);
  console.log(`${commissionInAR.length === 0 ? '✅' : '❌'} Commission in AR: ${commissionInAR.length} (should be 0)`);
  console.log(`✅ AR Debit Total: ${totalDebit}`);
  console.log(`✅ AR Credit Total: ${totalCredit}`);
  console.log(`✅ AR Balance: ${arBalance}`);
  console.log(`✅ Expected Balance (Sales - Paid): ${totalSales - totalPaid}`);
  console.log(`✅ Balance Match: ${Math.abs(arBalance - (totalSales - totalPaid)) < 0.01 ? 'YES' : 'NO'}`);
}

validate().catch(console.error);
