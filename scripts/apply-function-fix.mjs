/**
 * Apply Extra Expense Function Fix to Database
 * Updates the SQL function to create DEBIT entries (not CREDIT)
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

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const FUNCTION_SQL = `
CREATE OR REPLACE FUNCTION create_extra_expense_journal_entry(
  p_sale_id UUID,
  p_company_id UUID,
  p_branch_id UUID,
  p_expense_amount NUMERIC,
  p_expense_name VARCHAR,
  p_invoice_no VARCHAR
)
RETURNS UUID AS $$
DECLARE
  v_journal_entry_id UUID;
  v_expense_account_id UUID;
  v_receivable_account_id UUID;
  v_entry_no VARCHAR;
BEGIN
  -- Get or create expense account
  v_expense_account_id := get_or_create_extra_expense_account(p_company_id, p_expense_name);
  
  -- Get Accounts Receivable account
  SELECT id INTO v_receivable_account_id
  FROM accounts
  WHERE company_id = p_company_id
    AND code = '2000'
  LIMIT 1;
  
  IF v_receivable_account_id IS NULL THEN
    RAISE EXCEPTION 'Accounts Receivable account (2000) not found';
  END IF;
  
  -- Generate reference number
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'generate_expense_reference') THEN
    v_entry_no := generate_expense_reference(p_company_id);
  ELSE
    v_entry_no := 'EXP-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD((SELECT COUNT(*) + 1 FROM journal_entries WHERE company_id = p_company_id)::TEXT, 4, '0');
  END IF;
  
  IF p_expense_amount > 0 THEN
    -- Create journal entry
    INSERT INTO journal_entries (
      company_id,
      branch_id,
      entry_no,
      entry_date,
      description,
      reference_type,
      reference_id
    ) VALUES (
      p_company_id,
      p_branch_id,
      v_entry_no,
      NOW()::DATE,
      'Extra expense: ' || COALESCE(p_expense_name, 'Extra Expense') || ' - ' || COALESCE(p_invoice_no, ''),
      'sale',
      p_sale_id
    )
    RETURNING id INTO v_journal_entry_id;
    
    -- Debit: Expense Account (increases expense)
    INSERT INTO journal_entry_lines (
      journal_entry_id,
      account_id,
      debit,
      credit,
      description
    ) VALUES (
      v_journal_entry_id,
      v_expense_account_id,
      p_expense_amount,
      0,
      'Extra expense - ' || COALESCE(p_invoice_no, '')
    );
    
    -- CRITICAL FIX: Debit Accounts Receivable (increases receivable - customer owes more)
    -- Extra expense increases what customer owes, so AR must be DEBIT (not CREDIT)
    INSERT INTO journal_entry_lines (
      journal_entry_id,
      account_id,
      debit,
      credit,
      description
    ) VALUES (
      v_journal_entry_id,
      v_receivable_account_id,
      p_expense_amount,  -- DEBIT (increases receivable)
      0,
      'Extra expense added to sale - ' || COALESCE(p_invoice_no, '')
    );
  END IF;
  
  RETURN v_journal_entry_id;
END;
$$ LANGUAGE plpgsql;
`;

async function main() {
  console.log('========================================');
  console.log('APPLYING FUNCTION FIX');
  console.log('========================================\n');

  try {
    // Use Supabase RPC to execute SQL
    // Note: Supabase doesn't have direct SQL execution via client
    // We need to use the REST API or provide instructions
    
    console.log('⚠️  Supabase JS client cannot execute arbitrary SQL directly.');
    console.log('Please run the SQL fix in Supabase SQL Editor:\n');
    console.log('1. Go to: https://supabase.com/dashboard/project/wrwljqzckmnmuphwhslt/sql/new');
    console.log('2. Copy and paste the SQL from: APPLY_DATA_FIXES.sql');
    console.log('3. Click "Run" to apply the fix\n');
    
    // Alternative: Check if function exists and verify its signature
    console.log('Checking current function state...\n');
    
    // We can't directly query pg_proc, but we can verify by checking if the function works correctly
    // by looking at recent entries
    
    const { data: recentEntries, error: checkError } = await supabase
      .from('journal_entries')
      .select(`
        id,
        entry_no,
        description,
        reference_type,
        payment_id,
        journal_entry_lines!inner(
          debit,
          credit,
          account:accounts(code)
        )
      `)
      .eq('journal_entry_lines.account.code', '2000')
      .ilike('description', '%extra expense%')
      .order('created_at', { ascending: false })
      .limit(5);

    if (checkError) {
      console.error('❌ Error checking entries:', checkError.message);
      return;
    }

    if (recentEntries && recentEntries.length > 0) {
      console.log(`Found ${recentEntries.length} recent extra expense entries:\n`);
      
      let allCorrect = true;
      recentEntries.forEach(entry => {
        const line = entry.journal_entry_lines?.[0];
        if (line) {
          const isDebit = line.debit > 0 && line.credit === 0;
          const status = isDebit ? '✅ DEBIT (correct)' : '❌ CREDIT (wrong)';
          console.log(`  ${entry.entry_no}: ${status} (Debit: ${line.debit}, Credit: ${line.credit})`);
          if (!isDebit) allCorrect = false;
        }
      });

      if (allCorrect) {
        console.log('\n✅ All recent entries are correct (DEBIT)');
        console.log('✅ Function may already be fixed, or data was backfilled correctly');
      } else {
        console.log('\n⚠️  Some entries still have CREDIT - function needs to be updated');
      }
    } else {
      console.log('No recent extra expense entries found');
    }

    // Create a helper file with the SQL
    const sqlPath = join(__dirname, '../APPLY_FUNCTION_FIX_NOW.sql');
    const fs = await import('fs');
    fs.writeFileSync(sqlPath, FUNCTION_SQL);
    console.log(`\n✅ SQL function saved to: APPLY_FUNCTION_FIX_NOW.sql`);
    console.log('   Copy this SQL and run it in Supabase SQL Editor\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);
