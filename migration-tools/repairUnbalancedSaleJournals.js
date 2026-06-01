/**
 * Repair unbalanced canonical sale document JEs (void + record_sale_with_accounting).
 * Usage: node migration-tools/repairUnbalancedSaleJournals.js [--confirm]
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '.env.migration');
if (fs.existsSync(envPath)) dotenv.config({ path: envPath });

const confirm = process.argv.includes('--confirm');
const companyId = (process.env.TARGET_COMPANY_ID || '').replace(/"/g, '').trim();
const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!companyId || !supabaseUrl || !serviceRoleKey) {
  console.error('Missing TARGET_COMPANY_ID, SUPABASE_URL, or SUPABASE_SERVICE_ROLE_KEY in migration-tools/.env.migration');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function findUnbalancedSaleDocumentSaleIds() {
  const { data: entries, error } = await supabase
    .from('journal_entries')
    .select('id, reference_type, reference_id, payment_id, is_void')
    .eq('company_id', companyId);
  if (error) throw error;

  const active = (entries || []).filter((e) => e.is_void !== true);
  const ids = active.map((e) => e.id);
  if (!ids.length) return [];

  const { data: lines, error: lineErr } = await supabase
    .from('journal_entry_lines')
    .select('journal_entry_id, debit, credit')
    .in('journal_entry_id', ids);
  if (lineErr) throw lineErr;

  const sums = new Map();
  for (const id of ids) sums.set(id, { d: 0, c: 0 });
  for (const l of lines || []) {
    const s = sums.get(l.journal_entry_id);
    if (!s) continue;
    s.d += Number(l.debit) || 0;
    s.c += Number(l.credit) || 0;
  }

  const byId = new Map(active.map((e) => [e.id, e]));
  const saleIds = new Set();
  for (const [jeId, s] of sums) {
    const diff = Math.round((s.d - s.c) * 100) / 100;
    if (Math.abs(diff) <= 0.01) continue;
    const e = byId.get(jeId);
    if (!e) continue;
    if (String(e.reference_type || '').toLowerCase() !== 'sale') continue;
    if (e.payment_id) continue;
    if (e.reference_id) saleIds.add(e.reference_id);
  }
  return [...saleIds];
}

async function voidCanonicalSaleDocumentJes(saleId) {
  const { data: jes, error } = await supabase
    .from('journal_entries')
    .select('id, is_void')
    .eq('reference_type', 'sale')
    .eq('reference_id', saleId)
    .is('payment_id', null);
  if (error) throw error;
  const ids = (jes || []).filter((j) => j.is_void !== true).map((j) => j.id);
  if (!ids.length) return 0;
  const now = new Date().toISOString();
  const { error: updErr } = await supabase
    .from('journal_entries')
    .update({
      is_void: true,
      void_reason: 'repair_unbalanced_sale_journals',
      voided_at: now,
    })
    .in('id', ids);
  if (updErr) throw updErr;
  return ids.length;
}

async function repairSale(saleId) {
  const voided = await voidCanonicalSaleDocumentJes(saleId);
  const { data, error } = await supabase.rpc('record_sale_with_accounting', { p_sale_id: saleId });
  if (error) throw new Error(error.message);
  if (data && typeof data === 'object' && data.skipped) {
    throw new Error(`RPC skipped after voiding ${voided} JE(s): ${data.reason || 'unknown'}`);
  }
  return data;
}

async function main() {
  const saleIds = await findUnbalancedSaleDocumentSaleIds();
  console.log(JSON.stringify({ companyId, scanned: saleIds.length, saleIds }, null, 2));

  if (!confirm) {
    console.log('Dry run. Pass --confirm to repair.');
    return;
  }

  const failed = [];
  let repaired = 0;
  for (const saleId of saleIds) {
    try {
      await repairSale(saleId);
      repaired++;
      console.log(`[OK] ${saleId}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      failed.push({ saleId, error: msg });
      console.error(`[FAIL] ${saleId}: ${msg}`);
    }
  }

  const result = { scanned: saleIds.length, repaired, failed };
  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
