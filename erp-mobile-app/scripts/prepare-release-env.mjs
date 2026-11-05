#!/usr/bin/env node
/** Prefer local Mini PC env; fall back to VPS key pull (URL still forced to api.ndmcore.com). */
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const scripts = resolve(dirname(fileURLToPath(import.meta.url)));

function run(script) {
  const r = spawnSync(process.execPath, [resolve(scripts, script)], { stdio: 'inherit' });
  return r.status === 0;
}

if (run('sync-env-production-from-local.mjs')) {
  process.exit(0);
}

console.warn(
  '[prepare-release-env] Local env sync failed — trying VPS key pull (URL will still be api.ndmcore.com)',
);
if (!run('sync-env-from-vps.mjs')) {
  process.exit(1);
}
