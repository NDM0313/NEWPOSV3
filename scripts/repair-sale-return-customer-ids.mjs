/**
 * For a company: backfill sale_returns.customer_id from sales when missing
 * (fixes customer ledger / arJournalLineMatchesCustomer party resolution).
 *
 * Usage: node scripts/repair-sale-return-customer-ids.mjs
 * Requires: .env.local with VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 */
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function loadEnv() {
  for (const f of ['.env.local', '.env']) {
    const p = path.join(root, f);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq === -1) continue;
      const key = t.slice(0, eq).trim();
      let val = t.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
        val = val.slice(1, -1);
      const hashIdx = val.indexOf('#');
      if (hashIdx > 0 && !val.startsWith('"')) val = val.slice(0, hashIdx).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  }
}
loadEnv();

const BASE = process.env.VITE_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const COMPANY_ID = process.argv[2] || '375fa03b-8e1e-46d3-9cfe-1cc20c02b473';

function request(method, pathWithQuery, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(`${BASE}/rest/v1/${pathWithQuery}`);
    const opts = {
      method,
      hostname: u.hostname,
      port: u.port || 443,
      path: u.pathname + u.search,
      headers: {
        apikey: KEY,
        Authorization: `Bearer ${KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
    };
    const req = https.request(opts, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: d ? JSON.parse(d) : null });
        } catch {
          resolve({ status: res.statusCode, data: d });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function run() {
  if (!BASE || !KEY) {
    console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
  }

  console.log('Company:', COMPANY_ID);
  console.log('Supabase:', BASE.replace(/\/\/.*@/, '//***@'));

  // 1) Returns with missing customer_id but have original_sale_id
  const q1 = `sale_returns?company_id=eq.${COMPANY_ID}&customer_id=is.null&original_sale_id=not.is.null&select=id,return_no,status,original_sale_id,created_at&order=created_at.desc`;
  const r1 = await request('GET', q1);
  if (r1.status !== 200) {
    console.error('Query sale_returns failed:', r1.status, r1.data);
    process.exit(1);
  }
  const missing = Array.isArray(r1.data) ? r1.data : [];
  console.log(`\n[sale_returns] rows with customer_id NULL but original_sale_id set: ${missing.length}`);

  let patched = 0;
  let skipped = 0;

  for (const row of missing) {
    const sid = row.original_sale_id;
    const rSale = await request(
      'GET',
      `sales?id=eq.${sid}&company_id=eq.${COMPANY_ID}&select=id,customer_id,customer_name,invoice_no`
    );
    const sales = Array.isArray(rSale.data) ? rSale.data : [];
    const cust = sales[0]?.customer_id;
    if (!cust) {
      console.warn(`  Skip ${row.return_no || row.id}: sale ${sid} has no customer_id`);
      skipped++;
      continue;
    }
    const patch = await request('PATCH', `sale_returns?id=eq.${row.id}`, { customer_id: cust });
    if (patch.status !== 200 && patch.status !== 204) {
      console.error(`  PATCH failed ${row.id}:`, patch.status, patch.data);
      skipped++;
      continue;
    }
    console.log(`  OK ${row.return_no || row.id} ← customer_id ${cust}`);
    patched++;
  }

  // 2) Journal entries: sale_return with this company — count by void
  const qJe = `journal_entries?company_id=eq.${COMPANY_ID}&reference_type=eq.sale_return&select=id,entry_no,entry_date,reference_id,is_void&limit=500`;
  const rJe = await request('GET', qJe);
  const jes = Array.isArray(rJe.data) ? rJe.data : [];
  const active = jes.filter((j) => !j.is_void);
  console.log(`\n[journal_entries] reference_type=sale_return: total ${jes.length}, non-void ${active.length}`);

  // 3) Spot-check: returns that still don't match party (customer_id null after patch attempt)
  const r2 = await request(
    'GET',
    `sale_returns?company_id=eq.${COMPANY_ID}&customer_id=is.null&select=id,return_no,original_sale_id&limit=20`
  );
  const stillNull = Array.isArray(r2.data) ? r2.data : [];
  console.log(`\n[sale_returns] still customer_id NULL: ${stillNull.length}`);

  console.log(`\nDone. Patched: ${patched}, skipped: ${skipped}`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
