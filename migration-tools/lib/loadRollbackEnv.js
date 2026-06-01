import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';
import { TOOLS_ROOT } from './resolvePaths.js';
import { jwtPayloadRole, validateTargetCompanyId } from './loadMigrationEnv.js';

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

/**
 * @param {string[]} [argv=process.argv.slice(2)]
 */
export function loadRollbackEnv(argv = process.argv.slice(2)) {
  loadEnvFiles();

  const dryRun = argv.includes('--dry-run');
  const confirm = argv.includes('--confirm');
  const skipConfirm = argv.includes('--yes');
  const journalsOnly = argv.includes('--journals-only');
  const all = argv.includes('--all');

  if (journalsOnly && all) {
    throw new Error('Use only one mode flag: --journals-only or --all');
  }

  let mode = null;
  if (journalsOnly) mode = 'journals-only';
  else if (all) mode = 'all';

  if (!dryRun && !confirm) {
    throw new Error('Rollback blocked. Pass --confirm to delete, or --dry-run to preview counts only.');
  }

  const targetCompanyId = validateTargetCompanyId(
    readArg(argv, 'target-company-id') || process.env.TARGET_COMPANY_ID
  );

  const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(
    /\/+$/,
    ''
  );
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!supabaseUrl || !serviceRoleKey) {
    const hasViteAnon = Boolean(process.env.VITE_SUPABASE_ANON_KEY);
    const hint = hasViteAnon
      ? ' Add SUPABASE_SERVICE_ROLE_KEY to migration-tools/.env.migration.'
      : '';
    throw new Error(
      `Missing SUPABASE_URL (or VITE_SUPABASE_URL) or SUPABASE_SERVICE_ROLE_KEY.${hint}`
    );
  }
  const jwtRole = jwtPayloadRole(serviceRoleKey);
  if (jwtRole !== 'service_role') {
    throw new Error(
      `SUPABASE_SERVICE_ROLE_KEY must be service_role (got ${jwtRole === null ? 'decode failed' : `"${jwtRole}"`}).`
    );
  }

  return {
    dryRun,
    confirm,
    skipConfirm,
    mode,
    targetCompanyId,
    supabaseUrl,
    serviceRoleKey,
  };
}
