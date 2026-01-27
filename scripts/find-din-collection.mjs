/**
 * Find DIN COLLECTION customer
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

async function find() {
  console.log('Finding DIN COLLECTION customer...\n');

  // Find by name
  const { data: customers } = await supabase
    .from('contacts')
    .select('id, name, code, type')
    .ilike('name', '%DIN COLLECTION%')
    .limit(5);

  if (!customers || customers.length === 0) {
    console.log('DIN COLLECTION not found');
    
    // Get all customers
    const { data: allCustomers } = await supabase
      .from('contacts')
      .select('id, name, code, type')
      .eq('type', 'customer')
      .limit(10);
    
    console.log('\nAll customers:');
    allCustomers?.forEach(c => {
      console.log(`  ${c.code || 'NO CODE'}: ${c.name} (ID: ${c.id})`);
    });
    return;
  }

  customers.forEach(customer => {
    console.log(`Found: ${customer.name}`);
    console.log(`  ID: ${customer.id}`);
    console.log(`  Code: ${customer.code || 'NO CODE'}`);
    console.log(`  Type: ${customer.type}\n`);

    // Get sales for this customer
    const { data: sales } = await supabase
      .from('sales')
      .select('id, invoice_no, customer_id, total')
      .eq('customer_id', customer.id)
      .limit(10);

    console.log(`  Sales: ${sales?.length || 0}`);
    sales?.forEach(s => {
      console.log(`    ${s.invoice_no}: Total ${s.total}`);
    });

    // Get AR account (code 2000)
    const companyId = '5aac3c47-af92-44f4-aa7d-4ca5bd4c135b';
    const { data: arAccount } = await supabase
      .from('accounts')
      .select('id, code, name')
      .eq('company_id', companyId)
      .eq('code', '2000')
      .single();

    if (arAccount && sales && sales.length > 0) {
      const saleIds = sales.map(s => s.id);
      
      // Get journal entries
      const { data: journalEntries } = await supabase
        .from('journal_entries')
        .select('id, entry_no, reference_id, reference_type')
        .eq('reference_type', 'sale')
        .in('reference_id', saleIds)
        .limit(10);

      console.log(`  Journal Entries: ${journalEntries?.length || 0}`);

      // Get AR lines
      const jeIds = journalEntries?.map(je => je.id) || [];
      if (jeIds.length > 0) {
        const { data: arLines } = await supabase
          .from('journal_entry_lines')
          .select('debit, credit, journal_entry:journal_entries(entry_no)')
          .eq('account_id', arAccount.id)
          .in('journal_entry_id', jeIds)
          .limit(10);

        console.log(`  AR Lines: ${arLines?.length || 0}`);
        arLines?.forEach(line => {
          const je = line.journal_entry;
          console.log(`    ${je.entry_no || 'N/A'}: Debit=${line.debit}, Credit=${line.credit}`);
        });
      }
    }

    console.log('\n---\n');
  });
}

find().catch(console.error);
