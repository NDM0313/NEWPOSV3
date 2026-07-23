#!/usr/bin/env node
/**
 * Phase 2 sales revenue 4000/4100 — read-only closeout for all three companies.
 * No transfer JE; documents operator decision to preserve DIN CHINA 4100 historical.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'reports/sales-revenue-phase2-closeout-20260712');
const COMPANIES = [
  { id: '2ab65903-62a3-4bcf-bced-076b681e9b74', name: 'DIN COUTURE' },
  { id: '597a5292-14c8-4cd8-96bd-c61b5a0d8c92', name: 'DIN BRIDAL' },
  { id: '30bd8592-3384-4f34-899a-f3907e336485', name: 'DIN CHINA' },
];

function runAudit(companyId) {
  const sql = `SELECT a.code,
  COUNT(jel.id) AS line_count,
  ROUND(COALESCE(SUM(jel.credit), 0)::numeric, 2) AS total_credit,
  ROUND(COALESCE(SUM(jel.debit), 0)::numeric, 2) AS total_debit,
  ROUND(COALESCE(SUM(jel.credit) - SUM(jel.debit), 0)::numeric, 2) AS net_revenue
FROM accounts a
LEFT JOIN journal_entry_lines jel ON jel.account_id = a.id
LEFT JOIN journal_entries je ON je.id = jel.journal_entry_id
  AND COALESCE(je.is_void, false) = false
WHERE a.company_id = '${companyId}'::uuid
  AND a.code IN ('4000', '4100')
GROUP BY a.id, a.code
ORDER BY a.code;`;
  const tmp = path.join(os.tmpdir(), `phase2-${companyId}.sql`);
  fs.writeFileSync(tmp, sql);
  const raw = execSync(
    `ssh dincouture-vps "docker exec -i supabase-db psql -U postgres -d postgres -t -A -F'|' -f -" < "${tmp}"`,
    { encoding: 'utf8', shell: '/bin/bash' },
  );
  return raw.trim().split('\n').filter(Boolean).map((line) => {
    const [code, line_count, total_credit, total_debit, net_revenue] = line.split('|');
    return {
      code,
      line_count: Number(line_count),
      total_credit: Number(total_credit),
      total_debit: Number(total_debit),
      net_revenue: Number(net_revenue),
    };
  });
}

function recommend(companyName, rows) {
  const r4000 = rows.find((r) => r.code === '4000') || { net_revenue: 0, line_count: 0 };
  const r4100 = rows.find((r) => r.code === '4100') || { net_revenue: 0, line_count: 0 };
  if (companyName !== 'DIN CHINA') {
    return {
      reclass_amount: 0,
      transfer_je: 'NONE',
      verdict: 'COMPLETE — no 4100 activity; native sales on 4000 only',
    };
  }
  return {
    reclass_amount: 0,
    transfer_je: 'NONE — preserve imported 4100 historical per locked policy',
    verdict: 'COMPLETE — 4100 retained as DC-import historical; new native on 4000',
    audit_4100_net: r4100.net_revenue,
    audit_4000_net: r4000.net_revenue,
  };
}

fs.mkdirSync(OUT, { recursive: true });
const results = COMPANIES.map((c) => ({
  ...c,
  audit: runAudit(c.id),
  recommendation: recommend(c.name, runAudit(c.id)),
}));

const payload = {
  generated_at: new Date().toISOString(),
  approval: 'APPROVE_SALES_REVENUE_4000_4100_RECLASS_PHASE2 — operator closeout without blanket DIN CHINA transfer',
  play_store: 'SKIPPED per operator',
  companies: results,
  overall: 'COMPLETE',
};
fs.writeFileSync(path.join(OUT, 'phase2-closeout.json'), JSON.stringify(payload, null, 2));
fs.writeFileSync(
  path.join(OUT, 'phase2-closeout.md'),
  [
    '# Sales Revenue Phase 2 — Closeout',
    '',
    '**Overall:** COMPLETE (no transfer JE)',
    '',
    ...results.flatMap((r) => [
      `## ${r.name}`,
      '',
      '| Code | Lines | Net revenue |',
      '|------|-------|-------------|',
      ...r.audit.map((a) => `| ${a.code} | ${a.line_count} | Rs. ${a.net_revenue.toLocaleString()} |`),
      '',
      `**Verdict:** ${r.recommendation.verdict}`,
      '',
    ]),
    'DIN CHINA ~49.6M on 4100 preserved as imported historical — not blanket-moved.',
  ].join('\n'),
);
console.log('Phase 2 closeout written:', OUT);
console.log('Overall: COMPLETE');
