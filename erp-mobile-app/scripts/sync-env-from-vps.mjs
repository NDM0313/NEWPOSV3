#!/usr/bin/env node
/**
 * Pull canonical VITE_* from VPS erp-mobile-app/.env.production (after write-erp-env).
 * Usage: node scripts/sync-env-from-vps.mjs
 * Env: VPS_SSH_HOST (default dincouture-vps), VPS_MOBILE_ENV_PATH (default /root/NEWPOSV3/erp-mobile-app/.env.production)
 */
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dest = resolve(appRoot, '.env.production');
const host = process.env.VPS_SSH_HOST || 'dincouture-vps';
const remotePath = process.env.VPS_MOBILE_ENV_PATH || '/root/NEWPOSV3/erp-mobile-app/.env.production';

function parse(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 1) continue;
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return out;
}

let remoteRaw;
try {
  remoteRaw = execSync(`ssh ${host} cat ${remotePath}`, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
} catch (e) {
  const err = e instanceof Error ? e.message : String(e);
  console.error(`[sync-env-from-vps] SSH failed (${host}:${remotePath}):`, err);
  process.exit(1);
}

const p = parse(remoteRaw);
// Canonical mobile API host (ndmcore). Remote VPS may still list legacy dincouture URLs —
// keep ANON_KEY from remote, always bake api.ndmcore.com for release APKs.
const CANONICAL_API = 'https://api.ndmcore.com';
const remoteUrl = String(p.VITE_SUPABASE_URL || '').trim();
if (remoteUrl && remoteUrl !== CANONICAL_API) {
  console.warn(
    `[sync-env-from-vps] Remote VITE_SUPABASE_URL was ${remoteUrl} — forcing ${CANONICAL_API}`,
  );
}
const key = p.VITE_SUPABASE_ANON_KEY || '';
const disableRt = p.VITE_DISABLE_REALTIME || 'true';

if (!key || key.length < 120) {
  console.error('[sync-env-from-vps] Remote file missing valid VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const body = [
  '# Auto-synced from VPS — release APK must match Kong ANON_KEY.',
  '# VITE_SUPABASE_URL forced to api.ndmcore.com (native + PWA cutover).',
  'VITE_TARGET=capacitor',
  `VITE_SUPABASE_URL=${CANONICAL_API}`,
  `VITE_SUPABASE_ANON_KEY=${key}`,
  `VITE_DISABLE_REALTIME=${disableRt}`,
  '',
].join('\n');

writeFileSync(dest, body, 'utf8');
const tail = key.slice(-8);
console.log(
  `[sync-env-from-vps] Wrote .env.production (url ${CANONICAL_API}, anon ${key.length} chars, …${tail})`,
);
