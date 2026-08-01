/**
 * Production remediation guards — metadata apply to live postgres only after explicit approval.
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { assertStagingTarget } from '../single-core-ledger/staging-env-guard.mjs';

const PRODUCTION_DB_NAME = 'postgres';

export function sha256File(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

export function parseProductionArgs() {
  const manifestIdx = process.argv.indexOf('--approval-manifest');
  const manifestPath = manifestIdx >= 0 ? process.argv[manifestIdx + 1] : null;
  const expectedIdx = process.argv.indexOf('--expected-count');
  const expectedCount =
    expectedIdx >= 0 && process.argv[expectedIdx + 1] != null
      ? Number(process.argv[expectedIdx + 1])
      : null;
  return { manifestPath, expectedCount };
}

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
 * Assert production metadata apply is explicitly approved. Rejects clone/staging paths.
 */
export function assertProductionRemediationTarget(opts = {}) {
  const { requireApply = false } = opts;
  const { manifestPath, expectedCount } = parseProductionArgs();

  if (process.env.UNIFIED_LEDGER_VPS_CLONE === '1') {
    throw new Error('UNIFIED_LEDGER_VPS_CLONE must not be set for production remediation apply.');
  }
  if (process.env.UNIFIED_LEDGER_STAGING === '1') {
    throw new Error('UNIFIED_LEDGER_STAGING must not be set for production remediation apply.');
  }
  if (process.env.PRODUCTION_REMEDIATION_TARGET !== '1') {
    throw new Error('PRODUCTION_REMEDIATION_TARGET=1 is required for production remediation.');
  }
  if (requireApply && process.env.PRODUCTION_REMEDIATION_APPROVED !== '1') {
    throw new Error('PRODUCTION_REMEDIATION_APPROVED=1 is required.');
  }
  const backupId = process.env.PRODUCTION_BACKUP_ID;
  if (requireApply && !backupId) {
    throw new Error('PRODUCTION_BACKUP_ID is required (path to verified backup dump).');
  }
  if (requireApply && backupId && !fs.existsSync(backupId)) {
    throw new Error(`PRODUCTION_BACKUP_ID file not found: ${backupId}`);
  }

  const cs =
    process.env.DATABASE_ADMIN_URL ||
    process.env.DATABASE_URL ||
    process.env.DATABASE_POOLER_URL;
  if (!cs) throw new Error('DATABASE_URL required for production remediation.');

  const { database, host } = parseDbTarget(cs);
  if (database !== PRODUCTION_DB_NAME) {
    throw new Error(`Production apply requires database "${PRODUCTION_DB_NAME}" (got: ${database}).`);
  }

  if (!manifestPath || !fs.existsSync(manifestPath)) {
    throw new Error(`Approval manifest not found: ${manifestPath ?? 'n/a'}`);
  }

  const parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const bodyOnly = { ...parsed };
  delete bodyOnly.manifest;
  const bodyHash = crypto.createHash('sha256').update(JSON.stringify(bodyOnly, null, 2), 'utf8').digest('hex');
  const manifestHash = parsed.manifest?.sha256 ?? null;
  if (manifestHash && manifestHash !== bodyHash) {
    throw new Error('Production approval manifest SHA256 mismatch.');
  }

  const rows = (parsed.rows || []).filter((r) => r.production_apply_status !== 'skipped');
  const applyRows = rows.filter((r) => r.proposed_after_value);
  const count = applyRows.length;
  if (expectedCount != null && Number(expectedCount) !== count) {
    throw new Error(`Expected ${expectedCount} rows but manifest has ${count} apply rows.`);
  }

  return {
    database,
    host,
    manifestPath,
    manifestHash: manifestHash || bodyHash,
    parsed,
    applyRows,
    expectedCount: expectedCount ?? count,
    backupId,
  };
}

export function printMaskedProductionTarget(guard) {
  console.log('--- Production target (masked) ---');
  console.log(`DB host: ${guard.host ?? 'n/a'}`);
  console.log(`Database: ${guard.database}`);
  console.log(`Backup ID: ${guard.backupId ? path.basename(guard.backupId) : 'n/a'}`);
  console.log(`Manifest: ${guard.manifestPath ? path.basename(guard.manifestPath) : 'n/a'}`);
  console.log(`Apply rows: ${guard.applyRows?.length ?? 0}`);
  console.log(`unified_ledger_engine: OFF (unchanged)`);
  console.log('-----------------------------------');
  console.log('');
}
