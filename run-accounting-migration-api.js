// ============================================
// 🎯 AUTO-RUN ACCOUNTING MIGRATION (Supabase API)
// ============================================
// Uses Supabase REST API to execute SQL migration

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  try {
    console.log('');
    console.log('============================================');
    console.log('  RUNNING CHART OF ACCOUNTS MIGRATION');
    console.log('============================================');
    console.log('');

    // Step 1: Read .env.local
    console.log('[1/4] Reading .env.local...');
    
    const envPath = path.join(__dirname, '.env.local');
    if (!fs.existsSync(envPath)) {
      console.error('❌ ERROR: .env.local file not found!');
      process.exit(1);
    }

    const envContent = fs.readFileSync(envPath, 'utf8');
    
    // Extract Supabase URL and Service Role Key
    const urlMatch = envContent.match(/VITE_SUPABASE_URL=(.+)/);
    const keyMatch = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/);
    
    if (!urlMatch || !keyMatch) {
      console.error('❌ ERROR: SUPABASE_URL or SERVICE_ROLE_KEY not found in .env.local');
      process.exit(1);
    }

    const supabaseUrl = urlMatch[1].trim();
    const serviceRoleKey = keyMatch[1].trim();
    
    console.log('✅ Supabase credentials found');
    console.log('');

    // Step 2: Read migration file
    console.log('[2/4] Reading migration file...');
    
    const migrationFile = path.join(__dirname, 'supabase-extract', 'migrations', '16_chart_of_accounts.sql');
    if (!fs.existsSync(migrationFile)) {
      console.error(`❌ ERROR: Migration file not found: ${migrationFile}`);
      process.exit(1);
    }

    const sql = fs.readFileSync(migrationFile, 'utf8');
    console.log('✅ Migration file loaded');
    console.log('');

    // Step 3: Execute via Supabase REST API
    console.log('[3/4] Executing migration via Supabase API...');
    console.log('   This may take 30-60 seconds...');
    console.log('');

    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`
      },
      body: JSON.stringify({ query: sql })
    });

    // If exec_sql doesn't exist, try direct SQL execution endpoint
    if (!response.ok && response.status === 404) {
      console.log('   Trying alternative method...');
      
      // Use Supabase Management API (if available)
      // Note: This requires the project's access token
      console.log('⚠️  Direct SQL execution not available via REST API');
      console.log('');
      console.log('✅ Migration file is ready. Please execute manually:');
      console.log('');
      console.log('OPTION 1: Via Supabase Dashboard (Recommended)');
      console.log('  1. Go to: https://supabase.com/dashboard');
      console.log('  2. Select project: wrwljqzckmnmuphwhslt');
      console.log('  3. Open SQL Editor');
      console.log('  4. Copy content from: supabase-extract/migrations/16_chart_of_accounts.sql');
      console.log('  5. Paste and Run');
      console.log('');
      console.log('OPTION 2: Via psql command line');
      console.log(`  psql "${envContent.match(/DATABASE_POOLER_URL=(.+)/)[1].trim()}" -f supabase-extract/migrations/16_chart_of_accounts.sql`);
      console.log('');
      process.exit(0);
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    
    console.log('');
    console.log('✅ Migration completed successfully!');
    console.log('');
    console.log('Next steps:');
    console.log('  1. Refresh your app');
    console.log('  2. Navigate to Accounting Test Page (/test/accounting-chart)');
    console.log('  3. Default accounts will auto-create');
    console.log('');
    process.exit(0);

  } catch (error) {
    console.error('');
    console.error('❌ Migration failed:', error.message);
    console.error('');
    console.error('Please run the migration manually via Supabase SQL Editor:');
    console.error('  1. Go to: https://supabase.com/dashboard');
    console.error('  2. Select project: wrwljqzckmnmuphwhslt');
    console.error('  3. Open SQL Editor');
    console.error('  4. Copy content from: supabase-extract/migrations/16_chart_of_accounts.sql');
    console.error('  5. Paste and Run');
    console.error('');
    process.exit(1);
  }
}

runMigration();
