#!/usr/bin/env node
/** Copy VITE_* from erp-mobile-app/.env or repo .env.local into .env.production for release builds. */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(appRoot, '..');
const sources = [
  resolve(appRoot, '.env'),
  resolve(repoRoot, '.env.local'),
  resolve(repoRoot, '.env.production'),
];
const dest = resolve(appRoot, '.env.production');
const DEMO_SIG = 'uPWERzbv9FtmRpl0cBPDPox08YhjW_zTOXtwYNLWmuo';
const CANONICAL_URL = 'https://api.ndmcore.com';

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

let merged = {
  VITE_TARGET: 'capacitor',
  VITE_SUPABASE_URL: 'https://api.ndmcore.com',
  VITE_SUPABASE_URL: CANONICAL_URL,
  VITE_DISABLE_REALTIME: 'true',
};

for (const path of sources) {
  if (!existsSync(path)) continue;
  const p = parse(readFileSync(path, 'utf8'));
  if (p.VITE_SUPABASE_ANON_KEY) merged.VITE_SUPABASE_ANON_KEY = p.VITE_SUPABASE_ANON_KEY;
  if (p.VITE_DISABLE_REALTIME) merged.VITE_DISABLE_REALTIME = p.VITE_DISABLE_REALTIME;
  if (p.VITE_TARGET) merged.VITE_TARGET = p.VITE_TARGET;
}

// Always force Mini PC API host — never reintroduce VPS domains.
merged.VITE_SUPABASE_URL = CANONICAL_URL;

const key = merged.VITE_SUPABASE_ANON_KEY || '';
if (!key || key.split('.')[2] === DEMO_SIG) {
  console.error('[sync-env-production] No valid anon key in .env or ../.env.local');
  process.exit(1);
}

const body = [
  '# Auto-synced for release — URL locked to Mini PC api.ndmcore.com.',
  `VITE_TARGET=${merged.VITE_TARGET}`,
  `VITE_SUPABASE_URL=${merged.VITE_SUPABASE_URL}`,
  `VITE_SUPABASE_ANON_KEY=${merged.VITE_SUPABASE_ANON_KEY}`,
  `VITE_DISABLE_REALTIME=${merged.VITE_DISABLE_REALTIME}`,
  '',
].join('\n');

writeFileSync(dest, body, 'utf8');
console.log(`[sync-env-production] Wrote .env.production → ${CANONICAL_URL} (anon ${key.length} chars)`);
