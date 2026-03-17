/**
 * PF-07: Verify manual accounting correction workflow (reversal entries).
 * Creates one sample original + reversal on NEW BUSINESS and checks journal/report consistency.
 * Uses DATABASE_ADMIN_URL or DATABASE_POOLER_URL or DATABASE_URL from .env.local.
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

const conn = process.env.DATABASE_ADMIN_URL || process.env.DATABASE_POOLER_URL || process.env.DATABASE_URL;
if (!conn) {
  console.log('No DATABASE_URL set');
  process.exit(1);
}

const NEW_BUSINESS_ID = 'c37b77cc-6eb9-4fc0-af7d-3e1eaaeaeaee';
const OLD_BUSINESS_ID = 'eb71d817-b87e-4195-964b-7b5321b480f5';

async function run() {
  const client = new pg.Client({ connectionString: conn });
  await client.connect();

  try {
    console.log('--- PF-07 Correction Workflow Verification ---\n');

    // 1) Journal entries for NEW BUSINESS (before)
    const beforeNew = await client.query(
      `SELECT id, entry_no, entry_date, reference_type, reference_id, description
       FROM journal_entries WHERE company_id = $1 ORDER BY created_at DESC LIMIT 10`,
      [NEW_BUSINESS_ID]
    );
    console.log('NEW BUSINESS journal_entries (before sample):', beforeNew.rows.length);

    // 2) Get two accounts for NEW BUSINESS (e.g. Cash 1000 and one other)
    const accounts = await client.query(
      `SELECT id, code, name FROM accounts WHERE company_id = $1 AND is_active = true ORDER BY code LIMIT 5`,
      [NEW_BUSINESS_ID]
    );
    if (accounts.rows.length < 2) {
      console.log('NEW BUSINESS has fewer than 2 accounts; skipping insert. Create accounts in app first.');
      console.log('Accounts found:', accounts.rows);
      // Still show OLD BUSINESS can use same workflow
      const oldRef = await client.query(
        `SELECT id, entry_no, reference_type, reference_id FROM journal_entries WHERE company_id = $1 LIMIT 5`,
        [OLD_BUSINESS_ID]
      );
      console.log('\nOLD BUSINESS journal_entries sample:', oldRef.rows.length);
      return;
    }

    const acc1 = accounts.rows[0];
    const acc2 = accounts.rows[1];
    const amount = 100;

    // 3) Insert sample original JE
    const ins1 = await client.query(
      `INSERT INTO journal_entries (company_id, entry_no, entry_date, description, reference_type)
       VALUES ($1, $2, CURRENT_DATE, 'PF-07 sample original', 'manual')
       RETURNING id, entry_no, reference_type`,
      [NEW_BUSINESS_ID, `JE-PF07-${Date.now()}`]
    );
    const jeId = ins1.rows[0].id;
    await client.query(
      `INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
       VALUES ($1, $2, $3, 0, 'Debit'), ($1, $4, 0, $3, 'Credit')`,
      [jeId, acc1.id, amount, acc2.id]
    );
    console.log('Created sample original JE:', jeId, ins1.rows[0].entry_no);

    // 4) Insert reversal JE (correction_reversal, reference_id = original)
    const ins2 = await client.query(
      `INSERT INTO journal_entries (company_id, entry_no, entry_date, description, reference_type, reference_id)
       VALUES ($1, $2, CURRENT_DATE, 'Reversal of: PF-07 sample original', 'correction_reversal', $3)
       RETURNING id, entry_no, reference_type, reference_id`,
      [NEW_BUSINESS_ID, `JE-REV-PF07-${Date.now()}`, jeId]
    );
    const revId = ins2.rows[0].id;
    await client.query(
      `INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
       VALUES ($1, $2, 0, $3, 'Reversal'), ($1, $4, $3, 0, 'Reversal')`,
      [revId, acc1.id, amount, acc2.id]
    );
    console.log('Created reversal JE:', revId, ins2.rows[0].entry_no, 'reference_id=', ins2.rows[0].reference_id);

    // 5) Journal visibility: list entries for NEW BUSINESS
    const afterNew = await client.query(
      `SELECT je.id, je.entry_no, je.entry_date, je.reference_type, je.reference_id, je.description
       FROM journal_entries je WHERE je.company_id = $1 ORDER BY je.created_at DESC LIMIT 12`,
      [NEW_BUSINESS_ID]
    );
    console.log('\n--- Journal visibility (NEW BUSINESS) ---');
    afterNew.rows.forEach((r) => {
      console.log(r.entry_no, r.reference_type, r.reference_id ? `ref->${String(r.reference_id).slice(0, 8)}...` : '', r.description?.slice(0, 40));
    });

    // 6) Report consistency: per-account totals for NEW BUSINESS (should still balance; sample + reversal net to 0)
    const tb = await client.query(
      `SELECT a.code, a.name,
         COALESCE(SUM(jel.debit), 0) AS debit,
         COALESCE(SUM(jel.credit), 0) AS credit
       FROM accounts a
       LEFT JOIN journal_entry_lines jel ON jel.account_id = a.id
       LEFT JOIN journal_entries je ON je.id = jel.journal_entry_id AND je.company_id = $1
       WHERE a.company_id = $1 AND a.is_active = true
       GROUP BY a.id, a.code, a.name
       HAVING COALESCE(SUM(jel.debit), 0) != 0 OR COALESCE(SUM(jel.credit), 0) != 0
       ORDER BY a.code`,
      [NEW_BUSINESS_ID]
    );
    let totalD = 0, totalC = 0;
    tb.rows.forEach((r) => {
      totalD += Number(r.debit);
      totalC += Number(r.credit);
    });
    console.log('\n--- Trial balance style (NEW BUSINESS) ---');
    console.log('Total debit:', totalD, 'Total credit:', totalC, 'Difference:', totalD - totalC);

    // 7) OLD BUSINESS: same schema, no insert
    const oldCount = await client.query(
      `SELECT COUNT(*) AS c FROM journal_entries WHERE company_id = $1`,
      [OLD_BUSINESS_ID]
    );
    console.log('\n--- OLD BUSINESS ---');
    console.log('Journal entries count:', oldCount.rows[0].c, '(unchanged; same workflow available)');

    console.log('\n--- PF-07 verification done ---');
  } finally {
    await client.end();
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
