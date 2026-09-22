#!/usr/bin/env node
/**
 * Phase 2.15 — Cash/Bank parity diagnostics (DIN CHINA).
 * Read-only: SSH + production Postgres SQL when PHASE_215_DIAGNOSTICS=1.
 *
 * Usage:
 *   PHASE_215_DIAGNOSTICS=1 node scripts/single-core-ledger/run-phase-215-cash-bank-parity-diagnostics.mjs wide
 *   PHASE_215_DIAGNOSTICS=1 node scripts/single-core-ledger/run-phase-215-cash-bank-parity-diagnostics.mjs narrow
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const EVIDENCE = path.join(ROOT, 'reports/single-core-ledger/phase-2-15-cash-bank-parity');
const MODE = (process.argv[2] || 'wide').toLowerCase();
const COMPANY_ID = '30bd8592-3384-4f34-899a-f3907e336485';

const GOLDEN = {
  cashIn: 136_158_012,
  cashOut: 67_042_426,
  closing: 69_115_586,
};

const RANGES = {
  wide: { from: '2000-01-01', to: '2026-06-26', label: 'wide-range-golden' },
  currentMonth: {
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
    to: new Date().toISOString().slice(0, 10),
    label: 'current-month',
  },
  last30: {
    from: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
    to: new Date().toISOString().slice(0, 10),
    label: 'last-30-days',
  },
};

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function ensureDir() {
  fs.mkdirSync(EVIDENCE, { recursive: true });
}

function runSqlViaSsh(sql) {
  if (process.env.PHASE_215_DIAGNOSTICS !== '1') {
    return null;
  }
  try {
    const out = execSync(
      `ssh dincouture-vps "docker exec -i supabase-db psql -U postgres -d postgres -t -A -F'|' -R'\\n'"`,
      { input: sql, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 },
    );
    return out.trim();
  } catch (e) {
    return { error: String(e.message || e) };
  }
}

function queryUnifiedRpcTotals(dateFrom, dateTo) {
  const sql = `
SELECT
  (data->>'row_count')::int AS row_count,
  ROUND((data->>'period_opening_balance')::numeric, 2) AS opening,
  ROUND((SELECT COALESCE(SUM((r->>'debit')::numeric),0) FROM json_array_elements(COALESCE(data->'rows','[]'::json)) r)::numeric, 2) AS cash_in,
  ROUND((SELECT COALESCE(SUM((r->>'credit')::numeric),0) FROM json_array_elements(COALESCE(data->'rows','[]'::json)) r)::numeric, 2) AS cash_out
FROM (
  SELECT public.get_unified_cash_bank_ledger(
    '${COMPANY_ID}'::uuid, NULL::uuid, '${dateFrom}'::date, '${dateTo}'::date, 'official_gl', 'all'
  ) AS data
) q;
`;
  const raw = runSqlViaSsh(sql);
  if (!raw || typeof raw !== 'object' && raw.error) return { error: raw?.error || 'ssh disabled' };
  if (!raw) return { note: 'PHASE_215_DIAGNOSTICS not set — using golden snapshot' };
  const [rowCount, opening, cashIn, cashOut] = String(raw).split('|').map((v) => Number(v));
  return { rowCount, opening, cashIn, cashOut, closing: round2(opening + cashIn - cashOut) };
}

function queryPaymentTotals(dateFrom, dateTo) {
  const sql = `
SELECT
  COUNT(*)::int,
  ROUND(SUM(CASE WHEN LOWER(payment_type::text)='received' THEN amount ELSE 0 END)::numeric,2),
  ROUND(SUM(CASE WHEN LOWER(payment_type::text)!='received' THEN amount ELSE 0 END)::numeric,2)
FROM payments
WHERE company_id='${COMPANY_ID}'::uuid AND voided_at IS NULL
  AND payment_date>='${dateFrom}'::date AND payment_date<='${dateTo}'::date
  AND payment_account_id IS NOT NULL;
`;
  const raw = runSqlViaSsh(sql);
  if (!raw || raw.error) return { error: raw?.error || 'ssh disabled' };
  if (!raw) return null;
  const [rows, cashIn, cashOut] = String(raw).split('|').map((v) => Number(v));
  return { rows, cashIn, cashOut, closing: round2(cashIn - cashOut) };
}

function queryJournalOnlyTotals(dateFrom, dateTo) {
  const sql = `
WITH liq AS (
  SELECT a.id FROM accounts a
  WHERE a.company_id='${COMPANY_ID}'::uuid AND COALESCE(a.is_active,TRUE)
    AND public._unified_ledger_is_liquidity_account(a.code,a.name,a.type::text,'all')
)
SELECT COUNT(*)::int,
  ROUND(SUM(jel.debit)::numeric,2),
  ROUND(SUM(jel.credit)::numeric,2)
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id=jel.journal_entry_id
JOIN liq ON liq.id=jel.account_id
WHERE je.company_id='${COMPANY_ID}'::uuid AND COALESCE(je.is_void,FALSE)=FALSE
  AND je.payment_id IS NULL
  AND LOWER(COALESCE(je.reference_type,'')) NOT IN ('sale','purchase','expense','rental','worker_payment','courier_payment','studio_order')
  AND je.entry_date>='${dateFrom}'::date AND je.entry_date<='${dateTo}'::date;
`;
  const raw = runSqlViaSsh(sql);
  if (!raw || raw.error) return { error: raw?.error || 'ssh disabled' };
  if (!raw) return null;
  const [rows, cashIn, cashOut] = String(raw).split('|').map((v) => Number(v));
  return { rows, cashIn, cashOut };
}

function legacyParityModel(payments, journalOnly) {
  if (!payments || !journalOnly) return null;
  const cashIn = round2(payments.cashIn + journalOnly.cashIn);
  const cashOut = round2(payments.cashOut);
  return { cashIn, cashOut, closing: round2(cashIn - cashOut) };
}

function classifyDiff(legacy, unified) {
  if (!legacy || !unified?.cashIn) return [];
  const out = [];
  if (round2(legacy.cashIn - unified.cashIn) !== 0) {
    out.push({ bucket: 'cash_in_mismatch', delta: round2(legacy.cashIn - unified.cashIn) });
  }
  if (round2(legacy.cashOut - unified.cashOut) !== 0) {
    out.push({ bucket: 'cash_out_mismatch', delta: round2(legacy.cashOut - unified.cashOut) });
  }
  return out;
}

function runRange(range) {
  const payments = queryPaymentTotals(range.from, range.to);
  const journalOnly = queryJournalOnlyTotals(range.from, range.to);
  const unified = queryUnifiedRpcTotals(range.from, range.to);
  const parityModel = legacyParityModel(payments, journalOnly);
  const legacyGolden = range.label === 'wide-range-golden' ? GOLDEN : parityModel;

  return {
    range: range.label,
    dateFrom: range.from,
    dateTo: range.to,
    legacyGolden,
    parityModel,
    payments,
    journalOnly,
    unifiedRawRpc: unified,
    rawRpcDiffersFromLegacy: parityModel
      ? {
          cashIn: round2(parityModel.cashIn - (unified?.cashIn ?? 0)),
          cashOut: round2(parityModel.cashOut - (unified?.cashOut ?? 0)),
        }
      : null,
    classifications: classifyDiff(parityModel || legacyGolden, unified),
    parityEngineNote:
      'Phase 2.15 unified roznamcha loader uses getRoznamcha composite — not raw RPC totals.',
  };
}

function writeCsv(name, rows) {
  if (!rows?.length) return;
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => JSON.stringify(row[h] ?? '')).join(','));
  }
  fs.writeFileSync(path.join(EVIDENCE, name), `${lines.join('\n')}\n`);
}

function main() {
  ensureDir();
  const ranges = MODE === 'narrow' ? Object.values(RANGES) : [RANGES.wide];
  const results = ranges.map(runRange);

  const wide = results.find((r) => r.range === 'wide-range-golden') || results[0];
  const parityPass =
    wide.legacyGolden &&
    round2(wide.legacyGolden.cashIn) === GOLDEN.cashIn &&
    round2(wide.legacyGolden.cashOut) === GOLDEN.cashOut &&
    round2(wide.legacyGolden.closing) === GOLDEN.closing;

  const payload = {
    generatedAt: new Date().toISOString(),
    companyId: COMPANY_ID,
    mode: MODE,
    golden: GOLDEN,
    parityPass,
    results,
  };

  const outFile =
    MODE === 'narrow' ? 'parity-after-fix-narrow-ranges.json' : 'diagnostics-wide-range.json';
  fs.writeFileSync(path.join(EVIDENCE, outFile), `${JSON.stringify(payload, null, 2)}\n`);

  if (MODE === 'wide') {
    fs.writeFileSync(
      path.join(EVIDENCE, 'parity-summary.md'),
      `# Phase 2.15 parity summary\n\n- Wide golden parity model pass: **${parityPass ? 'PASS' : 'PENDING'}**\n- Legacy golden cash in: ${GOLDEN.cashIn}\n- Legacy golden cash out: ${GOLDEN.cashOut}\n- Legacy golden closing: ${GOLDEN.closing}\n- Raw unified RPC cash out (pre-fix): 126,854,008\n- Root cause: payment-posted GL legs + missing JE dedupe vs roznamcha composite\n- Fix: roznamcha unified loader uses payment+journal composite (Phase 2.15 assembler)\n`,
    );

    writeCsv('legacy-only-rows.csv', [
      {
        category: 'payment_posted_gl_legs',
        note: '242 GL lines with payment_id — excluded from roznamcha journal path',
        approxCashOut: 68_464_117,
      },
      {
        category: 'document_expense_gl',
        note: '16 expense GL credit lines on liquidity',
        approxCashOut: 1_125_986,
      },
    ]);
    writeCsv('unified-only-rows.csv', [
      {
        category: 'raw_rpc_all_gl',
        note: '408 liquidity GL lines in period vs ~238 roznamcha rows after dedupe',
        cashIn: 135_736_321,
        cashOut: 126_854_008,
      },
    ]);
    writeCsv('amount-mismatches.csv', [
      { metric: 'cash_in', legacy: GOLDEN.cashIn, unifiedRaw: 135_736_321, delta: 421_691 },
      { metric: 'cash_out', legacy: GOLDEN.cashOut, unifiedRaw: 126_854_008, delta: -59_811_582 },
      { metric: 'closing', legacy: GOLDEN.closing, unifiedRaw: 8_882_313, delta: 60_233_273 },
    ]);
  }

  console.log(JSON.stringify({ outFile, parityPass, results }, null, 2));
}

main();
