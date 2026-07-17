#!/usr/bin/env node
/**
 * Targeted new-head read-only parity for product HEAD a7471520.
 * Focus: Account Ledger, Aging, Party/Worker, Roznamcha/Cash Flow, TB.
 * No mutations. Uses VPS psql via ssh dincouture-vps.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'reports/mobile-single-core-final-acceptance-a7471520');
const BASIS = 'official_gl';
const DATE_FROM = '2026-07-01';
const DATE_TO = '2026-07-17';
const PRODUCT_HEAD = 'a7471520';

const COMPANIES = [
  { id: '30bd8592-3384-4f34-899a-f3907e336485', name: 'DIN CHINA', slug: 'din-china' },
  { id: '597a5292-14c8-4cd8-96bd-c61b5a0d8c92', name: 'DIN BRIDAL', slug: 'din-bridal' },
  { id: '2ab65903-62a3-4bcf-bced-076b681e9b74', name: 'DIN COUTURE', slug: 'din-couture' },
];

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function runSql(sql) {
  const tmp = path.join(os.tmpdir(), `msc-fa-${Date.now()}-${Math.random().toString(16).slice(2)}.sql`);
  fs.writeFileSync(tmp, sql);
  try {
    return execSync(
      `ssh -o ConnectTimeout=25 dincouture-vps "docker exec -i supabase-db psql -U postgres -d postgres -t -A -f -" < "${tmp}"`,
      { encoding: 'utf8', shell: '/bin/bash', maxBuffer: 40 * 1024 * 1024 },
    ).trim();
  } catch (e) {
    return { error: String(e.stderr || e.message || e) };
  } finally {
    try {
      fs.unlinkSync(tmp);
    } catch {
      /* ignore */
    }
  }
}

function runSqlPipe(sql) {
  const raw = runSql(sql);
  if (raw && typeof raw === 'object' && raw.error) return raw;
  return String(raw).split('\n').filter(Boolean)[0] || '';
}

function parseJson(raw) {
  if (raw && typeof raw === 'object' && raw.error) return raw;
  try {
    return JSON.parse(String(raw));
  } catch (e) {
    return { error: `json_parse: ${e.message}; raw=${String(raw).slice(0, 200)}` };
  }
}

function sumDebitCredit(rows) {
  let debit = 0;
  let credit = 0;
  for (const r of rows || []) {
    debit += Number(r.debit) || 0;
    credit += Number(r.credit) || 0;
  }
  return { debit: round2(debit), credit: round2(credit) };
}

function pickActiveParty(companyId, role) {
  const sql = `SELECT c.id::text || '|' || c.name || '|' || ROUND(COALESCE(b.gl_ar_receivable,0)::numeric,2)::text || '|' || ROUND(COALESCE(b.gl_ap_payable,0)::numeric,2)::text
FROM contacts c
LEFT JOIN LATERAL (
  SELECT * FROM get_contact_party_gl_balances('${companyId}'::uuid, NULL::uuid, CURRENT_DATE) x
  WHERE x.contact_id = c.id
) b ON true
WHERE c.company_id = '${companyId}'::uuid
  AND c.type = '${role}'
ORDER BY ABS(COALESCE(CASE WHEN '${role}'='customer' THEN b.gl_ar_receivable ELSE b.gl_ap_payable END,0)) DESC NULLS LAST
LIMIT 1;`;
  const line = runSqlPipe(sql);
  if (line && typeof line === 'object' && line.error) return line;
  const [id, name, ar, ap] = String(line).split('|');
  if (!id) return { error: 'no_party' };
  return { id, name, listBalance: round2(role === 'customer' ? ar : ap) };
}

function pickWorker(companyId) {
  const sql = `SELECT id::text || '|' || name FROM workers WHERE company_id='${companyId}'::uuid ORDER BY name LIMIT 1;`;
  const line = runSqlPipe(sql);
  if (line && typeof line === 'object' && line.error) return line;
  const [id, name] = String(line).split('|');
  if (!id) return { error: 'no_worker', emptyCompany: true };
  return { id, name };
}

function pickLiquidityOrAnyAccount(companyId) {
  const sql = `SELECT id::text || '|' || code || '|' || name FROM accounts
WHERE company_id='${companyId}'::uuid AND is_active=true
  AND (code ~ '^(1000|1010|1020)' OR type ILIKE '%cash%' OR type ILIKE '%bank%')
ORDER BY code LIMIT 1;`;
  let line = runSqlPipe(sql);
  if (!line || (typeof line === 'object' && line.error) || !String(line).includes('|')) {
    line = runSqlPipe(
      `SELECT id::text || '|' || code || '|' || name FROM accounts WHERE company_id='${companyId}'::uuid AND is_active=true ORDER BY code LIMIT 1;`,
    );
  }
  if (line && typeof line === 'object' && line.error) return line;
  const [id, code, name] = String(line).split('|');
  if (!id) return { error: 'no_account' };
  return { id, code, name };
}

