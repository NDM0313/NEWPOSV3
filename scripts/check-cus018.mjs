/**
 * Check CUS-018 customer data
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

async function check() {
  console.log('Checking CUS-018 customer...\n');

  // Find customer by code
  const { data: customerByCode } = await supabase
    .from('contacts')
    .select('id, name, type, code')
    .eq('code', 'CUS-018')
    .limit(1)
    .single();

  if (!customerByCode) {
    console.log('Customer CUS-018 not found by code');
    
    // Check all customers
    const { data: allCustomers } = await supabase
      .from('contacts')
      .select('id, name, code, type')
      .eq('type', 'customer')
      .limit(10);
    
    console.log('\nAvailable customers:');
    allCustomers?.forEach(c => {
      console.log(`  ${c.code || 'N/A'}: ${c.name} (ID: ${c.id})`);
    });
    return;
  }

  console.log(`Found customer: ${customerByCode.name}`);
  console.log(`  ID: ${customerByCode.id}`);
  console.log(`  Code: ${customerByCode.code}\n`);

  const customerId = customerByCode.id;
  const companyId = '5aac3c47-af92-44f4-aa7d-4ca5bd4c135b';

  // Get sales
  const { data: sales } = await supabase
    .from('sales')
    .select('id, invoice_no, customer_id, total')
    .eq('customer_id', customerId)
    .limit(10);

  console.log(`Sales: ${sales?.length || 0}`);
  sales?.forEach(s => {
    console.log(`  ${s.invoice_no}: Total ${s.total}, customer_id=${s.customer_id}`);
  });

  // Get AR account (code 2000)
  const { data: arAccount } = await supabase
    .from('accounts')
    .select('id, code, name')
    .eq('company_id', companyId)
    .eq('code', '2000')
    .single();

  if (!arAccount) {
    console.log('\nAR account code 2000 not found');
    return;
  }

  console.log(`\nAR Account: ${arAccount.name} (${arAccount.code}) - ID: ${arAccount.id}\n`);

  // Get journal entries for sales
  const saleIds = sales?.map(s => s.id) || [];
  if (saleIds.length > 0) {
    const { data: jeForSales } = await supabase
      .from('journal_entries')
      .select('id, entry_no, reference_id, reference_type')
      .eq('reference_type', 'sale')
      .in('reference_id', saleIds)
      .limit(20);

    console.log(`Journal entries for sales: ${jeForSales?.length || 0}`);
    jeForSales?.forEach(je => {
      console.log(`  ${je.entry_no || je.id}: ref_id=${je.reference_id}`);
    });

    // Get AR lines for these journal entries
    const jeIds = jeForSales?.map(je => je.id) || [];
    if (jeIds.length > 0) {
      const { data: arLines } = await supabase
        .from('journal_entry_lines')
        .select(`
          debit,
          credit,
          journal_entry:journal_entries(id, entry_no, description)
        `)
        .eq('account_id', arAccount.id)
        .in('journal_entry_id', jeIds)
        .limit(20);

      console.log(`\nAR Journal Entry Lines: ${arLines?.length || 0}`);
      arLines?.forEach(line => {
        const je = line.journal_entry;
        console.log(`  ${je.entry_no || je.id}: Debit=${line.debit}, Credit=${line.credit}`);
      });
    }
  }
}

check().catch(console.error);
