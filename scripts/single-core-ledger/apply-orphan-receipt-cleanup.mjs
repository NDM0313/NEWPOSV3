#!/usr/bin/env node
/**
 * Controlled soft-cancel/hide for orphan manual receipts (RCV-0081 / RCV-0082).
 * Requires safety checks before any mutation.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const COMPANY_ID = '597a5292-14c8-4cd8-96bd-c61b5a0d8c92';
const TARGET_REFS = ['RCV-0081', 'RCV-0082'];
const TARGET_JE_NOS = ['JE-0209', 'JE-0210'];
const VOID_REASON =
  'Duplicate failed web receipt retry artifact — no posted double-entry lines. Soft-hidden per operator request.';
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

async function safetyCheck(sb, payment) {
  const ref = payment.reference_number;
  const paymentId = payment.id;
  const issues = [];

  if (!TARGET_REFS.includes(ref)) issues.push(`reference ${ref} not in allowlist`);

  const { data: jes } = await sb
    .from('journal_entries')
    .select('id, entry_no, reference_type, payment_id, is_void')
    .eq('company_id', COMPANY_ID)
    .eq('payment_id', paymentId);

  for (const je of jes || []) {
    if (!TARGET_JE_NOS.includes(je.entry_no)) {
      issues.push(`linked JE ${je.entry_no} not in allowlist`);
    }
    const { count } = await sb
      .from('journal_entry_lines')
      .select('id', { count: 'exact', head: true })
      .eq('journal_entry_id', je.id);
    if ((count ?? 0) >= 2) issues.push(`${je.entry_no} has ${count} posted lines`);
  }

  const { count: allocCount } = await sb
    .from('payment_allocations')
    .select('id', { count: 'exact', head: true })
    .eq('payment_id', paymentId);
  if ((allocCount ?? 0) > 0) issues.push(`allocations=${allocCount}`);

  return { safe: issues.length === 0, issues, journalEntries: jes || [] };
}

async function applySoftCancel(sb, payment, journalEntries) {
  const nowIso = new Date().toISOString();
  const paymentId = payment.id;

  if (!payment.voided_at) {
    const { error } = await sb
      .from('payments')
      .update({ voided_at: nowIso })
      .eq('id', paymentId)
      .eq('company_id', COMPANY_ID);
    if (error) throw error;
  }

  const voidedJeIds = [];
  for (const je of journalEntries) {
    if (je.is_void === true) continue;
    const { error } = await sb
      .from('journal_entries')
      .update({ is_void: true, void_reason: VOID_REASON, voided_at: nowIso })
      .eq('id', je.id)
      .eq('company_id', COMPANY_ID);
    if (error) throw error;
    voidedJeIds.push(je.id);
  }

  return { paymentId, voidedJeIds, voidedAt: nowIso };
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const env = loadEnv();
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase URL or service role key');
  const sb = createClient(url, key);
  mkdirSync(OUT_DIR, { recursive: true });

  const { data: payments, error } = await sb
    .from('payments')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .in('reference_number', TARGET_REFS);
  if (error) throw error;

  const results = [];
  for (const payment of payments || []) {
    const check = await safetyCheck(sb, payment);
    if (!check.safe) {
      results.push({
        reference: payment.reference_number,
        paymentId: payment.id,
        applied: false,
        blocked: true,
        issues: check.issues,
      });
      continue;
    }
    if (dryRun) {
      results.push({
        reference: payment.reference_number,
        paymentId: payment.id,
        applied: false,
        dryRun: true,
        wouldVoidJournalEntries: check.journalEntries.map((j) => j.entry_no),
      });
      continue;
    }
    const applied = await applySoftCancel(sb, payment, check.journalEntries);
    results.push({
      reference: payment.reference_number,
      paymentId: payment.id,
      applied: true,
      ...applied,
      voidReason: VOID_REASON,
    });
  }

  const report = {
    runAt: new Date().toISOString(),
    companyId: COMPANY_ID,
    dryRun,
    decision: 'SAFE_CANCEL_HIDE_BOTH_ORPHAN_RECEIPTS',
    voidReason: VOID_REASON,
    results,
    allApplied: results.every((r) => r.applied === true),
    anyBlocked: results.some((r) => r.blocked),
  };

  writeFileSync(resolve(OUT_DIR, 'orphan-cleanup-apply.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (report.anyBlocked) process.exit(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