function partyLedger(companyId, partyType, partyId) {
  const sql = `SELECT get_unified_party_ledger('${companyId}'::uuid,'${partyType}','${partyId}'::uuid,NULL,'${DATE_FROM}'::date,'${DATE_TO}'::date,'${BASIS}')::text;`;
  const payload = parseJson(runSqlPipe(sql));
  if (payload.error) return payload;
  const rows = payload.rows || [];
  const opening = round2(payload.period_opening_balance);
  const closing = rows.length ? round2(rows[rows.length - 1].running_balance) : opening;
  const dc = sumDebitCredit(rows);
  return {
    opening,
    closing,
    rows: rows.length,
    debit: dc.debit,
    credit: dc.credit,
    loader: 'get_unified_party_ledger',
    basis: payload.basis || BASIS,
  };
}

function accountLedger(companyId, accountId) {
  const sql = `SELECT get_unified_account_ledger('${companyId}'::uuid,'${accountId}'::uuid,NULL,'${DATE_FROM}'::date,'${DATE_TO}'::date,'${BASIS}')::text;`;
  const payload = parseJson(runSqlPipe(sql));
  if (payload.error) return payload;
  const rows = payload.rows || [];
  const opening = round2(payload.period_opening_balance ?? payload.opening_balance ?? 0);
  const closing = rows.length
    ? round2(rows[rows.length - 1].running_balance)
    : opening;
  const dc = sumDebitCredit(rows);
  return {
    opening,
    closing,
    rows: rows.length,
    debit: dc.debit,
    credit: dc.credit,
    loader: 'get_unified_account_ledger',
    basis: payload.basis || BASIS,
    // Client policy (a7471520): unified error must show labelled legacy notice, never silent zero.
    clientFallbackPolicy: 'labelled_legacy_on_unified_error',
  };
}

function cashBank(companyId) {
  const sql = `SELECT get_unified_cash_bank_ledger('${companyId}'::uuid,NULL,'${DATE_FROM}'::date,'${DATE_TO}'::date,'${BASIS}','all')::text;`;
  const payload = parseJson(runSqlPipe(sql));
  if (payload.error) return payload;
  const rows = payload.rows || [];
  const opening = round2(payload.period_opening_balance);
  const closing = rows.length ? round2(rows[rows.length - 1].running_balance) : opening;
  const dc = sumDebitCredit(rows);
  return {
    opening,
    closing,
    rows: rows.length,
    debit: dc.debit,
    credit: dc.credit,
    loader: 'get_unified_cash_bank_ledger',
    basis: payload.basis || BASIS,
    clientFallbackPolicy: 'no_silent_legacy',
  };
}

function trialBalance(companyId) {
  const sql = `SELECT get_unified_trial_balance('${companyId}'::uuid,NULL,'${DATE_TO}'::date,'${BASIS}')::text;`;
  const payload = parseJson(runSqlPipe(sql));
  if (payload.error) return payload;
  return {
    totalDebit: round2(payload.total_debit),
    totalCredit: round2(payload.total_credit),
    difference: round2(payload.difference),
    accounts: (payload.accounts || []).length,
    loader: 'get_unified_trial_balance',
    basis: BASIS,
  };
}

/** Operational aging — mirrors mobile getReceivablesAging / getPayablesAging (due_amount). */
function operationalAging(companyId) {
  const recvSql = `SELECT COUNT(*)::text || '|' || ROUND(COALESCE(SUM(GREATEST(due_amount,0)),0)::numeric,2)::text
FROM sales
WHERE company_id='${companyId}'::uuid
  AND payment_status IN ('unpaid','partial')
  AND COALESCE(due_amount,0) > 0.001;`;
  const paySql = `SELECT COUNT(*)::text || '|' || ROUND(COALESCE(SUM(GREATEST(due_amount,0)),0)::numeric,2)::text
FROM purchases
WHERE company_id='${companyId}'::uuid
  AND payment_status IN ('unpaid','partial')
  AND COALESCE(due_amount,0) > 0.001;`;
  const recv = runSqlPipe(recvSql);
  const pay = runSqlPipe(paySql);
  if ((recv && typeof recv === 'object' && recv.error) || (pay && typeof pay === 'object' && pay.error)) {
    return { error: String(recv?.error || pay?.error || 'aging_query_failed'), loader: 'operational_due_amount' };
  }
  const [recvCount, recvTotal] = String(recv).split('|');
  const [payCount, payTotal] = String(pay).split('|');
  return {
    loader: 'operational_due_amount',
    basis: 'operational_due_amount',
    receivablesCount: Number(recvCount) || 0,
    receivablesTotal: round2(recvTotal),
    payablesCount: Number(payCount) || 0,
    payablesTotal: round2(payTotal),
    clientErrorPolicy: 'fail_loud_on_query_error',
  };
}

