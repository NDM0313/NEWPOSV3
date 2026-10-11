#!/usr/bin/env node
/** VPS anon sync first; fall back to local .env when SSH unavailable. */
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const scripts = resolve(dirname(fileURLToPath(import.meta.url)));

function run(script) {
  const r = spawnSync(process.execPath, [resolve(scripts, script)], { stdio: 'inherit' });
  return r.status === 0;
}

if (!run('sync-env-from-vps.mjs')) {
  console.warn('[prepare-release-env] VPS sync failed — using local env');
  if (!run('sync-env-production-from-local.mjs')) {
    process.exit(1);
  }
}
