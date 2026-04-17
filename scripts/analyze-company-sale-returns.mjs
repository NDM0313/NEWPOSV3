/**
 * Read-only analysis: sale_return JEs + AR lines for company 375fa03b-...
 * Usage: node scripts/analyze-company-sale-returns.mjs [company_uuid]
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

function get(pathWithQuery) {
  return new Promise((resolve, reject) => {
    const u = new URL(`${BASE}/rest/v1/${pathWithQuery}`);
    const req = https.request(
      {
        method: 'GET',
        hostname: u.hostname,
        port: u.port || 443,
        path: u.pathname + u.search,
        headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
      },
      (res) => {
        let d = '';
        res.on('data', (c) => (d += c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(d || '[]'));
          } catch {
            resolve(d);
          }
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

async function run() {
  if (!BASE || !KEY) {
    console.error('Missing env');
    process.exit(1);
  }

  const jes = await get(
    `journal_entries?company_id=eq.${COMPANY_ID}&reference_type=not.is.null&select=id,entry_no,reference_type,reference_id,is_void&order=entry_date.desc&limit=500`
  );
  const retJes = (jes || []).filter(
    (j) => String(j.reference_type || '').toLowerCase().replace(/\s+/g, '_') === 'sale_return'
  );
  const weird = (jes || []).filter((j) =>
    /return/i.test(String(j.reference_type || '')) && String(j.reference_type) !== 'sale_return'
  );

  console.log('Company:', COMPANY_ID);
  console.log('Journal rows (recent 500) with reference_type containing normalized sale_return:', retJes.length);
  console.log('Other *return* reference_type (legacy?):', weird.map((w) => w.reference_type).filter(Boolean));

  for (const je of retJes.slice(0, 5)) {
    const lines = await get(
      `journal_entry_lines?journal_entry_id=eq.${je.id}&select=debit,credit,account_id,account:accounts(code,name,linked_contact_id)`
    );
    console.log('\nJE', je.entry_no, je.reference_id, 'void=', je.is_void);
    for (const L of lines || []) {
      const a = Array.isArray(L.account) ? L.account[0] : L.account;
      console.log(
        '  line',
        'Dr',
        L.debit || 0,
        'Cr',
        L.credit || 0,
        a?.code,
        a?.name?.slice(0, 40),
        'linked_contact',
        a?.linked_contact_id ? String(a.linked_contact_id).slice(0, 8) + '…' : '—'
      );
    }
  }

  const srs = await get(
    `sale_returns?company_id=eq.${COMPANY_ID}&select=id,return_no,customer_id,original_sale_id,status,total&order=created_at.desc&limit=20`
  );
  console.log('\nRecent sale_returns (up to 20):');
  for (const s of srs || []) {
    console.log(
      s.return_no,
      'cust',
      s.customer_id ? String(s.customer_id).slice(0, 8) + '…' : 'NULL',
      'status',
      s.status,
      'total',
      s.total
    );
  }
}

run().catch(console.error);