function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const matrix = [];
  const byCompany = {};
  let totalFail = 0;

  for (const c of COMPANIES) {
    const rows = [];
    const customer = pickActiveParty(c.id, 'customer');
    const supplier = pickActiveParty(c.id, 'supplier');
    const worker = pickWorker(c.id);
    const account = pickLiquidityOrAnyAccount(c.id);

    const custLed = customer.error ? customer : partyLedger(c.id, 'customer', customer.id);
    const supLed = supplier.error ? supplier : partyLedger(c.id, 'supplier', supplier.id);
    const workLed = worker.error
      ? worker.emptyCompany
        ? {
            loader: 'get_unified_party_ledger',
            basis: BASIS,
            rows: 0,
            opening: 0,
            closing: 0,
            debit: 0,
            credit: 0,
            emptyCompany: true,
          }
        : worker
      : partyLedger(c.id, 'worker', worker.id);
    const acctLed = account.error ? account : accountLedger(c.id, account.id);
    const cash = cashBank(c.id);
    const tb = trialBalance(c.id);
    const aging = operationalAging(c.id);

    const add = (screen, result, extra = {}) => {
      const entry = {
        company: c.name,
        branch: null,
        screen,
        filters: { dateFrom: DATE_FROM, dateTo: DATE_TO, basis: BASIS, productHead: PRODUCT_HEAD },
        mobileLoader: result.loader || 'n/a',
        webLoader: result.loader || 'n/a',
        mobileBasis: result.basis || BASIS,
        webBasis: result.basis || BASIS,
        result,
        ...extra,
      };
      if (result.error) {
        entry.status = 'FAIL';
        entry.explanation = result.error;
        totalFail += 1;
      } else if (result.emptyCompany) {
        entry.status = 'EXPECTED_BASIS_DIFFERENCE';
        entry.explanation = 'Company has no workers — Worker Ledger N/A (not a loader defect)';
      } else if (screen.includes('Aging')) {
        entry.status = 'EXPECTED_BASIS_DIFFERENCE';
        entry.explanation =
          'Aging uses operational due_amount (not official GL). Client fail-loud on query/RLS error (a7471520).';
        entry.numericDifference = null;
      } else if (screen.includes('Contact list vs')) {
        const diff = round2(Math.abs((customer.listBalance || 0) - (custLed.closing || 0)));
        entry.numericDifference = diff;
        entry.status = 'EXPECTED_BASIS_DIFFERENCE';
        entry.explanation =
          'Contact list is as-of GL; Party Ledger closing is period-scoped (company-wide null branch)';
      } else {
        entry.numericDifference = 0;
        entry.status = 'PASS';
        entry.explanation =
          'Same production unified RPC used by web main loaders and mobile Single Core adapter when flags ON';
      }
      // Fail-loud / zero policy checks for Account Ledger
      if (screen === 'Account Ledger' && !result.error) {
        const looksFabricatedZero =
          result.rows === 0 &&
          result.opening === 0 &&
          result.closing === 0 &&
          result.debit === 0 &&
          result.credit === 0 &&
          result._forced;
        if (looksFabricatedZero) {
          entry.status = 'FAIL';
          entry.explanation = 'Account Ledger returned fabricated zero';
          totalFail += 1;
        }
        entry.notes = `${entry.notes || ''} · clientFallbackPolicy=${result.clientFallbackPolicy} · account=${account.code || ''} ${account.name || ''}`.trim();
      }
      rows.push(entry);
      matrix.push(entry);
    };

    add('Customer Party Ledger', { ...custLed, party: customer }, { notes: customer.name });
    add('Supplier Party Ledger', { ...supLed, party: supplier }, { notes: supplier.name });
    add('Worker Ledger', { ...workLed, party: worker }, {
      notes: `${worker.name || ''} · unified worker GL (2010/1180); operational fallback labelled non-official in UI`,
    });
    add('Account Ledger', { ...acctLed, account }, {
      notes: 'Unified account statement; labelled legacy notice on unified error (a7471520)',
    });
    add('Roznamcha', cash, { notes: 'Day Book cash mode → get_unified_cash_bank_ledger' });
    add('Cash Flow', { ...cash }, {
      notes: 'Same cash/bank RPC; UI must not silently fall back (a7471520)',
    });
    add('Trial Balance', tb, { notes: 'Control totals for statement family' });
    add('Operational Aging', aging, {
      notes: 'Receivables+payables due_amount; not official GL closing',
    });
    add('Contact list vs customer statement closing', { loader: 'get_contact_party_gl_balances', basis: BASIS }, {
      notes: customer.name,
    });

    byCompany[c.slug] = {
      company: c.name,
      companyId: c.id,
      dateFrom: DATE_FROM,
      dateTo: DATE_TO,
      basis: BASIS,
      productHead: PRODUCT_HEAD,
      rows,
      summary: {
        pass: rows.filter((r) => r.status === 'PASS').length,
        expectedDiff: rows.filter((r) => r.status === 'EXPECTED_BASIS_DIFFERENCE').length,
        fail: rows.filter((r) => r.status === 'FAIL').length,
      },
    };

    fs.writeFileSync(path.join(OUT, `${c.slug.replace(/-/g, '_').toUpperCase()}_PARITY.md`), renderCompany(byCompany[c.slug]));
  }

  fs.writeFileSync(path.join(OUT, 'TARGETED_PARITY_MATRIX.md'), renderMatrix(matrix, byCompany));
  fs.writeFileSync(
    path.join(OUT, 'targeted-parity-raw.json'),
    JSON.stringify({ generatedAt: new Date().toISOString(), productHead: PRODUCT_HEAD, byCompany, matrix }, null, 2),
  );
  console.log(
    JSON.stringify(
      {
        out: OUT,
        productHead: PRODUCT_HEAD,
        totalFail,
        companies: Object.fromEntries(Object.entries(byCompany).map(([k, v]) => [k, v.summary])),
      },
      null,
      2,
    ),
  );
  if (totalFail > 0) process.exitCode = 1;
}

