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
  const companyId = '5aac3c47-af92-44f4-aa7d-4ca5bd4c135b';

  const { data: accounts } = await supabase
    .from('accounts')
    .select('id, code, name')
    .eq('company_id', companyId)
    .or('code.eq.2000,code.eq.1100');

  console.log('AR Accounts:');
  accounts?.forEach(a => {
    console.log(`  Code ${a.code}: ${a.name} (ID: ${a.id})`);
  });

  // Check which account the journal entry lines use
  const { data: lines } = await supabase
    .from('journal_entry_lines')
    .select('account_id, account:accounts(code, name)')
    .ilike('account.name', '%Receivable%')
    .limit(5);

  console.log('\nJournal Entry Lines Account Usage:');
  lines?.forEach(l => {
    console.log(`  Account: ${l.account.code} (${l.account.name}) - ID: ${l.account_id}`);
  });
}

find().catch(console.error);
