#!/usr/bin/env node
/**
 * SHOP CASH (180002) cash-book CSV import — dry-run + gated post.
 *
 * Columns: No, DATE, ACCOUNT NUMBER, Name, IN, OUT, Amount
 * IN  → Dr 180002 / Cr counterparty
 * OUT → Dr counterparty / Cr 180002
 * Amount = running balance (ignored)
 *
 * Usage:
 *   node scripts/shop-cash-csv-import.mjs --csv path/to.csv --dry-run
 *   node scripts/shop-cash-csv-import.mjs --csv path/to.csv --apply   # requires --confirm-production
 *
 * Env (apply): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, COMPANY_ID, BRANCH_ID (optional)
 * Or --company-id / --branch-id flags.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

function parseArgs(argv) {
  const out = {
    csv: null,
    dryRun: true,
    apply: false,
    confirmProduction: false,
    companyId: process.env.COMPANY_ID || null,
    branchId: process.env.BRANCH_ID || null,
    cashCode: '180002',
    report: null,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') out.dryRun = true;
    else if (a === '--apply') {
      out.apply = true;
      out.dryRun = false;
    } else if (a === '--confirm-production') out.confirmProduction = true;
    else if (a === '--csv') out.csv = argv[++i];
    else if (a === '--company-id') out.companyId = argv[++i];
    else if (a === '--branch-id') out.branchId = argv[++i];
    else if (a === '--cash-code') out.cashCode = argv[++i];
    else if (a === '--report') out.report = argv[++i];
  }
  return out;
}

function parseMoney(s) {
  if (s == null) return 0;
  const t = String(s).replace(/[",\s]/g, '').trim();
  if (!t) return 0;
  const n = Number(t);
  return Number.isFinite(n) ? n : 0;
}

function parseDateDMY(s) {
  const m = String(s || '')
    .trim()
    .match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const d = m[1].padStart(2, '0');
  const mo = m[2].padStart(2, '0');
  const y = m[3];
  return `${y}-${mo}-${d}`;
}

function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, '').trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const header = lines[0].split(',').map((h) => h.trim());
  const idx = (name) => header.findIndex((h) => h.toLowerCase() === name.toLowerCase());
  const iNo = idx('No');
  const iDate = idx('DATE');
  const iAcct = idx('ACCOUNT NUMBER');
  const iName = idx('Name');
  const iIn = idx('IN');
  const iOut = idx('OUT');

  const rows = [];
  for (let li = 1; li < lines.length; li++) {
    const line = lines[li];
    if (!line.trim()) continue;
    // naive CSV split that respects quoted fields
    const cols = [];
    let cur = '';
    let inQ = false;
    for (let c = 0; c < line.length; c++) {
      const ch = line[c];
      if (ch === '"') {
        inQ = !inQ;
        continue;
      }
      if (ch === ',' && !inQ) {
        cols.push(cur);
        cur = '';
        continue;
      }
      cur += ch;
    }
    cols.push(cur);

    const no = String(cols[iNo] ?? '').trim();
    const dateRaw = String(cols[iDate] ?? '').trim();
    const acct = String(cols[iAcct] ?? '').trim();
    const name = String(cols[iName] ?? '').trim();
    const inn = parseMoney(cols[iIn]);
    const outAmt = parseMoney(cols[iOut]);
    const entryDate = parseDateDMY(dateRaw);
    if (!entryDate || !acct) {
      rows.push({
        line: li + 1,
        no,
        error: `bad date/account: date=${dateRaw} acct=${acct}`,
      });
      continue;
    }
    if (inn > 0 && outAmt > 0) {
      rows.push({ line: li + 1, no, error: 'both IN and OUT set' });
      continue;
    }
    if (inn <= 0 && outAmt <= 0) {
      rows.push({ line: li + 1, no, error: 'no IN/OUT amount' });
      continue;
    }
    const side = inn > 0 ? 'IN' : 'OUT';
    const amount = inn > 0 ? inn : outAmt;
    const idempotencyKey = `shop-cash-csv:${no}|${entryDate}|${acct}|${side}|${amount.toFixed(2)}`;
    rows.push({
      line: li + 1,
      no,
      entryDate,
      counterpartyCode: acct,
      name,
      side,
      amount,
      description: `Cash book #${no} — ${name} (${side})`.slice(0, 240),
      idempotencyKey,
    });
  }
  return rows;
}

async function resolveAccounts(supabase, companyId, codes) {
  const unique = [...new Set(codes.map((c) => String(c).trim()).filter(Boolean))];
  const { data, error } = await supabase
    .from('accounts')
    .select('id, code, name, is_active')
    .eq('company_id', companyId)
    .in('code', unique);
  if (error) throw error;
  const byCode = new Map();
  for (const a of data || []) {
    byCode.set(String(a.code).trim(), a);
  }
  return byCode;
}

async function alreadyPosted(supabase, companyId, key) {
  // Idempotency: description contains key marker, or match action_fingerprint if column exists.
  const marker = `[csv:${key}]`;
  const { data, error } = await supabase
    .from('journal_entries')
    .select('id, entry_no')
    .eq('company_id', companyId)
    .ilike('description', `%${marker}%`)
    .limit(1);
  if (error) {
    // fallback without ilike marker search
    return null;
  }
  return data?.[0] || null;
}

async function postOne(supabase, companyId, branchId, cashId, counterpartyId, row) {
  const desc = `${row.description} [csv:${row.idempotencyKey}]`;
  const debitAccountId = row.side === 'IN' ? cashId : counterpartyId;
  const creditAccountId = row.side === 'IN' ? counterpartyId : cashId;

  // Prefer RPC-free insert via existing edge? Use service inserts mirroring createPureJournalEntry.
  const entryNo = `JE-CSV-${row.no}-${Date.now().toString(36).slice(-4)}`.toUpperCase();
  const { data: je, error: jeErr } = await supabase
    .from('journal_entries')
    .insert({
      company_id: companyId,
      branch_id: branchId,
      entry_no: entryNo,
      document_no: entryNo,
      entry_date: row.entryDate,
      description: desc,
      reference_type: 'journal',
      total_debit: row.amount,
      total_credit: row.amount,
      is_void: false,
    })
    .select('id, entry_no')
    .single();
  if (jeErr) throw jeErr;

  const { error: lineErr } = await supabase.from('journal_entry_lines').insert([
    {
      journal_entry_id: je.id,
      account_id: debitAccountId,
      debit: row.amount,
      credit: 0,
      description: desc,
    },
    {
      journal_entry_id: je.id,
      account_id: creditAccountId,
      debit: 0,
      credit: row.amount,
      description: desc,
    },
  ]);
  if (lineErr) throw lineErr;
  return je;
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.csv) {
    console.error('Missing --csv path');
    process.exit(2);
  }
  const csvPath = path.resolve(args.csv);
  const text = fs.readFileSync(csvPath, 'utf8');
  const parsed = parseCsv(text);
  const errors = parsed.filter((r) => r.error);
  const okRows = parsed.filter((r) => !r.error);

  const report = {
    csv: csvPath,
    cashCode: args.cashCode,
    rowCount: parsed.length,
    okCount: okRows.length,
    errorCount: errors.length,
    parseErrors: errors,
    missingCodes: [],
    preview: [],
    posted: [],
    skipped: [],
    failed: [],
  };

  console.log(`Parsed ${okRows.length} ok / ${errors.length} errors from ${csvPath}`);

  if (!args.companyId) {
    report.note =
      'No COMPANY_ID — local parse-only dry-run. Unique counterparty codes listed; resolve against CoA with --company-id + Supabase env.';
    const codes = [...new Set(okRows.map((r) => r.counterpartyCode))];
    report.uniqueCounterpartyCodes = codes.sort();
    report.preview = okRows.slice(0, 15).map((r) => ({
      no: r.no,
      date: r.entryDate,
      side: r.side,
      amount: r.amount,
      counterparty: r.counterpartyCode,
      name: r.name,
      je:
        r.side === 'IN'
          ? `Dr ${args.cashCode} / Cr ${r.counterpartyCode}`
          : `Dr ${r.counterpartyCode} / Cr ${args.cashCode}`,
    }));
    const outPath = args.report || path.join(path.dirname(csvPath), 'shop-cash-csv-dry-run.json');
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
    console.log(`Wrote parse dry-run → ${outPath}`);
    console.log(`Unique codes (${codes.length}): ${codes.join(', ')}`);
    process.exit(errors.length ? 1 : 0);
  }

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    console.error('Need SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for CoA resolve / apply');
    process.exit(2);
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const codes = [args.cashCode, ...okRows.map((r) => r.counterpartyCode)];
  const byCode = await resolveAccounts(supabase, args.companyId, codes);
  const cash = byCode.get(args.cashCode);
  if (!cash) {
    report.missingCodes.push(args.cashCode);
    console.error(`Cash account ${args.cashCode} not found for company ${args.companyId}`);
  }
  for (const code of new Set(okRows.map((r) => r.counterpartyCode))) {
    if (!byCode.has(code)) report.missingCodes.push(code);
  }
  report.missingCodes = [...new Set(report.missingCodes)].sort();

  report.preview = okRows.map((r) => {
    const cp = byCode.get(r.counterpartyCode);
    return {
      no: r.no,
      date: r.entryDate,
      side: r.side,
      amount: r.amount,
      counterparty: r.counterpartyCode,
      counterpartyId: cp?.id || null,
      name: r.name,
      je:
        r.side === 'IN'
          ? `Dr ${args.cashCode} / Cr ${r.counterpartyCode}`
          : `Dr ${r.counterpartyCode} / Cr ${args.cashCode}`,
      idempotencyKey: r.idempotencyKey,
      ready: Boolean(cash && cp),
    };
  });

  const outPath =
    args.report ||
    path.join(process.cwd(), 'reports', `shop-cash-csv-dry-run-${Date.now()}.json`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`Dry-run report → ${outPath}`);
  console.log(`Missing codes (${report.missingCodes.length}): ${report.missingCodes.join(', ') || '(none)'}`);

  if (args.apply) {
    if (!args.confirmProduction) {
      console.error('Refusing --apply without --confirm-production');
      process.exit(2);
    }
    if (report.missingCodes.length) {
      console.error('Cannot apply with missing CoA codes');
      process.exit(2);
    }
    if (!cash) process.exit(2);

    for (const row of okRows) {
      const cp = byCode.get(row.counterpartyCode);
      try {
        const existing = await alreadyPosted(supabase, args.companyId, row.idempotencyKey);
        if (existing) {
          report.skipped.push({ no: row.no, entry_no: existing.entry_no, id: existing.id });
          console.log(`SKIP ${row.no} already ${existing.entry_no}`);
          continue;
        }
        const je = await postOne(
          supabase,
          args.companyId,
          args.branchId,
          cash.id,
          cp.id,
          row,
        );
        report.posted.push({ no: row.no, entry_no: je.entry_no, id: je.id });
        console.log(`POSTED ${row.no} → ${je.entry_no}`);
      } catch (e) {
        report.failed.push({ no: row.no, error: e?.message || String(e) });
        console.error(`FAIL ${row.no}:`, e?.message || e);
      }
    }
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
    console.log(`Posted ${report.posted.length}, skipped ${report.skipped.length}, failed ${report.failed.length}`);
    process.exit(report.failed.length ? 1 : 0);
  }

  process.exit(report.missingCodes.length || errors.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
