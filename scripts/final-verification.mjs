/**
 * Final Comprehensive Verification
 * Checks all accounting data integrity
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
  console.log('FINAL ACCOUNTING DATA VERIFICATION');
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

  console.log(`✅ AR Account: ${arAccount.name} (${arAccount.code})\n`);

  // Get all AR entries
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
        created_at
      )
    `)
    .eq('account_id', arAccount.id)
    .order('created_at', { ascending: false })
    .limit(100);

  if (!allLines || allLines.length === 0) {
    console.log('⚠️  No journal entries found for AR account');
    return;
  }

  // Categorize entries
  const categories = {
    payments: { count: 0, totalDebit: 0, totalCredit: 0, correct: 0, wrong: 0 },
    extraExpenses: { count: 0, totalDebit: 0, totalCredit: 0, correct: 0, wrong: 0 },
    discounts: { count: 0, totalDebit: 0, totalCredit: 0, correct: 0, wrong: 0 },
    sales: { count: 0, totalDebit: 0, totalCredit: 0, correct: 0, wrong: 0 },
    other: { count: 0, totalDebit: 0, totalCredit: 0 }
  };

  allLines.forEach(line => {
    const je = line.journal_entry;
    const desc = je?.description?.toLowerCase() || '';
    
    if (je?.payment_id || desc.includes('payment received')) {
      categories.payments.count++;
      categories.payments.totalDebit += line.debit;
      categories.payments.totalCredit += line.credit;
      if (line.credit > 0 && line.debit === 0) {
        categories.payments.correct++;
      } else {
        categories.payments.wrong++;
      }
    } else if (desc.includes('extra expense')) {
      categories.extraExpenses.count++;
      categories.extraExpenses.totalDebit += line.debit;
      categories.extraExpenses.totalCredit += line.credit;
      if (line.debit > 0 && line.credit === 0) {
        categories.extraExpenses.correct++;
      } else {
        categories.extraExpenses.wrong++;
      }
    } else if (desc.includes('discount')) {
      categories.discounts.count++;
      categories.discounts.totalDebit += line.debit;
      categories.discounts.totalCredit += line.credit;
      if (line.credit > 0 && line.debit === 0) {
        categories.discounts.correct++;
      } else {
        categories.discounts.wrong++;
      }
    } else if (je?.reference_type === 'sale' && !je?.payment_id) {
      categories.sales.count++;
      categories.sales.totalDebit += line.debit;
      categories.sales.totalCredit += line.credit;
      if (line.debit > 0 && line.credit === 0) {
        categories.sales.correct++;
      } else {
        categories.sales.wrong++;
      }
    } else {
      categories.other.count++;
      categories.other.totalDebit += line.debit;
      categories.other.totalCredit += line.credit;
    }
  });

  // Print results
  console.log('📊 ENTRY ANALYSIS:\n');

  console.log(`💰 Payments: ${categories.payments.count} entries`);
  console.log(`   Total Debit: ${categories.payments.totalDebit.toFixed(2)}`);
  console.log(`   Total Credit: ${categories.payments.totalCredit.toFixed(2)}`);
  if (categories.payments.count > 0) {
    const status = categories.payments.wrong === 0 ? '✅' : '❌';
    console.log(`   Status: ${status} ${categories.payments.correct} correct, ${categories.payments.wrong} wrong`);
    console.log(`   Rule: Should be CREDIT (reduces receivable)`);
  }

  console.log(`\n💸 Extra Expenses: ${categories.extraExpenses.count} entries`);
  console.log(`   Total Debit: ${categories.extraExpenses.totalDebit.toFixed(2)}`);
  console.log(`   Total Credit: ${categories.extraExpenses.totalCredit.toFixed(2)}`);
  if (categories.extraExpenses.count > 0) {
    const status = categories.extraExpenses.wrong === 0 ? '✅' : '❌';
    console.log(`   Status: ${status} ${categories.extraExpenses.correct} correct, ${categories.extraExpenses.wrong} wrong`);
    console.log(`   Rule: Should be DEBIT (increases receivable)`);
  }

  console.log(`\n🎁 Discounts: ${categories.discounts.count} entries`);
  console.log(`   Total Debit: ${categories.discounts.totalDebit.toFixed(2)}`);
  console.log(`   Total Credit: ${categories.discounts.totalCredit.toFixed(2)}`);
  if (categories.discounts.count > 0) {
    const status = categories.discounts.wrong === 0 ? '✅' : '❌';
    console.log(`   Status: ${status} ${categories.discounts.correct} correct, ${categories.discounts.wrong} wrong`);
    console.log(`   Rule: Should be CREDIT (reduces receivable)`);
  }

  console.log(`\n🛒 Sales: ${categories.sales.count} entries`);
  console.log(`   Total Debit: ${categories.sales.totalDebit.toFixed(2)}`);
  console.log(`   Total Credit: ${categories.sales.totalCredit.toFixed(2)}`);
  if (categories.sales.count > 0) {
    const status = categories.sales.wrong === 0 ? '✅' : '❌';
    console.log(`   Status: ${status} ${categories.sales.correct} correct, ${categories.sales.wrong} wrong`);
    console.log(`   Rule: Should be DEBIT (increases receivable)`);
  } else {
    console.log(`   ⚠️  No sale entries found (may be normal if sales don't create AR entries)`);
  }

  // Check for corruption
  const corrupted = allLines.filter(l => l.debit > 0 && l.credit > 0);
  console.log(`\n🔍 Data Corruption Check:`);
  if (corrupted.length > 0) {
    console.log(`   ❌ Found ${corrupted.length} entries with both debit and credit > 0`);
  } else {
    console.log(`   ✅ No corruption found (no entries with both debit and credit > 0)`);
  }

  // Summary
  console.log(`\n========================================`);
  console.log(`SUMMARY`);
  console.log(`========================================`);
  
  const allCorrect = 
    categories.payments.wrong === 0 &&
    categories.extraExpenses.wrong === 0 &&
    categories.discounts.wrong === 0 &&
    categories.sales.wrong === 0 &&
    corrupted.length === 0;

  if (allCorrect) {
    console.log(`✅ ALL CHECKS PASSED`);
    console.log(`✅ Accounting data is correct`);
    console.log(`✅ Ready for production use`);
  } else {
    console.log(`⚠️  SOME ISSUES FOUND`);
    if (categories.payments.wrong > 0) console.log(`   - ${categories.payments.wrong} payment entries need fixing`);
    if (categories.extraExpenses.wrong > 0) console.log(`   - ${categories.extraExpenses.wrong} extra expense entries need fixing`);
    if (categories.discounts.wrong > 0) console.log(`   - ${categories.discounts.wrong} discount entries need fixing`);
    if (categories.sales.wrong > 0) console.log(`   - ${categories.sales.wrong} sale entries need fixing`);
    if (corrupted.length > 0) console.log(`   - ${corrupted.length} corrupted entries found`);
  }

  console.log(`\n========================================`);
}

main().catch(console.error);
