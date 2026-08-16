#!/usr/bin/env node
/**
 * Phase 1.5 staging integration smoke (read-only).
 * Runs unit tests + blocked/partial CLI diagnostics when staging creds missing.
 *
 * Usage: node scripts/run-unified-ledger-staging-integration.mjs
 */

import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function run(cmd, args, env = {}) {
  const r = spawnSync(cmd, args, {
    cwd: root,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, ...env },
  });
  return r.status ?? 1;
}

console.log('=== Phase 1.5 unified ledger unit tests ===');
const testStatus = run('npm', ['run', 'test:unified-ledger']);
if (testStatus !== 0) process.exit(testStatus);

console.log('\n=== Diagnostics CLI (staging guard) ===');
const diagStatus = run('node', ['scripts/run-single-core-ledger-diagnostics.mjs'], {
  UNIFIED_LEDGER_STAGING: '1',
});
// Exit 1 = blocked (no creds) — acceptable in CI without staging
if (diagStatus !== 0 && diagStatus !== 1) process.exit(diagStatus);

console.log('\n=== Tie-out CLI (staging guard) ===');
const tieStatus = run('node', ['scripts/run-unified-ledger-tieout.mjs', '--pilot-only'], {
  UNIFIED_LEDGER_STAGING: '1',
});
if (tieStatus !== 0 && tieStatus !== 1) process.exit(tieStatus);

console.log('\n✅ Phase 1.5 integration script completed (unit tests passed; CLI staging may be blocked locally).');