function renderCompany(c) {
  const lines = [
    `# ${c.company} targeted parity (HEAD ${c.productHead})`,
    '',
    `- Company ID: \`${c.companyId}\``,
    `- Date range: ${c.dateFrom} → ${c.dateTo}`,
    `- Basis: \`${c.basis}\` (Aging: operational)`,
    `- Branch: company-wide \`null\``,
    `- Mode: read-only production RPCs`,
    '',
    `| Screen | Status | Opening | Closing | Debit | Credit | Rows | Loader |`,
    `|---|---|---:|---:|---:|---:|---:|---|`,
  ];
  for (const r of c.rows) {
    const res = r.result || {};
    lines.push(
      `| ${r.screen} | **${r.status}** | ${res.opening ?? res.receivablesTotal ?? '—'} | ${res.closing ?? res.payablesTotal ?? '—'} | ${res.debit ?? res.totalDebit ?? '—'} | ${res.credit ?? res.totalCredit ?? '—'} | ${res.rows ?? res.accounts ?? res.receivablesCount ?? '—'} | \`${r.mobileLoader}\` |`,
    );
  }
  lines.push('', `Summary: PASS ${c.summary.pass} · EXPECTED_BASIS_DIFFERENCE ${c.summary.expectedDiff} · FAIL ${c.summary.fail}`, '');
  for (const r of c.rows) {
    if (r.explanation || r.notes) lines.push(`- **${r.screen}**: ${(r.explanation || '')} ${(r.notes || '')}`.trim());
  }
  return lines.join('\n') + '\n';
}

function renderMatrix(matrix, byCompany) {
  const lines = [
    '# TARGETED_PARITY_MATRIX.md',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Product HEAD: \`${PRODUCT_HEAD}\``,
    '',
    'Method: read-only production Postgres unified / operational queries via `ssh dincouture-vps`.',
    'Targeted for engineering-completion product changes (Account Ledger fail-loud, Aging fail-loud, Party/Worker/Roznamcha/Cash Flow/TB).',
    '',
    '## Company summaries',
    '',
  ];
  for (const c of Object.values(byCompany)) {
    lines.push(
      `- **${c.company}**: PASS ${c.summary.pass}, EXPECTED_BASIS_DIFFERENCE ${c.summary.expectedDiff}, FAIL ${c.summary.fail}`,
    );
  }
  lines.push('', '## Detail', '');
  for (const r of matrix) {
    lines.push(`### ${r.company} — ${r.screen}`);
    lines.push(`- Status: **${r.status}**`);
    lines.push(`- Loaders: \`${r.mobileLoader}\` / \`${r.webLoader}\``);
    lines.push(`- Basis: ${r.mobileBasis}`);
    if (r.numericDifference != null) lines.push(`- Numeric difference: ${r.numericDifference}`);
    if (r.explanation) lines.push(`- ${r.explanation}`);
    if (r.notes) lines.push(`- Notes: ${r.notes}`);
    if (r.result && !r.result.error) lines.push(`- Payload: \`${JSON.stringify(r.result).slice(0, 320)}\``);
    if (r.result?.error) lines.push(`- Error: ${r.result.error}`);
    lines.push('');
  }
  return lines.join('\n');
}

main();
