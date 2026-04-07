#!/usr/bin/env node
/**
 * Pull self-hosted Supabase SERVICE_ROLE JWT from VPS into local .env.local
 * (fixes wrong sb_secret_* / short keys for admin scripts).
 *
 * Requires: SSH config host `dincouture-vps` (see .cursor/rules vps-ssh.mdc).
 *
 * Usage (from repo root):
 *   node scripts/admin/pull-service-role-from-vps.mjs
 *   node scripts/admin/pull-service-role-from-vps.mjs --dry-run
 *
 * Updates/creates:
 *   SUPABASE_SERVICE_ROLE_KEY=<jwt from VPS /root/supabase/docker/.env>
 *
 * Does NOT add service_role to any VITE_* key (never expose service role to the browser bundle).
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SSH_HOST = process.env.DINCOUTURE_SSH_HOST || 'dincouture-vps';
const REMOTE_PATH = process.env.SUPABASE_DOCKER_ENV || '/root/supabase/docker/.env';
const LOCAL_ENV = resolve(process.cwd(), '.env.local');
const DRY = process.argv.includes('--dry-run');

function sh(cmd) {
  return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
}

function pullJwtFromVps() {
  const out = sh(`ssh ${SSH_HOST} "grep '^SERVICE_ROLE_KEY=' '${REMOTE_PATH}'"`);
  const line = out.trim().split('\n')[0];
  const eq = line.indexOf('=');
  if (eq < 0) throw new Error(`Unexpected remote line: ${line.slice(0, 80)}`);
  const jwt = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
  if (!jwt.startsWith('eyJ') || jwt.split('.').length !== 3) {
    throw new Error('Remote SERVICE_ROLE_KEY is not a 3-part JWT — check VPS path / self-hosted config.');
  }
  return jwt;
}

function upsertEnvFile(content, key, value) {
  const re = new RegExp(`^${key}=.*$`, 'm');
  const line = `${key}=${value}`;
  if (re.test(content)) {
    return content.replace(re, line);
  }
  const sep = content.endsWith('\n') ? '' : '\n';
  return `${content}${sep}\n# Synced from VPS ${REMOTE_PATH} (pull-service-role-from-vps.mjs)\n${line}\n`;
}

function main() {
  console.log(`SSH host: ${SSH_HOST}`);
  console.log(`Remote: ${REMOTE_PATH}`);
  console.log(`Local:  ${LOCAL_ENV}`);

  const jwt = pullJwtFromVps();
  console.log(`Pulled JWT: length=${jwt.length}, prefix=${jwt.slice(0, 12)}…`);

  if (DRY) {
    console.log('[dry-run] Would write SUPABASE_SERVICE_ROLE_KEY to .env.local');
    return;
  }

  let body = '';
  if (existsSync(LOCAL_ENV)) {
    body = readFileSync(LOCAL_ENV, 'utf8');
  } else {
    body = '# Created by pull-service-role-from-vps.mjs\n';
  }

  body = upsertEnvFile(body, 'SUPABASE_SERVICE_ROLE_KEY', jwt);

  // Remove dangerous duplicate if present (service role must never ship to Vite client)
  body = body.replace(/^\s*VITE_SUPABASE_SERVICE_ROLE_KEY=.*$/m, '# VITE_SUPABASE_SERVICE_ROLE_KEY removed — use SUPABASE_SERVICE_ROLE_KEY for Node/admin scripts only (never VITE_ for service_role)');

  writeFileSync(LOCAL_ENV, body, 'utf8');
  console.log(`Updated ${LOCAL_ENV}`);
  console.log('Next: npx tsx scripts/admin/company-opening-repair-and-verify.ts --company <uuid> --verify-only');
}

try {
  main();
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}
