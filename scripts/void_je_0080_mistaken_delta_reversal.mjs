/**
 * Void mistaken correction_reversal JE-0080 (Rs 5k delta-only reverse on PF-14 tail).
 * Safe: no DELETE; sets is_void + void_reason (+ voided_at if column exists).
 *
 * Usage:
 *   node scripts/void_je_0080_mistaken_delta_reversal.mjs
 *   node scripts/void_je_0080_mistaken_delta_reversal.mjs --dry-run
 *
 * Requires .env.local: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';
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

const COMPANY_ID = '595c08c2-1e47-4581-89c9-1f78de51c613';
const ENTRY_NO = 'JE-0080';
const VOID_REASON =
  'Mistaken correction_reversal: mirrored tail PF-14 delta (Rs 5,000) instead of full effective payment. Voided to restore GL before re-reversing with composite effective-total logic.';

const dryRun = process.argv.includes('--dry-run');

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(url, key);

const nowIso = new Date().toISOString();

const { data: rows, error: selErr } = await supabase
  .from('journal_entries')
  .select('id, entry_no, description, reference_type, reference_id, is_void, payment_id')
  .eq('company_id', COMPANY_ID)
  .eq('entry_no', ENTRY_NO);

if (selErr) {
  console.error('Select error:', selErr.message);
  process.exit(1);
}

if (!rows?.length) {
  console.error(`No row found: company=${COMPANY_ID} entry_no=${ENTRY_NO}`);
  process.exit(1);
}

if (rows.length > 1) {
  console.error('Multiple rows match entry_no — aborting:', rows.map((r) => r.id));
  process.exit(1);
}

const row = rows[0];
console.log('Found:', {
  id: row.id,
  entry_no: row.entry_no,
  reference_type: row.reference_type,
  reference_id: row.reference_id,
  is_void: row.is_void,
  description: row.description?.slice(0, 80),
});

if (row.is_void === true) {
  console.log('Already void — nothing to do.');
  process.exit(0);
}

const rt = String(row.reference_type || '').toLowerCase();
if (rt !== 'correction_reversal') {
  console.error(`Expected reference_type correction_reversal, got "${row.reference_type}" — aborting.`);
  process.exit(1);
}

if (dryRun) {
  console.log('[dry-run] Would void id', row.id);
  process.exit(0);
}

const patch = {
  is_void: true,
  void_reason: VOID_REASON,
  voided_at: nowIso,
};

const { error: updErr } = await supabase.from('journal_entries').update(patch).eq('id', row.id).eq('company_id', COMPANY_ID);

if (updErr) {
  console.error('Update error:', updErr.message);
  process.exit(1);
}

console.log('Voided journal_entries.id =', row.id, 'entry_no =', ENTRY_NO);
