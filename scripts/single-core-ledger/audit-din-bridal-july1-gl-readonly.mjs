#!/usr/bin/env node
/**
 * Read-only DIN BRIDAL July 1 GL activity audit (no writes).
 * Usage: node scripts/single-core-ledger/audit-din-bridal-july1-gl-readonly.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const COMPANY_ID = '597a5292-14c8-4cd8-96bd-c61b5a0d8c92';
const CLEAN_SNAPSHOT_UTC = process.env.AUDIT_SINCE_UTC || '2026-07-01T11:32:17.138Z';
const ENTRY_DATE = '2026-07-01';
const OUT_DIR = resolve(ROOT, 'reports/din-bridal-july1-gl-activity-audit-20260701');

function loadMigrationEnv() {
  const candidates = [
    resolve(ROOT, 'migration-tools/.env.migration'),
    resolve(ROOT, '.env.local'),
    resolve(ROOT, '.env'),
  ];
  const env = {};
  for (const p of candidates) {
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq < 1) continue;
      const k = trimmed.slice(0, eq).trim();
      let v = trimmed.slice(eq + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      if (!env[k]) env[k] = v;
    }
  }
  return env;
}

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

const CASH_TYPES = new Set(['cash', 'bank', 'mobile_wallet', 'Cash', 'Bank', 'Mobile Wallet']);

async function main() {
  const env = loadMigrationEnv();
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing production Supabase URL or service role key');
  const sb = createClient(url, key);

  const { data: accounts } = await sb
    .from('accounts')
    .select('id, code, name, type')
    .eq('company_id', COMPANY_ID);
  const acctMap = new Map((accounts || []).map((a) => [a.id, a]));

  const { data: jesByDate, error: jeDateErr } = await sb
    .from('journal_entries')
    .select(
      'id, entry_no, entry_date, created_at, updated_at, is_void, voided_at, reference_type, reference_id, payment_id, description, total_debit, total_credit, branch_id, created_by'
    )
    .eq('company_id', COMPANY_ID)
    .eq('entry_date', ENTRY_DATE)
    .order('created_at', { ascending: true });

  if (jeDateErr) throw jeDateErr;

  const { data: jesAfterSnapshot } = await sb
    .from('journal_entries')
    .select(
      'id, entry_no, entry_date, created_at, updated_at, is_void, voided_at, reference_type, reference_id, payment_id, description, total_debit, total_credit, branch_id, created_by'
    )
    .eq('company_id', COMPANY_ID)
    .gte('created_at', CLEAN_SNAPSHOT_UTC)
    .order('created_at', { ascending: true });

  const jeIds = [...new Set([...(jesByDate || []), ...(jesAfterSnapshot || [])].map((j) => j.id))];

  let lines = [];
  if (jeIds.length) {
    const { data: lineRows, error: lineErr } = await sb
      .from('journal_entry_lines')
      .select('id, journal_entry_id, account_id, debit, credit, description')
      .in('journal_entry_id', jeIds);
    if (lineErr) throw lineErr;
    lines = lineRows || [];
  }

  const enrichedLines = lines.map((l) => {
    const acct = acctMap.get(l.account_id) || {};
    return {
      ...l,
      account_code: acct.code || null,
      account_name: acct.name || null,
      account_type: acct.type || null,
      is_cash_bank: CASH_TYPES.has(acct.type) || /^10[0-9]{2}$/.test(String(acct.code || '')),
    };
  });

  const linesByJe = new Map();
  for (const l of enrichedLines) {
    if (!linesByJe.has(l.journal_entry_id)) linesByJe.set(l.journal_entry_id, []);
    linesByJe.get(l.journal_entry_id).push(l);
  }

  function enrichJe(je) {
    const jLines = linesByJe.get(je.id) || [];
    const totalDebit = round2(jLines.reduce((s, x) => s + Number(x.debit || 0), 0));
    const totalCredit = round2(jLines.reduce((s, x) => s + Number(x.credit || 0), 0));
    const cashDebit = round2(jLines.filter((x) => x.is_cash_bank).reduce((s, x) => s + Number(x.debit || 0), 0));
    const cashCredit = round2(jLines.filter((x) => x.is_cash_bank).reduce((s, x) => s + Number(x.credit || 0), 0));
    return {
      ...je,
      line_count: jLines.length,
      computed_total_debit: totalDebit,
      computed_total_credit: totalCredit,
      cash_bank_debit: cashDebit,
      cash_bank_credit: cashCredit,
      net_cash_in_proxy: round2(cashDebit - cashCredit),
      lines: jLines,
    };
  }

  const activeAfterSnapshot = (jesAfterSnapshot || []).filter((j) => !j.is_void);
  const activeByDate = (jesByDate || []).filter((j) => !j.is_void);
  const enrichedAfter = activeAfterSnapshot.map(enrichJe);
  const enrichedByDate = activeByDate.map(enrichJe);

  const tbContribution = round2(
    enrichedAfter.reduce((s, j) => s + Number(j.computed_total_debit || 0), 0)
  );
  const roznamchaCashInProxy = round2(
    enrichedAfter.reduce((s, j) => s + Number(j.net_cash_in_proxy || 0), 0)
  );

  const { data: paymentsAfter } = await sb
    .from('payments')
    .select(
      'id, reference_number, reference_type, reference_id, amount, payment_type, payment_method, account_id, contact_id, contact_name, journal_entry_id, created_at, updated_at, created_by, voided_at, branch_id, notes'
    )
    .eq('company_id', COMPANY_ID)
    .gte('created_at', CLEAN_SNAPSHOT_UTC)
    .order('created_at', { ascending: true });

  const { data: paymentsByDate } = await sb
    .from('payments')
    .select(
      'id, reference_number, reference_type, reference_id, amount, payment_type, payment_method, account_id, contact_id, contact_name, journal_entry_id, created_at, updated_at, created_by, voided_at, branch_id, notes'
    )
    .eq('company_id', COMPANY_ID)
    .gte('created_at', `${ENTRY_DATE}T00:00:00`)
    .lt('created_at', `${ENTRY_DATE}T23:59:59.999Z`)
    .order('created_at', { ascending: true });

  const paymentIds = [...new Set([...(paymentsAfter || []), ...(paymentsByDate || [])].map((p) => p.id))];
  let sales = [];
  let rentals = [];
  let expenses = [];
  const refIds = {
    sale: new Set(),
    purchase: new Set(),
    rental: new Set(),
    expense: new Set(),
  };
  for (const p of [...(paymentsAfter || []), ...(paymentsByDate || [])]) {
    if (p.reference_type && p.reference_id) refIds[p.reference_type]?.add(p.reference_id);
  }
  if (refIds.sale.size) {
    const { data } = await sb.from('sales').select('id, invoice_number, status, total_amount, contact_id, branch_id, created_at, finalized_at').in('id', [...refIds.sale]);
    sales = data || [];
  }
  if (refIds.rental.size) {
    const { data } = await sb.from('rentals').select('id, reference_number, status, total_amount, contact_id, branch_id, created_at').in('id', [...refIds.rental]);
    rentals = data || [];
  }
  if (refIds.expense.size) {
    const { data } = await sb.from('expenses').select('id, reference_number, status, amount, contact_id, branch_id, created_at').in('id', [...refIds.expense]);
    expenses = data || [];
  }

  const payload = {
    generated_at: new Date().toISOString(),
    company_id: COMPANY_ID,
    clean_snapshot_utc: CLEAN_SNAPSHOT_UTC,
    entry_date: ENTRY_DATE,
    journal_entries_entry_date_count: (jesByDate || []).length,
    journal_entries_after_snapshot_count: (jesAfterSnapshot || []).length,
    active_journal_entries_after_snapshot: enrichedAfter,
    active_journal_entries_on_date: enrichedByDate,
    tb_debit_sum_after_snapshot_active: tbContribution,
    roznamcha_cash_in_proxy_sum_after_snapshot: roznamchaCashInProxy,
    payments_after_snapshot: (paymentsAfter || []).filter((p) => !p.voided_at),
    payments_on_date: (paymentsByDate || []).filter((p) => !p.voided_at),
    source_documents: { sales, rentals, expenses },
    grouped_by_reference_type: Object.groupBy(enrichedAfter, (j) => j.reference_type || 'manual'),
  };

  mkdirSync(OUT_DIR, { recursive: true });
  const outPath = resolve(OUT_DIR, '_audit-raw.json');
  writeFileSync(outPath, JSON.stringify(payload, null, 2));
  console.log(JSON.stringify({
    ok: true,
    outPath,
    je_after_snapshot: enrichedAfter.length,
    tb_debit_sum: tbContribution,
    roznamcha_proxy: roznamchaCashInProxy,
    payments_after: (paymentsAfter || []).filter((p) => !p.voided_at).length,
    entry_nos: enrichedAfter.map((j) => j.entry_no),
  }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
