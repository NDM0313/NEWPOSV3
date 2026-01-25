// ============================================
// 🎯 VERIFY MIGRATION STATUS
// ============================================
// Check if Chart of Accounts tables exist

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Client } from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function verifyMigration() {
  try {
    console.log('');
    console.log('============================================');
    console.log('  VERIFYING MIGRATION STATUS');
    console.log('============================================');
    console.log('');

    // Read .env.local
    const envPath = path.join(__dirname, '.env.local');
    if (!fs.existsSync(envPath)) {
      console.error('❌ ERROR: .env.local file not found!');
      process.exit(1);
    }

    const envContent = fs.readFileSync(envPath, 'utf8');
    const connectionMatch = envContent.match(/DATABASE_POOLER_URL=(.+)/);
    
    if (!connectionMatch) {
      console.error('❌ ERROR: DATABASE_POOLER_URL not found');
      process.exit(1);
    }

    const connectionString = connectionMatch[1].trim();

    // Connect to database
    console.log('Connecting to database...');
    const client = new Client({
      connectionString: connectionString,
      ssl: { rejectUnauthorized: false }
    });

    await client.connect();
    console.log('✅ Connected');
    console.log('');

    // Check tables
    console.log('Checking tables...');
    console.log('');

    const requiredTables = [
      'chart_accounts',
      'account_transactions',
      'journal_entries',
      'journal_entry_lines',
      'accounting_audit_logs',
      'automation_rules',
      'accounting_settings'
    ];

    let allExist = true;
    const results = [];

    for (const tableName of requiredTables) {
      const result = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        );
      `, [tableName]);

      const exists = result.rows[0].exists;
      results.push({ table: tableName, exists });
      
      if (!exists) {
        allExist = false;
      }
    }

    await client.end();

    // Display results
    console.log('Migration Status:');
    console.log('');
    
    results.forEach(({ table, exists }) => {
      const status = exists ? '✅ EXISTS' : '❌ MISSING';
      const color = exists ? '\x1b[32m' : '\x1b[31m';
      console.log(`${color}${status}\x1b[0m  ${table}`);
    });

    console.log('');

    if (allExist) {
      console.log('✅ All tables exist! Migration is complete.');
      console.log('');
      console.log('Next steps:');
      console.log('  1. Navigate to /test/accounting-chart');
      console.log('  2. Default accounts will auto-create');
      console.log('');
      process.exit(0);
    } else {
      console.log('❌ Some tables are missing. Please run the migration.');
      console.log('');
      console.log('Migration file: supabase-extract/migrations/16_chart_of_accounts.sql');
      console.log('See MIGRATION_COMPLETE_GUIDE.md for instructions');
      console.log('');
      process.exit(1);
    }

  } catch (error) {
    console.error('');
    console.error('❌ Verification failed:', error.message);
    console.error('');
    process.exit(1);
  }
}

verifyMigration();
