/**
 * Inspect contacts.type (enum/check/text), add 'courier' if needed, then run courier identity backfill.
 * Uses DATABASE_POOLER_URL or DATABASE_URL from .env.local.
 * Run: node scripts/courier-identity-inspect-and-fix.js
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

const connectionString = process.env.DATABASE_ADMIN_URL || process.env.DATABASE_POOLER_URL || process.env.DATABASE_URL;
if (!connectionString) {
  console.error('No DATABASE_ADMIN_URL/DATABASE_POOLER_URL/DATABASE_URL in .env.local');
  process.exit(1);
}

const client = new pg.Client({ connectionString });

async function main() {
  await client.connect();

  try {
    // STEP 1 — Inspect contacts.type
    const cols = await client.query(`
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'contacts' AND column_name = 'type'
    `);
    if (cols.rows.length === 0) {
      console.log('contacts.type column not found.');
      return;
    }
    const { data_type, udt_name } = cols.rows[0];
    console.log('contacts.type:', data_type, 'udt_name:', udt_name);

    // STEP 2 — Add courier to enum if applicable
    if (data_type === 'USER-DEFINED' && udt_name === 'contact_type') {
      const enums = await client.query(`
        SELECT e.enumlabel
        FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'contact_type'
      `);
      const labels = enums.rows.map((r) => r.enumlabel);
      console.log('contact_type enum values:', labels);
      if (!labels.includes('courier')) {
        console.log("Adding 'courier' to contact_type enum...");
        await client.query("ALTER TYPE contact_type ADD VALUE 'courier'");
        console.log("Added 'courier'. (ALTER TYPE ADD VALUE commits immediately.)");
      } else {
        console.log("'courier' already in contact_type.");
      }
    } else if (data_type === 'character varying' || data_type === 'text') {
      console.log('contacts.type is text/varchar — no enum change needed.');
    } else {
      console.log('contacts.type is not enum; if you see errors, add courier to the type constraint.');
    }

    // Check couriers table exists
    const tableCheck = await client.query(`
      SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'couriers'
    `);
    if (tableCheck.rows.length === 0) {
      console.log('couriers table does not exist in this database. Run migrations/couriers_table_and_shipment_weight.sql first. Enum courier was added.');
      return;
    }

    // Ensure couriers.contact_id exists
    console.log('Ensuring couriers.contact_id column exists...');
    await client.query(`
      ALTER TABLE couriers
        ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_couriers_contact_id ON couriers(contact_id) WHERE contact_id IS NOT NULL
    `);

    // Backfill: set contact_id from account or create contact
    console.log('Running backfill...');
    const backfillResult = await client.query(`
      DO $$
      DECLARE
        r RECORD;
        v_contact_id UUID;
      BEGIN
        FOR r IN
          SELECT c.id AS courier_id, c.company_id, c.name, c.account_id
          FROM couriers c
          WHERE c.account_id IS NOT NULL
            AND (c.contact_id IS NULL OR NOT EXISTS (SELECT 1 FROM contacts ct WHERE ct.id = c.contact_id))
        LOOP
          SELECT a.contact_id INTO v_contact_id FROM accounts a WHERE a.id = r.account_id;
          IF v_contact_id IS NOT NULL THEN
            UPDATE couriers SET contact_id = v_contact_id WHERE id = r.courier_id;
          ELSE
            SELECT id INTO v_contact_id FROM contacts
            WHERE company_id = r.company_id AND type = 'courier' AND TRIM(name) = TRIM(r.name) LIMIT 1;
            IF v_contact_id IS NULL THEN
              INSERT INTO contacts (company_id, type, name, is_active, opening_balance, credit_limit, payment_terms)
              VALUES (r.company_id, 'courier', TRIM(r.name), true, 0, 0, 0)
              RETURNING id INTO v_contact_id;
            END IF;
            IF v_contact_id IS NOT NULL THEN
              UPDATE accounts SET contact_id = v_contact_id WHERE id = r.account_id;
              UPDATE couriers SET contact_id = v_contact_id WHERE id = r.courier_id;
            END IF;
          END IF;
        END LOOP;
      END $$;
    `);

    await client.query(`
      UPDATE couriers c
      SET contact_id = a.contact_id
      FROM accounts a
      WHERE c.account_id = a.id AND a.contact_id IS NOT NULL AND c.contact_id IS NULL
    `);

    console.log('Backfill done.');

    // Verify
    const couriers = await client.query('SELECT id, name, contact_id, account_id FROM couriers LIMIT 20');
    console.log('Sample couriers:', couriers.rows.length);
    couriers.rows.forEach((r) => console.log('  ', r.name, 'contact_id:', r.contact_id ? 'set' : 'null'));
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err.message);
  if (err.detail) console.error('Detail:', err.detail);
  process.exit(1);
});
