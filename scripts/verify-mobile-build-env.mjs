#!/usr/bin/env node
/**
 * Fail if root .env.production (or path from argv) has missing or upstream-tutorial Supabase anon JWT.
 * Used by deploy/deploy.sh before Docker build so /m/ never ships with demo key.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const envPath = process.argv[2] ? path.resolve(process.argv[2]) : path.join(rootDir, '.env.production');

if (!fs.existsSync(envPath)) {
  console.error(`[verify-mobile-build-env] Missing file: ${envPath}`);
  process.exit(1);
}

const text = fs.readFileSync(envPath, 'utf8');
let key = '';
for (const line of text.split('\n')) {
  const t = line.trim();
  if (t.startsWith('VITE_SUPABASE_ANON_KEY=')) {
    key = t.slice('VITE_SUPABASE_ANON_KEY='.length).replace(/^["']|["']$/g, '').trim();
    break;
  }
}

if (!key) {
  console.error('[verify-mobile-build-env] VITE_SUPABASE_ANON_KEY is empty or missing. Mobile /m/ build would be unusable.');
  process.exit(1);
}

/** Same fingerprint as erp-mobile-app/src/lib/supabase.ts UPSTREAM_DEMO_ANON_SIGNATURE */
const UPSTREAM_DEMO_ANON_SIGNATURE = 'uPWERzbv9FtmRpl0cBPDPox08YhjW_zTOXtwYNLWmuo';
const parts = key.split('.');
if (parts.length === 3 && parts[2] === UPSTREAM_DEMO_ANON_SIGNATURE) {
  console.error(
    '[verify-mobile-build-env] VITE_SUPABASE_ANON_KEY is the public Supabase tutorial JWT. Use your self-hosted anon key from Kong or supabase/docker .env.'
  );
  process.exit(1);
}

console.log(`[verify-mobile-build-env] OK: anon key present (${key.length} chars), not upstream demo signature.`);
