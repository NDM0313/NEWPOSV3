/**
 * Verify Sale Amounts - Check if sales.grand_total exists and is used
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
  console.log('Checking sales table structure and amounts...\n');

  // Get sample sales
  const { data: sales } = await supabase
    .from('sales')
    .select('*')
    .limit(3);

  if (sales && sales.length > 0) {
    console.log('Sales table columns:', Object.keys(sales[0]));
    console.log('\nSample sales:');
    sales.forEach(s => {
      console.log(`  ${s.invoice_no}:`);
      console.log(`    total: ${s.total}`);
      console.log(`    grand_total: ${s.grand_total || 'N/A'}`);
      console.log(`    subtotal: ${s.subtotal || 'N/A'}`);
      console.log(`    paid_amount: ${s.paid_amount}`);
      console.log(`    due_amount: ${s.due_amount}`);
    });
  } else {
    console.log('No sales found');
  }
}

verify().catch(console.error);
