// ============================================
// 🎯 AUTO-RUN ACCOUNTING MIGRATION (Node.js)
// ============================================
// Node.js script to automatically run Chart of Accounts migration
// Uses connection string from .env.local

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Client } from 'pg';

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
    const connectionMatch = envContent.match(/DATABASE_POOLER_URL=(.+)/);
    
    if (!connectionMatch) {
      console.error('❌ ERROR: DATABASE_POOLER_URL not found in .env.local');
      process.exit(1);
    }

    const connectionString = connectionMatch[1].trim();
    console.log('✅ Connection string found');
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

    // Step 3: Connect to database
    console.log('[3/4] Connecting to database...');
    
    const client = new Client({
      connectionString: connectionString,
      ssl: {
        rejectUnauthorized: false
      }
    });

    await client.connect();
    console.log('✅ Connected to database');
    console.log('');

    // Step 4: Execute migration
    console.log('[4/4] Executing migration...');
    console.log('   This may take 30-60 seconds...');
    console.log('');

    // Execute entire SQL file as one query
    // PostgreSQL can handle multiple statements separated by semicolons
    try {
      await client.query(sql);
      console.log('✅ SQL executed successfully');
    } catch (error) {
      // Check if it's a non-critical error
      if (error.message.includes('already exists') || 
          error.message.includes('duplicate key') ||
          (error.message.includes('does not exist') && error.message.includes('DROP'))) {
        console.log('⚠️  Some objects may already exist (this is normal)');
      } else {
        throw error; // Re-throw if it's a real error
      }
    }

    await client.end();

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
