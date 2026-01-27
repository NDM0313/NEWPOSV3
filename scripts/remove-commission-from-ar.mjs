/**
 * PHASE 3: Remove Commission entries from AR account
 * Commission should NOT be in AR - it's a company expense
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

async function fix() {
  console.log('========================================');
  console.log('PHASE 3: REMOVING COMMISSION FROM AR');
  console.log('========================================\n');

  const companyId = '5aac3c47-af92-44f4-aa7d-4ca5bd4c135b';

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

  // Get commission expense account (5100)
  const { data: commissionAccount } = await supabase
    .from('accounts')
    .select('id, code, name')
    .eq('company_id', companyId)
    .eq('code', '5100')
    .single();

  if (!commissionAccount) {
    console.log('❌ Commission account (5100) not found');
    return;
  }

  // Find commission journal entries
  const { data: commissionEntries } = await supabase
    .from('journal_entries')
    .select('id, entry_no, description')
    .eq('company_id', companyId)
    .ilike('description', '%commission%');

  console.log(`Found ${commissionEntries?.length || 0} commission journal entries`);

  if (!commissionEntries || commissionEntries.length === 0) {
    console.log('✅ No commission entries found');
    return;
  }

  const jeIds = commissionEntries.map(je => je.id);

  // Find AR lines for these commission entries
  const { data: arCommissionLines } = await supabase
    .from('journal_entry_lines')
    .select('id, journal_entry_id, account_id, debit, credit')
    .eq('account_id', arAccount.id)
    .in('journal_entry_id', jeIds);

  console.log(`Found ${arCommissionLines?.length || 0} commission lines in AR account`);

  if (!arCommissionLines || arCommissionLines.length === 0) {
    console.log('✅ No commission lines in AR account');
    return;
  }

  // Delete AR lines for commission entries
  const arLineIds = arCommissionLines.map(l => l.id);
  const { error: deleteError } = await supabase
    .from('journal_entry_lines')
    .delete()
    .in('id', arLineIds);

  if (deleteError) {
    console.error('❌ Error deleting AR commission lines:', deleteError);
    return;
  }

  console.log(`✅ Deleted ${arLineIds.length} commission lines from AR account`);

  // Verify - check if any commission lines remain in AR
  const { data: remainingLines } = await supabase
    .from('journal_entry_lines')
    .select('id')
    .eq('account_id', arAccount.id)
    .in('journal_entry_id', jeIds);

  if (remainingLines && remainingLines.length > 0) {
    console.log(`⚠️ Warning: ${remainingLines.length} commission lines still in AR`);
  } else {
    console.log('✅ All commission lines removed from AR account');
  }
}

fix().catch(console.error);
