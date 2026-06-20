/**
 * Staging-only guard for unified ledger CLI scripts.
 * Rejects VPS / production hosts. Never logs passwords or service role keys.
 */

import fs from 'fs';
import path from 'path';

const BLOCKED_HOST_PATTERNS = [
  /72\.62\.254\.176/i,
  /supabase\.dincouture\.pk/i,
  /erp\.dincouture\.pk/i,
  /dincouture\.pk/i,
];

const ALLOWED_STAGING_PATTERNS = [
  /supabase\.co/i,
  /pooler\.supabase\.com/i,
  /localhost/i,
  /127\.0\.0\.1/i,
];

export function loadEnvLocal(root) {
  const envPath = path.join(root, '.env.local');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

function parseDbTarget(connectionString) {
  if (!connectionString) return { host: null, database: null };
  try {
    const u = new URL(connectionString.replace(/^postgresql:/, 'http:'));
    return {
      host: u.hostname || null,
      database: (u.pathname || '').replace(/^\//, '') || 'postgres',
      port: u.port || null,
    };
  } catch {
    const hostMatch = connectionString.match(/@([^:/]+)/);
    const dbMatch = connectionString.match(/\/([^?]+)/);
    return {
      host: hostMatch?.[1] ?? null,
      database: dbMatch?.[1] ?? 'postgres',
    };
  }
}

export function assertStagingTarget({ requireTieOut = false } = {}) {
  if (process.env.UNIFIED_LEDGER_STAGING !== '1') {
    throw new Error('UNIFIED_LEDGER_STAGING=1 is required (staging/clone guard).');
  }
  if (requireTieOut && process.env.UNIFIED_LEDGER_TIEOUT_STAGING !== '1') {
    throw new Error('UNIFIED_LEDGER_TIEOUT_STAGING=1 is required for tie-out runs.');
  }

  const connectionString =
    process.env.DATABASE_ADMIN_URL ||
    process.env.DATABASE_URL ||
    process.env.DATABASE_POOLER_URL;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;

  for (const target of [connectionString, supabaseUrl].filter(Boolean)) {
    for (const pat of BLOCKED_HOST_PATTERNS) {
      if (pat.test(target)) {
        throw new Error(
          `Blocked target (${pat.source}). Use Supabase Cloud staging clone only — not VPS/production.`
        );
      }
    }
  }

  const db = parseDbTarget(connectionString);
  const supabaseHost = supabaseUrl ? new URL(supabaseUrl).hostname : null;

  if (connectionString) {
    const allowed = ALLOWED_STAGING_PATTERNS.some((p) => p.test(connectionString));
    if (!allowed && db.host) {
      throw new Error(`DATABASE_URL host "${db.host}" is not an approved staging pattern.`);
    }
  }

  return {
    dbHost: db.host,
    database: db.database,
    supabaseHost,
    stagingGuard: 'UNIFIED_LEDGER_STAGING=1',
    tieoutGuard: requireTieOut ? 'UNIFIED_LEDGER_TIEOUT_STAGING=1' : null,
  };
}

export function printMaskedTarget(summary) {
  console.log('--- Staging target (masked) ---');
  console.log(`DB host: ${summary.dbHost ?? 'n/a'}`);
  console.log(`Database: ${summary.database ?? 'postgres'}`);
  console.log(`Supabase host: ${summary.supabaseHost ?? 'n/a'}`);
  console.log(`Staging guard: ${summary.stagingGuard}`);
  if (summary.tieoutGuard) console.log(`Tie-out guard: ${summary.tieoutGuard}`);
  console.log('-------------------------------\n');
}

export function pgClientOptions(connectionString) {
  if (!connectionString) return { connectionString };
  const isLocal = /localhost|127\.0\.0\.1/i.test(connectionString);
  let cs = connectionString;
  if (!isLocal) {
    cs = cs.replace(/[?&]sslmode=[^&]*/g, '');
    const sep = cs.includes('?') ? '&' : '?';
    cs = `${cs}${sep}sslmode=no-verify`;
  }
  return {
    connectionString: cs,
    ssl: isLocal ? false : { rejectUnauthorized: false },
  };
}
