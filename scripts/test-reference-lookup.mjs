/**
 * Test Reference Lookup
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
  const companyId = '5aac3c47-af92-44f4-aa7d-4ca5bd4c135b';
  const testRefs = ['JE-0058', 'JE-0059', 'JE-0060', '0864409b-c7e0-45f8-8582-df44319ae89b'];

  console.log('Testing reference lookups...\n');

  for (const ref of testRefs) {
    console.log(`Testing: ${ref}`);
    
    // Test 1: entry_no ilike
    const { data: data1 } = await supabase
      .from('journal_entries')
      .select('id, entry_no, description')
      .eq('company_id', companyId)
      .ilike('entry_no', ref)
      .maybeSingle();
    
    console.log(`  entry_no ilike: ${data1 ? 'FOUND' : 'NOT FOUND'}`);
    if (data1) {
      console.log(`    ID: ${data1.id}, Entry No: ${data1.entry_no}`);
    }
    
    // Test 2: entry_no exact
    const { data: data2 } = await supabase
      .from('journal_entries')
      .select('id, entry_no, description')
      .eq('company_id', companyId)
      .eq('entry_no', ref)
      .maybeSingle();
    
    console.log(`  entry_no exact: ${data2 ? 'FOUND' : 'NOT FOUND'}`);
    
    // Test 3: ID lookup (if UUID)
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ref);
    if (isUUID) {
      const { data: data3 } = await supabase
        .from('journal_entries')
        .select('id, entry_no, description')
        .eq('id', ref)
        .eq('company_id', companyId)
        .maybeSingle();
      
      console.log(`  ID lookup: ${data3 ? 'FOUND' : 'NOT FOUND'}`);
      if (data3) {
        console.log(`    ID: ${data3.id}, Entry No: ${data3.entry_no}`);
      }
    }
    
    console.log('');
  }
}

test().catch(console.error);
