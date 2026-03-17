/**
 * Verify Issue 01 fix: no sale/shipment/sale_extra_expense on AP (2000).
 * Run: node scripts/verify-issue01-ap-ar.js
 * Requires .env.local with DATABASE_URL or DATABASE_POOLER_URL.
 */
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const envPath = path.join(root, '.env.local');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1).replace(/\\"/g, '"');
    if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1).replace(/\\'/g, "'");
    if (!process.env[key]) process.env[key] = val;
  }
}

const connectionString = process.env.DATABASE_ADMIN_URL || process.env.DATABASE_POOLER_URL || process.env.DATABASE_URL;
if (!connectionString) {
  console.log('No DATABASE_URL in .env.local — skip verification.');
  process.exit(0);
}

const Q1 = `
SELECT a.code AS account_code, a.name AS account_name, je.reference_type, COUNT(*) AS line_count
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.journal_entry_id
JOIN accounts a ON a.id = jel.account_id
WHERE a.code = '2000'
GROUP BY a.code, a.name, je.reference_type
ORDER BY je.reference_type;
`;

const Q2 = `
SELECT a.code AS account_code, a.name AS account_name, je.reference_type, COUNT(*) AS line_count
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.journal_entry_id
JOIN accounts a ON a.id = jel.account_id
WHERE a.code = '1100'
GROUP BY a.code, a.name, je.reference_type
ORDER BY je.reference_type;
`;

const Q3 = `
SELECT jel.id, je.entry_no, je.reference_type, a.code
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.journal_entry_id
JOIN accounts a ON a.id = jel.account_id
WHERE a.code = '2000' AND je.reference_type IN ('sale', 'shipment', 'sale_extra_expense');
`;

async function run() {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    console.log('\n--- 1) AP (2000) lines by reference_type ---');
    const r1 = await client.query(Q1);
    console.table(r1.rows);
    console.log('\n--- 2) AR (1100) lines by reference_type ---');
    const r2 = await client.query(Q2);
    console.table(r2.rows);
    console.log('\n--- 3) FAIL check: any sale/shipment/sale_extra_expense still on 2000? (must be 0 rows) ---');
    const r3 = await client.query(Q3);
    console.log('Rows:', r3.rows.length);
    if (r3.rows.length > 0) console.table(r3.rows);
    const pass = r3.rows.length === 0;
    console.log('\n' + (pass ? 'PASS: No sale/shipment/sale_extra_expense on AP (2000).' : 'FAIL: Some customer entries still on AP.'));
  } finally {
    await client.end();
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
