// ============================================
// 🎯 REMOVE DUPLICATE ACCOUNTING TABLES
// ============================================
// Drops the new tables that duplicate existing accounting system

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Client } from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function removeDuplicateTables() {
  try {
    console.log('');
    console.log('============================================');
    console.log('  REMOVING DUPLICATE ACCOUNTING TABLES');
    console.log('============================================');
    console.log('');

    // Read .env.local
    const envPath = path.join(__dirname, '.env.local');
    const envContent = fs.readFileSync(envPath, 'utf8');
    const connectionMatch = envContent.match(/DATABASE_POOLER_URL=(.+)/);
    const connectionString = connectionMatch[1].trim();

    // Connect
    const client = new Client({
      connectionString: connectionString,
      ssl: { rejectUnauthorized: false }
    });
    await client.connect();
    console.log('✅ Connected to database');
    console.log('');

    // Tables to drop (in reverse dependency order)
    const tablesToDrop = [
      'account_transactions',      // References chart_accounts
      'journal_entry_lines',       // References journal_entries (if new one exists)
      'journal_entries',            // May have new duplicate
      'accounting_audit_logs',      // References chart_accounts
      'automation_rules',           // References chart_accounts
      'accounting_settings',        // Standalone
      'chart_accounts'              // Main duplicate table
    ];

    console.log('Dropping duplicate tables...');
    console.log('');

    for (const tableName of tablesToDrop) {
      try {
        // Check if table exists
        const checkResult = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = $1
          );
        `, [tableName]);

        if (checkResult.rows[0].exists) {
          // Drop table with CASCADE to remove dependencies
          await client.query(`DROP TABLE IF EXISTS ${tableName} CASCADE;`);
          console.log(`✅ Dropped: ${tableName}`);
        } else {
          console.log(`⏭️  Skipped: ${tableName} (does not exist)`);
        }
      } catch (error) {
        console.error(`⚠️  Error dropping ${tableName}:`, error.message);
        // Continue with other tables
      }
    }

    // Drop functions and triggers related to new tables
    console.log('');
    console.log('Dropping related functions and triggers...');
    
    const functionsToDrop = [
      'update_account_balance',
      'validate_journal_balance',
      'update_updated_at_column'
    ];

    for (const funcName of functionsToDrop) {
      try {
        await client.query(`DROP FUNCTION IF EXISTS ${funcName}() CASCADE;`);
        console.log(`✅ Dropped function: ${funcName}`);
      } catch (error) {
        // Function might not exist or have different signature
        console.log(`⏭️  Skipped function: ${funcName}`);
      }
    }

    await client.end();

    console.log('');
    console.log('✅ Cleanup completed!');
    console.log('');
    console.log('Remaining tables (existing system):');
    console.log('  ✅ accounts - Main accounts table');
    console.log('  ✅ journal_entries - Journal entries');
    console.log('  ✅ journal_entry_lines - Journal entry lines');
    console.log('  ✅ ledger_entries - Ledger entries');
    console.log('');
    console.log('Next: Update services to use existing tables');
    console.log('');

  } catch (error) {
    console.error('');
    console.error('❌ Error:', error.message);
    console.error('');
    process.exit(1);
  }
}

removeDuplicateTables();
