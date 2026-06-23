/**
 * Staging-only guard for unified ledger CLI scripts.
 * Supports Supabase Cloud staging OR VPS isolated clone (ledger_stage_YYYYMMDD).
 * Never logs passwords or service role keys.
 */

import fs from 'fs';
import path from 'path';

const BLOCKED_API_HOST_PATTERNS = [
  /supabase\.dincouture\.pk/i,
  /erp\.dincouture\.pk/i,
];

const PRODUCTION_DB_NAME = 'postgres';
const CLONE_DB_PATTERN = /^ledger_stage_[0-9]{8}$/;

const ALLOWED_DB_HOST_PATTERNS = [
  /supabase\.co/i,
  /pooler\.supabase\.com/i,
  /localhost/i,
  /127\.0\.0\.1/i,
  /^172\.\d+\.\d+\.\d+$/i,
  /72\.62\.254\.176/i,
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
      database: (u.pathname || '').replace(/^\//, '') || PRODUCTION_DB_NAME,
      port: u.port || null,
    };
  } catch {
    const hostMatch = connectionString.match(/@([^:/]+)/);
    const dbMatch = connectionString.match(/\/([^?]+)/);
    return {
      host: hostMatch?.[1] ?? null,
      database: dbMatch?.[1] ?? PRODUCTION_DB_NAME,
    };
  }
}

function isCloneDatabase(database) {
  return Boolean(database && CLONE_DB_PATTERN.test(database));
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
  const vpsClone = process.env.UNIFIED_LEDGER_VPS_CLONE === '1';
  const db = parseDbTarget(connectionString);

  for (const target of [supabaseUrl].filter(Boolean)) {
    for (const pat of BLOCKED_API_HOST_PATTERNS) {
      if (pat.test(target)) {
        if (vpsClone && process.env.UNIFIED_LEDGER_PG_ONLY === '1') {
          break;
        }
        throw new Error(
          `Blocked Supabase API host (${pat.source}). Use Cloud staging or UNIFIED_LEDGER_PG_ONLY=1 with VPS clone DATABASE_URL.`
        );
      }
    }
  }

  if (!connectionString) {
    if (vpsClone) {
      throw new Error('UNIFIED_LEDGER_VPS_CLONE=1 requires DATABASE_URL to the isolated clone database.');
    }
    throw new Error('DATABASE_URL or staging Supabase credentials required.');
  }

  if (db.database === PRODUCTION_DB_NAME && !isCloneDatabase(db.database)) {
    if (vpsClone) {
      throw new Error(
        `Blocked: DATABASE_URL database "${PRODUCTION_DB_NAME}" is the live production database. Use ledger_stage_YYYYMMDD clone.`
      );
    }
    if (!ALLOWED_DB_HOST_PATTERNS.some((p) => p.test(connectionString)) || /72\.62\.254\.176|dincouture/i.test(connectionString)) {
      throw new Error(
        `Blocked: DATABASE_URL points at production database "${PRODUCTION_DB_NAME}" on a production host. Use Cloud staging or VPS clone (UNIFIED_LEDGER_VPS_CLONE=1).`
      );
    }
  }

  if (vpsClone) {
    if (!isCloneDatabase(db.database)) {
      throw new Error(
        `UNIFIED_LEDGER_VPS_CLONE=1 requires DATABASE_URL database matching ledger_stage_YYYYMMDD (got: ${db.database ?? 'n/a'}).`
      );
    }
  } else if (/72\.62\.254\.176|dincouture\.pk/i.test(connectionString)) {
    throw new Error('Blocked VPS/production DATABASE_URL. Set UNIFIED_LEDGER_VPS_CLONE=1 with a ledger_stage_* clone database.');
  }

  if (!vpsClone && connectionString) {
    const allowed = ALLOWED_DB_HOST_PATTERNS.some((p) => p.test(connectionString));
    if (!allowed && db.host && !/supabase\.co/i.test(connectionString)) {
      throw new Error(`DATABASE_URL host "${db.host}" is not an approved staging pattern.`);
    }
  }

  const supabaseHost = supabaseUrl ? safeHostname(supabaseUrl) : null;

  return {
    dbHost: db.host,
    database: db.database,
    supabaseHost,
    stagingGuard: 'UNIFIED_LEDGER_STAGING=1',
    tieoutGuard: requireTieOut ? 'UNIFIED_LEDGER_TIEOUT_STAGING=1' : null,
    targetType: vpsClone ? 'vps_isolated_clone' : 'supabase_cloud_staging',
    isProductionDb: db.database === PRODUCTION_DB_NAME,
    cloneDatabase: isCloneDatabase(db.database) ? db.database : null,
  };
}

function safeHostname(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

export function printMaskedTarget(summary) {
  console.log('--- Staging target (masked) ---');
  console.log(`Target type: ${summary.targetType ?? 'unknown'}`);
  console.log(`DB host: ${summary.dbHost ?? 'n/a'}`);
  console.log(`Database: ${summary.database ?? 'postgres'}`);
  console.log(`Is production DB name: ${summary.isProductionDb ? 'YES — BLOCKED' : 'no'}`);
  if (summary.cloneDatabase) console.log(`Clone database: ${summary.cloneDatabase}`);
  console.log(`Supabase host: ${summary.supabaseHost ?? 'n/a (pg-only)'}`);
  console.log(`Staging guard: ${summary.stagingGuard}`);
  if (summary.tieoutGuard) console.log(`Tie-out guard: ${summary.tieoutGuard}`);
  console.log('-------------------------------\n');
}

export function pgClientOptions(connectionString) {
  if (!connectionString) return { connectionString };
  const isLocal = /localhost|127\.0\.0\.1|172\.\d{1,3}\.\d{1,3}\.\d{1,3}/i.test(connectionString);
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
