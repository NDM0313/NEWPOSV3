/**
 * Analyze and repair ERP accounting database:
 * - Detect and remove duplicate account codes (company_id, code), keep oldest, remap references
 * - Fix incorrect account names (2000→Accounts Receivable, 5000→Cost of Production, etc.)
 * - Create missing required ERP accounts (2000, 4000, 5000, 2010)
 * - Verify integrity
 * Uses DATABASE_URL / DATABASE_POOLER_URL / DATABASE_ADMIN_URL from .env.local.
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function loadEnvLocal() {
  const envPath = path.join(root, '.env.local');
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1).replace(/\\"/g, '"');
    if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1).replace(/\\'/g, "'");
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvLocal();

const connectionString =
  process.env.DATABASE_ADMIN_URL ||
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL;

const REQUIRED_ACCOUNTS = [
  { code: '2000', name: 'Accounts Receivable', type: 'Accounts Receivable' },
  { code: '4000', name: 'Sales Revenue', type: 'Sales Revenue' },
  { code: '5000', name: 'Cost of Production', type: 'Cost of Production' },
  { code: '2010', name: 'Worker Payable', type: 'Worker Payable' },
];

async function run() {
  if (!connectionString) {
    console.log('[repair-accounting] No DATABASE_URL in .env.local — cannot connect.');
    process.exit(1);
  }

  const client = new pg.Client({ connectionString });
  const report = { duplicatesRemoved: 0, accountsCreated: 0, accountsRenamed: 0, journalRepaired: 0 };

  try {
    await client.connect();

    // ─── STEP 1: Analyze ─────────────────────────────────────────────────────
    console.log('\n--- STEP 1: Analyze accounts ---');
    const { rows: dupRows } = await client.query(`
      SELECT company_id, code, COUNT(*) AS cnt, array_agg(id ORDER BY created_at ASC, id ASC) AS ids
      FROM accounts
      GROUP BY company_id, code
      HAVING COUNT(*) > 1
    `);
    const duplicates = dupRows || [];
    console.log('Duplicate (company_id, code) groups:', duplicates.length);

    const { rows: allCompanies } = await client.query('SELECT id FROM companies');
    const companyIds = (allCompanies || []).map((r) => r.id);
    const { rows: existingRequired } = await client.query(`
      SELECT company_id, code, name, type, id FROM accounts WHERE code IN ('2000','4000','5000','2010')
    `);
    const existingSet = new Set((existingRequired || []).map((r) => `${r.company_id}:${r.code}`));
    const wrongNames = (existingRequired || []).filter((r) => {
      const want = REQUIRED_ACCOUNTS.find((a) => a.code === r.code);
      return want && (r.name !== want.name || r.type !== want.type);
    });
    console.log('Companies:', companyIds.length);
    console.log('Required accounts existing:', existingRequired?.length ?? 0);
    console.log('Incorrect names to fix:', wrongNames.length);

    // ─── STEP 2 & 5: Remap references and remove duplicates ─────────────────
    if (duplicates.length > 0) {
      console.log('\n--- STEP 2 & 5: Remap references and remove duplicates ---');
      await client.query('BEGIN');
      try {
        for (const row of duplicates) {
          const ids = row.ids;
          const keepId = ids[0];
          const deleteIds = ids.slice(1);
          for (const dupId of deleteIds) {
            const tables = [
              ['journal_entry_lines', 'account_id'],
              ['ledger_entries', 'account_id'],
              ['expenses', 'account_id'],
              ['payments', 'payment_account_id'],
            ];
            for (const [table, col] of tables) {
              const r = await client.query(
                `UPDATE ${table} SET ${col} = $1 WHERE ${col} = $2`,
                [keepId, dupId]
              );
              if (r.rowCount > 0) report.journalRepaired += r.rowCount;
            }
            if (await tableExists(client, 'expenses') && await columnExists(client, 'expenses', 'payment_account_id')) {
              const r = await client.query('UPDATE expenses SET payment_account_id = $1 WHERE payment_account_id = $2', [keepId, dupId]);
              if (r.rowCount > 0) report.journalRepaired += r.rowCount;
            }
            const branchCols = ['default_cash_account_id', 'default_bank_account_id', 'default_pos_drawer_account_id'];
            for (const col of branchCols) {
              if (await columnExists(client, 'branches', col)) {
                const r = await client.query(`UPDATE branches SET ${col} = $1 WHERE ${col} = $2`, [keepId, dupId]);
                if (r.rowCount > 0) report.journalRepaired += r.rowCount;
              }
            }
            await client.query('UPDATE accounts SET parent_id = NULL WHERE parent_id = $1', [dupId]);
            await client.query('DELETE FROM accounts WHERE id = $1', [dupId]);
            report.duplicatesRemoved += 1;
          }
        }
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      }
    }

    // ─── STEP 3: Fix incorrect names ────────────────────────────────────────
    console.log('\n--- STEP 3: Fix incorrect account names ---');
    for (const want of REQUIRED_ACCOUNTS) {
      const res = await client.query(
        `UPDATE accounts SET name = $1, type = $2 WHERE code = $3 AND (name IS DISTINCT FROM $1 OR type IS DISTINCT FROM $2)`,
        [want.name, want.type, want.code]
      );
      if (res.rowCount > 0) {
        report.accountsRenamed += res.rowCount;
        console.log('Renamed', res.rowCount, 'account(s) for code', want.code, '->', want.name);
      }
    }

    // ─── STEP 4: Create missing accounts ────────────────────────────────────
    console.log('\n--- STEP 4: Create missing required accounts ---');
    const hasBalance = await columnExists(client, 'accounts', 'balance');
    for (const companyId of companyIds) {
      for (const acc of REQUIRED_ACCOUNTS) {
        if (existingSet.has(`${companyId}:${acc.code}`)) continue;
        try {
          let res;
          if (hasBalance) {
            res = await client.query(
              `INSERT INTO accounts (company_id, code, name, type, balance, is_active) VALUES ($1, $2, $3, $4, 0, true) ON CONFLICT (company_id, code) DO NOTHING`,
              [companyId, acc.code, acc.name, acc.type]
            );
          } else {
            res = await client.query(
              `INSERT INTO accounts (company_id, code, name, type, is_active) VALUES ($1, $2, $3, $4, true) ON CONFLICT (company_id, code) DO NOTHING`,
              [companyId, acc.code, acc.name, acc.type]
            );
          }
          if (res.rowCount > 0) report.accountsCreated += 1;
          existingSet.add(`${companyId}:${acc.code}`);
        } catch (e) {
          if (e.code !== '23505') throw e; // ignore unique violation
        }
      }
    }
    console.log('Created', report.accountsCreated, 'new account(s)');

    // ─── STEP 6: Verify ─────────────────────────────────────────────────────
    console.log('\n--- STEP 6: Verify ---');
    const { rows: dupAfter } = await client.query(`
      SELECT company_id, code, COUNT(*) AS cnt FROM accounts GROUP BY company_id, code HAVING COUNT(*) > 1
    `);
    const { rows: requiredAfter } = await client.query(`
      SELECT company_id, code, name FROM accounts WHERE code IN ('2000','4000','5000','2010') ORDER BY company_id, code
    `);
    const companyCount = companyIds.length;
    const expectedRequired = companyCount * 4;
    const orphanJel = await client.query(`
      SELECT jel.id FROM journal_entry_lines jel LEFT JOIN accounts a ON a.id = jel.account_id WHERE a.id IS NULL LIMIT 5
    `);

    console.log('Duplicate (company_id, code) after repair:', dupAfter?.length ?? 0);
    console.log('Required accounts present:', requiredAfter?.length, '/', expectedRequired);
    console.log('Orphan journal_entry_lines (sample):', orphanJel.rows?.length ?? 0);

    // ─── STEP 7: Report ─────────────────────────────────────────────────────
    console.log('\n========== REPAIR REPORT ==========');
    console.log('Duplicates removed (accounts deleted):', report.duplicatesRemoved);
    console.log('Accounts created:', report.accountsCreated);
    console.log('Accounts renamed:', report.accountsRenamed);
    console.log('Journal/ledger references repaired (rows updated):', report.journalRepaired);
    console.log('Verification: duplicates remaining =', dupAfter?.length ?? 0, ', required accounts =', requiredAfter?.length + '/' + expectedRequired);
    if ((orphanJel.rows?.length ?? 0) > 0) console.log('WARNING: Some journal_entry_lines reference missing accounts.');
    console.log('====================================\n');
  } finally {
    await client.end();
  }
}

async function tableExists(client, table) {
  const r = await client.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`,
    [table]
  );
  return r.rows.length > 0;
}

async function columnExists(client, table, column) {
  const r = await client.query(
    `SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
    [table, column]
  );
  return r.rows.length > 0;
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
