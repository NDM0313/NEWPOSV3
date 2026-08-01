import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { TOOLS_ROOT } from './resolvePaths.js';

const STAGING_PLACEHOLDER_UUID = '00000000-0000-4000-8000-000000000001';
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function readArg(argv, name) {
  const flag = `--${name}`;
  const i = argv.indexOf(flag);
  if (i === -1) return null;
  const next = argv[i + 1];
  if (!next || next.startsWith('--')) return null;
  return next;
}

function loadEnvFiles() {
  const repoRoot = path.resolve(TOOLS_ROOT, '..');
  const migrationEnv = path.join(TOOLS_ROOT, '.env.migration');
  const localEnv = path.join(repoRoot, '.env.local');

  if (fs.existsSync(migrationEnv)) {
    dotenv.config({ path: migrationEnv });
  }
  if (fs.existsSync(localEnv)) {
    dotenv.config({ path: localEnv, override: false });
  }
}

export function jwtPayloadRole(jwt) {
  try {
    const parts = jwt.split('.');
    if (parts.length < 2) return null;
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = Buffer.from(b64, 'base64').toString('utf8');
    const payload = JSON.parse(json);
    return payload.role || null;
  } catch {
    return null;
  }
}

export function validateTargetCompanyId(id) {
  if (!id || typeof id !== 'string') {
    throw new Error('TARGET_COMPANY_ID is required (--target-company-id or .env.migration).');
  }
  const trimmed = id.trim();
  if (!UUID_RE.test(trimmed)) {
    throw new Error(`TARGET_COMPANY_ID is not a valid UUID: ${id}`);
  }
  if (trimmed.toLowerCase() === STAGING_PLACEHOLDER_UUID) {
    throw new Error(
      `TARGET_COMPANY_ID cannot be the extraction placeholder (${STAGING_PLACEHOLDER_UUID}). Use the new live company UUID.`
    );
  }
  return trimmed;
}

/**
 * @param {string[]} [argv=process.argv.slice(2)]
 */
export function loadMigrationEnv(argv = process.argv.slice(2)) {
  loadEnvFiles();

  const dryRun = argv.includes('--dry-run');
  const apply = argv.includes('--apply');
  const confirm = argv.includes('--confirm') || apply;
  const phase = readArg(argv, 'phase') || 'all';
  const batchSize = Math.max(1, Number(readArg(argv, 'batch-size') || 100) || 100);
  const targetCompanyId = validateTargetCompanyId(
    readArg(argv, 'company-id') ||
      readArg(argv, 'target-company-id') ||
      process.env.TARGET_COMPANY_ID
  );

  const validPhases = new Set(['all', 'contacts', 'accounts', 'products', 'ledgers']);
  if (!validPhases.has(phase)) {
    throw new Error(`Invalid --phase "${phase}". Use: ${[...validPhases].join(', ')}`);
  }

  if (!dryRun && !confirm) {
    throw new Error(
      'Live import blocked. Pass --confirm or --apply to write, or use --dry-run to preview only.'
    );
  }

  const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '')
    .replace(/\/+$/, '');
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const requireSupabaseForDryRun = argv.includes('--require-supabase');

  if (!dryRun || requireSupabaseForDryRun) {
    if (!supabaseUrl || !serviceRoleKey) {
      const hasViteAnon = Boolean(process.env.VITE_SUPABASE_ANON_KEY);
      const hint = hasViteAnon
        ? ' VITE_SUPABASE_ANON_KEY is not sufficient — add SUPABASE_SERVICE_ROLE_KEY to migration-tools/.env.migration (get from VPS: ssh dincouture-vps "grep ^SERVICE_ROLE_KEY= /root/supabase/docker/.env").'
        : '';
      throw new Error(
        `Missing SUPABASE_URL (or VITE_SUPABASE_URL) or SUPABASE_SERVICE_ROLE_KEY in migration-tools/.env.migration or .env.local.${hint}`
      );
    }
    const jwtRole = jwtPayloadRole(serviceRoleKey);
    if (jwtRole !== 'service_role') {
      throw new Error(
        `SUPABASE_SERVICE_ROLE_KEY must be service_role (got ${jwtRole === null ? 'decode failed' : `"${jwtRole}"`}).`
      );
    }
  }

  return {
    dryRun,
    apply,
    confirm,
    phase,
    batchSize,
    targetCompanyId,
    supabaseUrl,
    serviceRoleKey,
    outputDir: path.resolve(TOOLS_ROOT, 'output'),
  };
}
