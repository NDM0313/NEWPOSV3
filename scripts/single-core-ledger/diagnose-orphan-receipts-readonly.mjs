#!/usr/bin/env node
/**
 * Read-only orphan receipt diagnosis for RCV-0081 / RCV-0082 (no writes).
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const COMPANY_ID = '597a5292-14c8-4cd8-96bd-c61b5a0d8c92';
const REFS = ['RCV-0081', 'RCV-0082'];
const JE_NOS = ['JE-0209', 'JE-0210'];
const OUT_DIR = resolve(ROOT, 'reports/web-payment-orphan-receipt-fix-stability-day1-20260701');

function loadEnv() {
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
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (!env[k]) env[k] = v;
    }
  }
  return env;
}

async function main() {
  const env = loadEnv();
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase URL or service role key');
  const sb = createClient(url, key);

  mkdirSync(OUT_DIR, { recursive: true });

  const { data: payments, error: payErr } = await sb
    .from('payments')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .in('reference_number', REFS);
  if (payErr) throw payErr;

  const paymentIds = (payments || []).map((p) => p.id);
  const { data: jesByNo } = await sb
    .from('journal_entries')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .in('entry_no', JE_NOS);
  const { data: jesByPay } = paymentIds.length
    ? await sb.from('journal_entries').select('*').eq('company_id', COMPANY_ID).in('payment_id', paymentIds)
    : { data: [] };

  const jeIds = [...new Set([...(jesByNo || []), ...(jesByPay || [])].map((j) => j.id))];
  const { data: lines } = jeIds.length
    ? await sb.from('journal_entry_lines').select('*, accounts(code, name, type)').in('journal_entry_id', jeIds)
    : { data: [] };

  const linesByJe = new Map();
  for (const line of lines || []) {
    const arr = linesByJe.get(line.journal_entry_id) || [];
    arr.push(line);
    linesByJe.set(line.journal_entry_id, arr);
  }

  const { data: allocs } = paymentIds.length
    ? await sb.from('payment_allocations').select('*').in('payment_id', paymentIds)
    : { data: [] };

  const contactIds = [...new Set((payments || []).map((p) => p.contact_id).filter(Boolean))];
  const { data: contacts } = contactIds.length
    ? await sb.from('contacts').select('id, name, contact_type').in('id', contactIds)
    : { data: [] };
  const contactMap = new Map((contacts || []).map((c) => [c.id, c]));

  const records = [];
  for (const ref of REFS) {
    const payment = (payments || []).find((p) => p.reference_number === ref);
    if (!payment) {
      records.push({ reference_number: ref, found: false });
      continue;
    }
    const je =
      (jesByNo || []).find((j) => j.payment_id === payment.id) ||
      (jesByPay || []).find((j) => j.payment_id === payment.id);
    const jeLines = je ? linesByJe.get(je.id) || [] : [];
    const paymentAllocs = (allocs || []).filter((a) => a.payment_id === payment.id);
    const debitTotal = jeLines.reduce((s, l) => s + Number(l.debit || 0), 0);
    const creditTotal = jeLines.reduce((s, l) => s + Number(l.credit || 0), 0);
    records.push({
      reference_number: ref,
      found: true,
      payment: {
        id: payment.id,
        reference_number: payment.reference_number,
        amount_pkr: Number(payment.amount),
        payment_method: payment.payment_method,
        payment_type: payment.payment_type,
        reference_type: payment.reference_type,
        status_fields: {
          voided_at: payment.voided_at,
          is_void: payment.is_void,
          cancelled_at: payment.cancelled_at,
        },
        payment_account_id: payment.payment_account_id,
        contact_id: payment.contact_id,
        contact_name: contactMap.get(payment.contact_id)?.name ?? null,
        payment_date: payment.payment_date,
        created_at: payment.created_at,
        updated_at: payment.updated_at,
        created_by: payment.created_by,
      },
      journal_entry: je
        ? {
            id: je.id,
            entry_no: je.entry_no,
            entry_date: je.entry_date,
            reference_type: je.reference_type,
            reference_id: je.reference_id,
            payment_id: je.payment_id,
            is_void: je.is_void,
            voided_at: je.voided_at,
            void_reason: je.void_reason,
            total_debit: je.total_debit,
            total_credit: je.total_credit,
            line_count: jeLines.length,
            computed_debit: debitTotal,
            computed_credit: creditTotal,
            balanced: Math.abs(debitTotal - creditTotal) < 0.01,
            lines: jeLines.map((l) => ({
              id: l.id,
              account_code: l.accounts?.code,
              account_name: l.accounts?.name,
              debit: l.debit,
              credit: l.credit,
            })),
          }
        : null,
      allocations: {
        count: paymentAllocs.length,
        total_allocated_pkr: paymentAllocs.reduce((s, a) => s + Number(a.amount || 0), 0),
        rows: paymentAllocs,
      },
      safety_checks: {
        journal_entry_lines_count: jeLines.length,
        has_posted_gl_lines: jeLines.length >= 2 && debitTotal > 0,
        allocation_count: paymentAllocs.length,
        allocated_amount_pkr: paymentAllocs.reduce((s, a) => s + Number(a.amount || 0), 0),
        cash_bank_impact: jeLines.some((l) => {
          const t = String(l.accounts?.type || '').toLowerCase();
          return ['cash', 'bank', 'mobile_wallet'].includes(t) || ['1002', '1003', '1010'].includes(String(l.accounts?.code));
        }),
        safe_for_soft_cancel: jeLines.length === 0 && paymentAllocs.length === 0,
      },
    });
  }

  const out = {
    run: 'WEB_PAYMENT_ORPHAN_RECEIPT_DIAGNOSIS',
    generated_at: new Date().toISOString(),
    company_id: COMPANY_ID,
    readonly: true,
    records,
    default_repair_decision: records.every((r) => r.found && r.safety_checks?.safe_for_soft_cancel)
      ? 'SAFE_CANCEL_HIDE_BOTH_ORPHAN_RECEIPTS'
      : 'STOP_REQUIRES_APPROVAL_PACK',
  };
  writeFileSync(resolve(OUT_DIR, 'orphan-receipt-diagnosis.json'), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
