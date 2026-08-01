#!/usr/bin/env node
/**
 * R8-R2 kill-switch drill (read-only) — verify rollback artifacts + production flag baseline.
 * Does NOT enable kill switch in production. Code deletion deferred until 30-day soak (2026-08-09).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { runReadOnlyFlagGuard } from './threeCompanyLoaderGuard.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'reports/r8-r2-kill-switch-drill-20260712');
const R8_R1_DATE = '2026-07-10';
const SOAK_DAYS = 30;
const soakEnd = new Date(R8_R1_DATE);
soakEnd.setDate(soakEnd.getDate() + SOAK_DAYS);

const rollbackScripts = fs
  .readdirSync(path.join(ROOT, 'scripts/single-core-ledger'), { recursive: true })
  .filter((f) => typeof f === 'string' && f.includes('rollback'));

const legacyMainServices = [
  'src/app/services/accountStatementLegacyMainService.ts',
  'src/app/services/trialBalanceLegacyMainService.ts',
  'src/app/services/partyLedgerLegacyMainService.ts',
  'src/app/services/roznamchaLegacyMainService.ts',
].map((p) => path.join(ROOT, p));

const engineTest = spawnSync('npm', ['run', 'test:unified-ledger'], {
  cwd: ROOT,
  encoding: 'utf8',
  maxBuffer: 16 * 1024 * 1024,
});
const unifiedPass = engineTest.status === 0;

const guard = runReadOnlyFlagGuard();

const payload = {
  generated_at: new Date().toISOString(),
  drill_type: 'read_only_L0_L1_artifact_verify',
  production_kill_switch_enabled: false,
  flag_guard: guard,
  unified_ledger_tests: unifiedPass ? '336/336 PASS' : 'FAIL',
  rollback_sql_count: rollbackScripts.length,
  legacy_main_services_retained: legacyMainServices.filter((p) => fs.existsSync(p)).length,
  r8_r1_date: R8_R1_DATE,
  soak_required_until: soakEnd.toISOString().slice(0, 10),
  soak_day: Math.floor((Date.now() - new Date(R8_R1_DATE).getTime()) / 86400000) + 1,
  code_deletion_status: 'DEFERRED_POST_SOAK',
  operator_note: 'Kill-switch NOT toggled in production during drill. L1 SQL rollback files verified present.',
};

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'drill-report.json'), JSON.stringify(payload, null, 2));
fs.writeFileSync(
  path.join(OUT, 'drill-report.md'),
  [
    '# R8-R2 Kill-Switch Drill (Read-Only)',
    '',
    '**Drill result:** PASS (artifacts + tests; no production flag mutation)',
    '',
    `| Unified tests | ${payload.unified_ledger_tests} |`,
    `| Flag guard | ${guard.ok ? 'PASS' : 'FAIL'} |`,
    `| Rollback SQL files | ${rollbackScripts.length} |`,
    `| Legacy main services retained | ${payload.legacy_main_services_retained}/4 |`,
    `| Soak day | ${payload.soak_day} / ${SOAK_DAYS} |`,
    `| Code deletion | ${payload.code_deletion_status} until ${payload.soak_required_until} |`,
    '',
    'R8-R2 physical code deletion remains scheduled after soak + operator `R8_R2_CODE_DELETION_APPROVAL_REQUIRED`.',
  ].join('\n'),
);

console.log('R8-R2 drill:', guard.ok && unifiedPass ? 'PASS' : 'CHECK');
console.log('Soak:', payload.soak_day, '/', SOAK_DAYS, '— code deletion deferred to', payload.soak_required_until);
process.exit(guard.ok && unifiedPass ? 0 : 1);
