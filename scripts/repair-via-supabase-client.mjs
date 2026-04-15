/**
 * Repair script using Node https module (bypasses undici encoding issues).
 * 1. Fix duplicate sale stock movements  2. Fix shipping AR  3. Fix COA parents
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
      // Strip inline comments (# ...) that aren't part of the value
      const hashIdx = val.indexOf('#');
      if (hashIdx > 0 && !val.startsWith('"')) val = val.slice(0, hashIdx).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  }
}
loadEnv();

const BASE = process.env.VITE_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CID = '375fa03b-8e1e-46d3-9cfe-1cc20c02b473';

function api(method, path, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(`${BASE}/rest/v1/${path}`);
    const opts = {
      method,
      hostname: u.hostname,
      port: u.port || 443,
      path: u.pathname + u.search,
      headers: {
        'apikey': KEY,
        'Authorization': `Bearer ${KEY}`,
        'Content-Type': 'application/json',
        'Prefer': method === 'POST' ? 'return=representation' : method === 'DELETE' ? 'return=minimal' : '',
      },
    };
    const req = https.request(opts, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d || '[]')); } catch { resolve(d); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function query(table, params) {
  const qs = Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  return api('GET', `${table}?${qs}`);
}

async function insert(table, data) {
  return api('POST', table, data);
}

async function update(table, filter, data) {
  const qs = Object.entries(filter).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  const u = new URL(`${BASE}/rest/v1/${table}?${qs}`);
  return new Promise((resolve, reject) => {
    const opts = {
      method: 'PATCH',
      hostname: u.hostname, port: u.port || 443,
      path: u.pathname + u.search,
      headers: { 'apikey': KEY, 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
    };
    const req = https.request(opts, (res) => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(d)); });
    req.on('error', reject);
    req.write(JSON.stringify(data));
    req.end();
  });
}

async function del(table, filter) {
  const qs = Object.entries(filter).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  const u = new URL(`${BASE}/rest/v1/${table}?${qs}`);
  return new Promise((resolve, reject) => {
    const opts = {
      method: 'DELETE',
      hostname: u.hostname, port: u.port || 443,
      path: u.pathname + u.search,
      headers: { 'apikey': KEY, 'Authorization': `Bearer ${KEY}`, 'Prefer': 'return=minimal' },
    };
    const req = https.request(opts, (res) => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(d)); });
    req.on('error', reject);
    req.end();
  });
}

async function run() {
  // ============ PART 1: Dedup stock movements ============
  console.log('=== PART 1: Fix duplicate sale stock movements ===\n');

  const allMov = await query('stock_movements', {
    select: 'id,product_id,variation_id,movement_type,quantity,reference_id,created_at',
    company_id: `eq.${CID}`,
    reference_type: 'eq.sale',
    order: 'created_at.asc',
    limit: '2000',
  });
  console.log(`Total movements: ${allMov.length}`);

  const groups = new Map();
  for (const m of allMov) {
    const mt = (m.movement_type || '').toLowerCase().trim();
    const k = `${m.reference_id}|${m.product_id}|${m.variation_id || ''}|${mt}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(m);
  }

  const toDelete = [];
  for (const [, rows] of groups.entries()) {
    if (rows.length <= 1) continue;
    for (let i = 1; i < rows.length; i++) toDelete.push(rows[i].id);
  }
  for (const m of allMov) {
    const mt = (m.movement_type || '').toLowerCase().trim();
    if (mt === 'sale' && m.quantity > 0 && !toDelete.includes(m.id)) toDelete.push(m.id);
  }

  for (const id of toDelete) {
    await del('stock_movements', { id: `eq.${id}` });
  }
  console.log(`✓ Deleted ${toDelete.length} duplicate/artifact movements\n`);

  // ============ PART 2: Shipping AR ============
  console.log('=== PART 2: Fix shipping AR ===\n');

  const sales = await query('sales', {
    select: 'id,invoice_no,total,shipment_charges,branch_id',
    company_id: `eq.${CID}`,
    status: 'eq.final',
    shipment_charges: 'gt.0',
  });
  console.log(`Sales with shipping: ${sales.length}`);

  const shipAcct = await query('accounts', { select: 'id', company_id: `eq.${CID}`, code: 'eq.4110', limit: '1' });
  if (!shipAcct.length) { console.log('No 4110'); return; }
  const shipId = shipAcct[0].id;

  for (const s of sales) {
    const shipping = Number(s.shipment_charges) || 0;
    if (shipping <= 0) continue;

    const jes = await query('journal_entries', {
      select: 'id', reference_type: 'eq.sale', reference_id: `eq.${s.id}`,
      or: '(is_void.is.null,is_void.eq.false)', limit: '1',
    });
    if (!jes.length) continue;

    const lines = await query('journal_entry_lines', {
      select: 'account_id,debit,description', journal_entry_id: `eq.${jes[0].id}`, 'debit': 'gt.0',
    });
    const arLine = lines.find(l => (l.description || '').toLowerCase().includes('receivable'));
    if (!arLine) continue;

    const gap = Math.round((Number(s.total) + shipping - Number(arLine.debit)) * 100) / 100;
    console.log(`  ${s.invoice_no}: total=${s.total} ship=${shipping} AR=${arLine.debit} gap=${gap}`);
    if (gap <= 0.01) { console.log('    → OK'); continue; }

    const entryNo = `JE-SHIP-REPAIR-${s.invoice_no}`;
    const ex = await query('journal_entries', {
      select: 'id', company_id: `eq.${CID}`, entry_no: `eq.${entryNo}`,
      or: '(is_void.is.null,is_void.eq.false)', limit: '1',
    });
    if (ex.length) { console.log('    → Already done'); continue; }

    const je = await insert('journal_entries', {
      company_id: CID, branch_id: s.branch_id || null,
      entry_no: entryNo, entry_date: new Date().toISOString().slice(0, 10),
      description: `Shipping AR correction ${s.invoice_no}: +Rs ${gap}`,
      reference_type: 'sale_adjustment', reference_id: s.id,
      total_debit: gap, total_credit: gap,
    });
    const jeId = Array.isArray(je) ? je[0]?.id : je?.id;
    if (!jeId) { console.error('    ✗ JE creation failed:', je); continue; }

    await insert('journal_entry_lines', [
      { journal_entry_id: jeId, account_id: arLine.account_id, debit: gap, credit: 0, description: `AR shipping +Rs ${gap}` },
      { journal_entry_id: jeId, account_id: shipId, debit: 0, credit: gap, description: `Shipping income Rs ${gap}` },
    ]);
    console.log(`    ✓ Dr AR Rs.${gap} / Cr Shipping Rs.${gap}`);
  }

  // ============ PART 3: COA parents ============
  console.log('\n=== PART 3: Fix COA parents ===\n');

  const fixes = [
    { code: '5200', parentCode: '6090', name: 'Discount Allowed', type: 'expense' },
    { code: '2040', parentCode: '2090', name: 'Salesman Payable', type: 'liability' },
  ];

  for (const r of fixes) {
    const acct = await query('accounts', { select: 'id,parent_id', company_id: `eq.${CID}`, code: `eq.${r.code}`, limit: '1' });
    const parent = await query('accounts', { select: 'id', company_id: `eq.${CID}`, code: `eq.${r.parentCode}`, limit: '1' });
    if (!parent.length) { console.log(`  ${r.parentCode} group not found`); continue; }

    if (!acct.length) {
      await insert('accounts', {
        company_id: CID, code: r.code, name: r.name, type: r.type,
        parent_id: parent[0].id, is_group: false, is_active: true,
      });
      console.log(`  ✓ Created ${r.code} ${r.name} under ${r.parentCode}`);
    } else if (!acct[0].parent_id) {
      await update('accounts', { id: `eq.${acct[0].id}` }, { parent_id: parent[0].id });
      console.log(`  ✓ ${r.code}: parent set to ${r.parentCode}`);
    } else {
      console.log(`  ${r.code}: already has parent`);
    }
  }

  console.log('\n=== ALL REPAIRS COMPLETE ===');
}

run().catch(e => { console.error('FAILED:', e); process.exit(1); });
