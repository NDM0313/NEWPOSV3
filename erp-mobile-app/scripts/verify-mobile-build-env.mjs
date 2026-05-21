#!/usr/bin/env node
/**
 * Fail release builds when mobile .env.production is missing or uses the public demo anon JWT.
 * Run before cap:sync:android:prod / release APK scripts.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = resolve(appRoot, '.env.production');
const DEMO_SIG = 'uPWERzbv9FtmRpl0cBPDPox08YhjW_zTOXtwYNLWmuo';

function parseEnv(text) {
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

if (!existsSync(envPath)) {
  console.error(
    '[verify-mobile-build-env] Missing erp-mobile-app/.env.production\n' +
      'Copy .env.production.example → .env.production and set VITE_SUPABASE_* from VPS (see docs/infra/MOBILE_APK_LOCKED_PATTERN.md).',
  );
  process.exit(1);
}

const env = parseEnv(readFileSync(envPath, 'utf8'));
const url = env.VITE_SUPABASE_URL || '';
const key = env.VITE_SUPABASE_ANON_KEY || '';
let failed = false;

if (!url.startsWith('https://erp.dincouture.pk')) {
  console.error('[verify-mobile-build-env] VITE_SUPABASE_URL must be https://erp.dincouture.pk (got:', url || '(empty)', ')');
  failed = true;
}
if (!key || key.length < 120) {
  console.error('[verify-mobile-build-env] VITE_SUPABASE_ANON_KEY missing or too short.');
  failed = true;
}
if (key.split('.')[2] === DEMO_SIG) {
  console.error(
    '[verify-mobile-build-env] VITE_SUPABASE_ANON_KEY is the public Supabase DEMO key — API calls fail on device.\n' +
      'On VPS: bash deploy/write-erp-env-from-supabase-docker-env.sh\n' +
      'Or copy VITE_SUPABASE_ANON_KEY from web .env.production (176-char Kong anon JWT).',
  );
  failed = true;
}
if (env.VITE_TARGET !== 'capacitor') {
  console.warn('[verify-mobile-build-env] WARN: set VITE_TARGET=capacitor for native barcode + printer plugins.');
}

if (failed) process.exit(1);
console.log('[verify-mobile-build-env] OK — production Supabase URL/key look valid.');
