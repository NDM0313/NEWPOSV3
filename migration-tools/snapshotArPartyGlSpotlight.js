#!/usr/bin/env node
/**
 * Pre/post Phase 4 snapshot: party GL vs RPC vs sales.due for spotlight customers.
 * Usage: node migration-tools/snapshotArPartyGlSpotlight.js
 */
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';
import { loadMigrationEnv } from './lib/loadMigrationEnv.js';
import { dryRunDir, ensureDinChinaDirs } from './lib/dinChinaPaths.js';

const COMPANY_ID = '30bd8592-3384-4f34-899a-f3907e336485';
const SPOTLIGHT_CODES = ['AR-A987EE', 'AR-2BA4BA', 'AR-F8FD5E', 'AR-ED1ABD'];

async function partyNet(sb, accountId) {
  const { data: lines } = await sb
    .from('journal_entry_lines')
    .select('debit, credit, journal_entries!inner(is_void)')
    .eq('account_id', accountId)
    .eq('journal_entries.is_void', false);
  const dr = (lines || []).reduce((s, l) => s + Number(l.debit || 0), 0);
  const cr = (lines || []).reduce((s, l) => s + Number(l.credit || 0), 0);
  return Math.round((dr - cr) * 100) / 100;
}

async function main() {
  const env = loadMigrationEnv([
    '--dry-run',
    '--require-supabase',
    '--company-id',
    COMPANY_ID,
  ]);
  const sb = createClient(env.supabaseUrl, env.serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data: rpc } = await sb.rpc('get_contact_party_gl_balances', {
    p_company_id: COMPANY_ID,
    p_branch_id: null,
  });

  const rows = [];
  for (const code of SPOTLIGHT_CODES) {
    const { data: acct } = await sb
      .from('accounts')
      .select('id, linked_contact_id')
      .eq('company_id', COMPANY_ID)
      .eq('code', code)
      .single();
    if (!acct) continue;
    const { data: c } = await sb.from('contacts').select('name').eq('id', acct.linked_contact_id).single();
    const { data: sales } = await sb
      .from('sales')
      .select('due_amount')
      .eq('company_id', COMPANY_ID)
      .eq('customer_id', acct.linked_contact_id)
      .eq('status', 'final');
    const saleDue = (sales || []).reduce((s, x) => s + Number(x.due_amount || 0), 0);
    const net = await partyNet(sb, acct.id);
    const rpcRow = (rpc || []).find((r) => r.contact_id === acct.linked_contact_id);
    rows.push({
      name: c?.name,
      arCode: code,
      partyGlNet: net,
      rpcAr: Number(rpcRow?.gl_ar_receivable || 0),
      salesDueSum: Math.round(saleDue * 100) / 100,
      gapGlMinusDue: Math.round((net - saleDue) * 100) / 100,
    });
  }

  ensureDinChinaDirs();
  const outPath = path.join(dryRunDir(), 'ar_party_gl_spotlight_snapshot.json');
  const payload = {
    capturedAt: new Date().toISOString(),
    supabaseHost: new URL(env.supabaseUrl).host,
    label: process.argv.includes('--post') ? 'post_phase4' : 'pre_phase4',
    rows,
  };
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8');
  console.log(JSON.stringify(payload, null, 2));
  console.log('\nWrote', outPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
