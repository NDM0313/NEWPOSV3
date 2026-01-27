/**
 * Check Actual Database Schema
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
  console.log('Checking actual database schema...\n');

  // Check contacts - get one record to see structure
  const { data: contactSample } = await supabase
    .from('contacts')
    .select('*')
    .limit(1)
    .single();

  console.log('CONTACTS TABLE STRUCTURE:');
  if (contactSample) {
    console.log('Available columns:', Object.keys(contactSample));
    console.log('Sample record:', JSON.stringify(contactSample, null, 2));
  }

  // Check payments - get one record
  const { data: paymentSample } = await supabase
    .from('payments')
    .select('*')
    .limit(1)
    .single();

  console.log('\nPAYMENTS TABLE STRUCTURE:');
  if (paymentSample) {
    console.log('Available columns:', Object.keys(paymentSample));
    console.log('Sample record:', JSON.stringify(paymentSample, null, 2));
  }

  // Check sales - get one record
  const { data: saleSample } = await supabase
    .from('sales')
    .select('*')
    .limit(1)
    .single();

  console.log('\nSALES TABLE STRUCTURE:');
  if (saleSample) {
    console.log('Available columns:', Object.keys(saleSample));
    console.log('Sample record:', JSON.stringify(saleSample, null, 2));
  }

  // Check journal_entries - get one payment entry
  const { data: jePaymentSample } = await supabase
    .from('journal_entries')
    .select('*')
    .eq('reference_type', 'payment')
    .limit(1)
    .single();

  console.log('\nJOURNAL_ENTRIES (PAYMENT) STRUCTURE:');
  if (jePaymentSample) {
    console.log('Available columns:', Object.keys(jePaymentSample));
    console.log('Sample record:', JSON.stringify(jePaymentSample, null, 2));
  }
}

main().catch(console.error);
