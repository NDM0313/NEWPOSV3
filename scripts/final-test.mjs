/**
 * Final Test - Customer Ledger Matching
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

async function test() {
  const customerId = 'b004659d-1c6e-4954-b89f-6d5def451c36';
  const companyId = '5aac3c47-af92-44f4-aa7d-4ca5bd4c135b';

  // Get AR account
  const { data: arAccounts } = await supabase
    .from('accounts')
    .select('id, code')
    .eq('company_id', companyId)
    .or('code.eq.2000,code.eq.1100')
    .limit(1);

  if (!arAccounts || arAccounts.length === 0) {
    console.log('AR account not found');
    return;
  }

  const arAccountId = arAccounts[0].id;

  // Get all AR lines
  const { data: lines } = await supabase
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
    .order('created_at', { ascending: true });

  // Get customer sales
  const { data: customerSales } = await supabase
    .from('sales')
    .select('id, invoice_no, customer_id')
    .eq('company_id', companyId)
    .eq('customer_id', customerId);

  const salesMap = new Map();
  customerSales?.forEach(s => salesMap.set(s.id, s));

  // Get customer payments
  const saleIds = customerSales?.map(s => s.id) || [];
  const { data: customerPayments } = await supabase
    .from('payments')
    .select('id, reference_number, reference_id')
    .eq('reference_type', 'sale')
    .in('reference_id', saleIds.length > 0 ? saleIds : ['00000000-0000-0000-0000-000000000000']);

  const paymentIds = customerPayments?.map(p => p.id) || [];
  const paymentDetailsMap = new Map();
  customerPayments?.forEach(p => paymentDetailsMap.set(p.id, p));

  console.log(`Customer Sales: ${salesMap.size}`);
  console.log(`Customer Payments: ${paymentIds.length}`);
  console.log(`Total AR Lines: ${lines?.length || 0}\n`);

  // Filter lines
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

    // Check payment entries - Pattern A
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

    // Check payment entries - Pattern B
    if (entry.reference_type === 'sale' && entry.payment_id) {
      if (paymentIds.includes(entry.payment_id)) {
        return true;
      }
      if (entry.reference_id) {
        const sale = salesMap.get(entry.reference_id);
        if (sale && sale.customer_id === customerId) {
          return true;
        }
      }
    }

    return false;
  });

  console.log(`\nMatched: Sale=${saleMatched}, Payment=${paymentMatched}, Total=${customerLines.length}\n`);

  customerLines.forEach((line) => {
    const entry = line.journal_entry;
    console.log(`${entry.entry_no || entry.id}: ${entry.description}`);
    console.log(`  Type: ${entry.reference_type}, Ref: ${entry.reference_id || 'N/A'}, Payment: ${entry.payment_id || 'N/A'}`);
    console.log(`  Debit: ${line.debit}, Credit: ${line.credit}`);
  });

  const totalDebit = customerLines.reduce((sum, l) => sum + (l.debit || 0), 0);
  const totalCredit = customerLines.reduce((sum, l) => sum + (l.credit || 0), 0);

  console.log(`\nTotals: Debit=${totalDebit}, Credit=${totalCredit}, Balance=${totalDebit - totalCredit}`);
}

test().catch(console.error);
