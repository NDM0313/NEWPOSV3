#!/usr/bin/env node
/**
 * Phase 2b — read-only legacy vs unified party GL balance parity (AR/AP Diagnostics).
 * Production parity baseline: official_gl (APPROVE_AR_AP_PHASE2B_PARITY_BASELINE_OFFICIAL_GL).
 * Also reports effective_party as explained variance (may FAIL Bridal intentionally).
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'reports/ar-ap-phase-2b-official-gl-parity-closeout-20260715');
const TOLERANCE = 0.01;
/** Production parity gate — must match Contacts legacy semantics. */
const PARITY_BASIS = 'official_gl';
const VARIANCE_BASIS = 'effective_party';

const COMPANIES = [
  { id: '30bd8592-3384-4f34-899a-f3907e336485', name: 'DIN CHINA' },
  { id: '597a5292-14c8-4cd8-96bd-c61b5a0d8c92', name: 'DIN BRIDAL' },
  { id: '2ab65903-62a3-4bcf-bced-076b681e9b74', name: 'DIN COUTURE' },
];

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function runSql(sql) {
  const tmp = path.join(os.tmpdir(), `ar-ap-phase2b-${Date.now()}.sql`);
  fs.writeFileSync(tmp, sql);
  try {
    return execSync(
      `ssh dincouture-vps "docker exec -i supabase-db psql -U postgres -d postgres -t -A -F'|' -f -" < "${tmp}"`,
      { encoding: 'utf8', shell: '/bin/bash' },
    ).trim();
  } catch (e) {
    return { error: String(e.message || e) };
  } finally {
    try {
      fs.unlinkSync(tmp);
    } catch {
      /* ignore */
    }
  }
}

function rpcExists(name) {
  const sql = `SELECT COUNT(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = '${name}';`;
  const raw = runSql(sql);
  if (raw && typeof raw === 'object' && raw.error) return false;
  return Number(String(raw).split('\n')[0]) > 0;
}

function sumPartyRpc(fnName, companyId, basis = PARITY_BASIS) {
  const sql =
    fnName === 'get_unified_contact_party_gl_balances'
      ? `SELECT
  ROUND(COALESCE(SUM(gl_ar_receivable),0)::numeric, 2),
  ROUND(COALESCE(SUM(gl_ap_payable),0)::numeric, 2),
  ROUND(COALESCE(SUM(gl_worker_payable),0)::numeric, 2)
FROM public.get_unified_contact_party_gl_balances('${companyId}'::uuid, NULL::uuid, CURRENT_DATE, '${basis}');`
      : `SELECT
  ROUND(COALESCE(SUM(gl_ar_receivable),0)::numeric, 2),
  ROUND(COALESCE(SUM(gl_ap_payable),0)::numeric, 2),
  ROUND(COALESCE(SUM(gl_worker_payable),0)::numeric, 2)
FROM public.get_contact_party_gl_balances('${companyId}'::uuid, NULL::uuid, CURRENT_DATE);`;
  const raw = runSql(sql);
  if (raw && typeof raw === 'object' && raw.error) return { error: raw.error };
  const [ar, ap, wp] = String(raw).split('|').map(Number);
  return { ar, ap, wp };
}

function maxAbsDelta(legacy, unified) {
  return Math.max(
    Math.abs(legacy.ar - unified.ar),
    Math.abs(legacy.ap - unified.ap),
    Math.abs(legacy.wp - unified.wp),
  );
}

function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const lines = [
    '# AR/AP Phase 2b party GL parity (read-only)',
    `Generated: ${new Date().toISOString()}`,
    `Production parity basis: ${PARITY_BASIS}`,
    `Explained variance basis: ${VARIANCE_BASIS}`,
    '',
  ];

  const unifiedExists = rpcExists('get_unified_contact_party_gl_balances');
  lines.push(`Unified RPC deployed: ${unifiedExists ? 'YES' : 'NO (legacy fallback expected in UI)'}`);
  lines.push('');

  let overall = unifiedExists ? 'PASS' : 'SKIP_RPC_NOT_DEPLOYED';
  const results = [];

  for (const c of COMPANIES) {
    const legacy = sumPartyRpc('get_contact_party_gl_balances', c.id);
    if (legacy.error) {
      results.push({ company: c.name, result: 'FAIL', error: legacy.error });
      overall = 'FAIL';
      continue;
    }
    if (!unifiedExists) {
      results.push({ company: c.name, result: 'SKIP', legacy });
      continue;
    }
    const unifiedParity = sumPartyRpc('get_unified_contact_party_gl_balances', c.id, PARITY_BASIS);
    const unifiedEp = sumPartyRpc('get_unified_contact_party_gl_balances', c.id, VARIANCE_BASIS);
    if (unifiedParity.error) {
      results.push({ company: c.name, result: 'FAIL', error: unifiedParity.error });
      overall = 'FAIL';
      continue;
    }
    const delta = round2(maxAbsDelta(legacy, unifiedParity));
    const epDelta = unifiedEp.error ? null : round2(maxAbsDelta(legacy, unifiedEp));
    const pass = delta <= TOLERANCE;
    if (!pass) overall = 'FAIL';
    results.push({
      company: c.name,
      result: pass ? 'PASS' : 'FAIL',
      basis: PARITY_BASIS,
      legacy,
      unified: unifiedParity,
      maxAbsDelta: delta,
      effective_party_maxAbsDelta: epDelta,
    });
  }

  for (const r of results) {
    lines.push(`## ${r.company}: ${r.result} (parity=${PARITY_BASIS})`);
    if (r.legacy) lines.push(`- Legacy sums AR/AP/WP: ${r.legacy.ar} / ${r.legacy.ap} / ${r.legacy.wp}`);
    if (r.unified) lines.push(`- Unified ${PARITY_BASIS} AR/AP/WP: ${r.unified.ar} / ${r.unified.ap} / ${r.unified.wp}`);
    if (r.maxAbsDelta != null) lines.push(`- Max column delta (${PARITY_BASIS}): ${r.maxAbsDelta}`);
    if (r.effective_party_maxAbsDelta != null) {
      lines.push(
        `- Explained variance max delta (${VARIANCE_BASIS}): ${r.effective_party_maxAbsDelta}` +
          (r.effective_party_maxAbsDelta > TOLERANCE ? ' (not a production parity fail)' : ''),
      );
    }
    if (r.error) lines.push(`- Error: ${r.error}`);
    lines.push('');
  }

  lines.push(`Overall (${PARITY_BASIS} gate): ${overall}`);
  const outPath = path.join(OUT, 'party-gl-parity-readonly.txt');
  fs.writeFileSync(outPath, lines.join('\n'));
  fs.writeFileSync(path.join(OUT, 'party-gl-parity-readonly.json'), JSON.stringify({ overall, parityBasis: PARITY_BASIS, results }, null, 2));
  console.log(lines.join('\n'));
  console.log(`Wrote ${outPath}`);
  if (overall === 'FAIL') process.exit(1);
}

main();
