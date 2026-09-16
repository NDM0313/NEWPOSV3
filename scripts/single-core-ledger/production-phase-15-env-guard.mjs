/**
 * Phase 1.7 — production Phase 1.5 migration guards (live postgres only).
 */
import fs from 'fs';
import path from 'path';

const PRODUCTION_DB_NAME = 'postgres';

export const PHASE_15_MIGRATION_FILES = [
  '20260620140000_get_unified_party_ledger_shadow.sql',
  '20260621120000_single_core_ledger_systemwide_diagnostics.sql',
  '20260621150000_unified_ledger_phase_15_rpcs.sql',
  '20260621151000_unified_ledger_phase_15_indexes.sql',
];

function parseDbTarget(connectionString) {
  if (!connectionString) return { host: null, database: null };
  try {
    const u = new URL(connectionString.replace(/^postgresql:/, 'http:'));
    return {
      host: u.hostname || null,
      database: (u.pathname || '').replace(/^\//, '') || PRODUCTION_DB_NAME,
    };
  } catch {
    return { host: null, database: PRODUCTION_DB_NAME };
  }
}

/**
 * Assert Phase 1.5 production migration apply is explicitly approved.
 */
export function assertPhase15ProductionTarget(opts = {}) {
  const { requireApply = false } = opts;

  if (process.env.UNIFIED_LEDGER_VPS_CLONE === '1') {
    throw new Error('UNIFIED_LEDGER_VPS_CLONE must not be set for Phase 1.5 production apply.');
  }
  if (process.env.UNIFIED_LEDGER_STAGING === '1') {
    throw new Error('UNIFIED_LEDGER_STAGING must not be set for Phase 1.5 production apply.');
  }
  if (process.env.PHASE_15_PRODUCTION_TARGET !== '1') {
    throw new Error('PHASE_15_PRODUCTION_TARGET=1 is required.');
  }
  if (requireApply && process.env.PHASE_15_PRODUCTION_APPROVED !== '1') {
    throw new Error('PHASE_15_PRODUCTION_APPROVED=1 is required.');
  }

  const backupId = process.env.PHASE_15_PRODUCTION_BACKUP_ID;
  if (requireApply && !backupId) {
    throw new Error('PHASE_15_PRODUCTION_BACKUP_ID is required (path to verified backup dump).');
  }
  if (requireApply && backupId && !fs.existsSync(backupId)) {
    throw new Error(`PHASE_15_PRODUCTION_BACKUP_ID file not found: ${backupId}`);
  }

  const cs =
    process.env.DATABASE_ADMIN_URL ||
    process.env.DATABASE_URL ||
    process.env.DATABASE_POOLER_URL;
  if (!cs) throw new Error('DATABASE_URL required for Phase 1.5 production apply.');

  const { database, host } = parseDbTarget(cs);
  if (database !== PRODUCTION_DB_NAME) {
    throw new Error(`Phase 1.5 production apply requires database "${PRODUCTION_DB_NAME}" (got: ${database}).`);
  }

  const targetDb = process.env.TARGET_DB || PRODUCTION_DB_NAME;
  if (targetDb !== PRODUCTION_DB_NAME) {
    throw new Error(`TARGET_DB must be postgres for production apply (got: ${targetDb}).`);
  }

  return {
    database,
    host,
    backupId,
    migrationFiles: PHASE_15_MIGRATION_FILES,
    expectedMigrationCount: PHASE_15_MIGRATION_FILES.length,
  };
}

export function printMaskedPhase15ProductionTarget(guard) {
  console.log('--- Phase 1.5 production target (masked) ---');
  console.log(`DB host: ${guard.host ?? 'n/a'}`);
  console.log(`Database: ${guard.database}`);
  console.log(`Backup ID: ${guard.backupId ? path.basename(guard.backupId) : 'n/a'}`);
  console.log(`Migrations: ${guard.expectedMigrationCount} files`);
  console.log('unified_ledger_engine: OFF (unchanged)');
  console.log('---------------------------------------------');
  console.log('');
}
