#!/usr/bin/env node
/**
 * Verify party GL (TB / CS Due GL / BS) vs Ledger Statement closing for spotlight customers.
 */
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';
import { loadMigrationEnv } from './lib/loadMigrationEnv.js';
import { dryRunDir, ensureDinChinaDirs } from './lib/dinChinaPaths.js';

const COMPANY_ID = '30bd8592-3384-4f34-899a-f3907e336485';
const BRANCH_ID = '92f4184e-ee9b-4b6c-8e76-10ee1d166f55';

const SPOTLIGHT = [
  { code: 'AR-A987EE', nameHint: 'AZIZ' },
  { code: 'AR-2BA4BA', nameHint: 'SHAHURKH' },
  { code: 'AR-F8FD5E', nameHint: 'LAL' },
];

async function ledgerClosingFromDocs(sb, customerId) {
  const { data: sales } = await sb
    .from('sales')
    .select('id, total, paid_amount, due_amount')
    .eq('company_id', COMPANY_ID)
    .eq('customer_id', customerId)
    .eq('status', 'final');
  const saleIds = (sales || []).map((s) => s.id);
  let paySum = 0;
  if (saleIds.length) {
    const { data: pays } = await sb
      .from('payments')
      .select('amount')
      .eq('company_id', COMPANY_ID)
      .eq('reference_type', 'sale')
      .in('reference_id', saleIds)
      .is('voided_at', null);
    paySum = (pays || []).reduce((s, p) => s + Number(p.amount || 0), 0);
  }
  const total = (sales || []).reduce((s, x) => s + Number(x.total || 0), 0);
  const opening = 0;
  const { data: c } = await sb.from('contacts').select('opening_balance').eq('id', customerId).single();
  const ob = Math.max(0, Number(c?.opening_balance || 0));
  return Math.round((ob + total - paySum) * 100) / 100;
}

async function main() {
  const env = loadMigrationEnv(['--dry-run', '--require-supabase', '--company-id', COMPANY_ID]);
  const sb = createClient(env.supabaseUrl, env.serviceRoleKey, { auth: { persistSession: false } });

  const endDate = new Date().toISOString().slice(0, 10);
  const startDate = '2025-10-01';

  const { data: rpcGl } = await sb.rpc('get_contact_party_gl_balances', {
    p_company_id: COMPANY_ID,
    p_branch_id: null,
  });

  const { data: csRows } = await sb.rpc('get_customers_suppliers_report', {
    p_company_id: COMPANY_ID,
    p_start_date: startDate,
    p_end_date: endDate,
    p_branch_id: BRANCH_ID,
    p_contact_type: 'customer',
    p_balance_status: 'all',
  });

  const results = [];
  for (const spot of SPOTLIGHT) {
    const { data: acct } = await sb
      .from('accounts')
      .select('id, linked_contact_id')
      .eq('company_id', COMPANY_ID)
      .eq('code', spot.code)
      .single();
    const cid = acct.linked_contact_id;
    const { data: c } = await sb.from('contacts').select('name').eq('id', cid).single();

    const { data: lines } = await sb
      .from('journal_entry_lines')
      .select('debit, credit, journal_entries!inner(is_void)')
      .eq('account_id', acct.id)
      .eq('journal_entries.is_void', false);
    const dr = (lines || []).reduce((s, l) => s + Number(l.debit || 0), 0);
    const cr = (lines || []).reduce((s, l) => s + Number(l.credit || 0), 0);
    const tbPartyNet = Math.round((dr - cr) * 100) / 100;

    const rpcRow = (rpcGl || []).find((r) => r.contact_id === cid);
    const rpcAr = Math.round(Number(rpcRow?.gl_ar_receivable || 0) * 100) / 100;

    const csRow = (csRows || []).find((r) => r.contact_id === cid);
    const csDueGl = Math.round(Number(csRow?.due || 0) * 100) / 100;

    const stmtClosing = await ledgerClosingFromDocs(sb, cid);

    const matchTbRpc = Math.abs(tbPartyNet - rpcAr) < 0.02;
    const matchTbCs = Math.abs(tbPartyNet - csDueGl) < 0.02;
    const matchStmt = Math.abs(tbPartyNet - stmtClosing) < 0.02;

    results.push({
      name: c?.name,
      arCode: spot.code,
      trialBalancePartyNet: tbPartyNet,
      rpcPartyGl: rpcAr,
      customersReportDueGl: csDueGl,
      statementDocClosing: stmtClosing,
      tbMatchesRpc: matchTbRpc,
      tbMatchesCsReport: matchTbCs,
      tbMatchesStatement: matchStmt,
    });
  }

  ensureDinChinaDirs();
  const outPath = path.join(dryRunDir(), 'ar_party_tieout_verification.json');
  const payload = { verifiedAt: new Date().toISOString(), results };
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8');
  console.log(JSON.stringify(payload, null, 2));
  const allPass = results.every((r) => r.tbMatchesRpc && r.tbMatchesCsReport && r.tbMatchesStatement);
  console.log(allPass ? '\nVERIFY PASS' : '\nVERIFY FAIL — see mismatches above');
  console.log('Wrote', outPath);
  process.exit(allPass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
