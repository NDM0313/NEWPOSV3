/**
 * Remediation-specific guards extending staging-env-guard.
 * Clone-only apply: ledger_stage_YYYYMMDD, dry-run SHA256, REMEDIATION_APPLY_CONFIRM.
 */
import crypto from 'crypto';
import fs from 'fs';
import {
  assertStagingTarget,
  printMaskedTarget,
  loadEnvLocal,
  pgClientOptions,
} from '../../single-core-ledger/staging-env-guard.mjs';

export { loadEnvLocal, printMaskedTarget, pgClientOptions };

const CLONE_DB_PATTERN = /^ledger_stage_[0-9]{8}$/;
const PRODUCTION_DB_NAME = 'postgres';

export function getCloneDatabaseName() {
  const cs =
    process.env.DATABASE_ADMIN_URL ||
    process.env.DATABASE_URL ||
    process.env.DATABASE_POOLER_URL;
  if (cs) {
    try {
      const u = new URL(cs.replace(/^postgresql:/, 'http:'));
      const db = (u.pathname || '').replace(/^\//, '');
      if (db && CLONE_DB_PATTERN.test(db)) return db;
    } catch {
      /* fall through */
    }
  }
  return process.env.CLONE_DB || 'ledger_stage_20260623';
}

export function sha256File(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

/**
 * @param {{ inventoryOnly?: boolean, requireApply?: boolean }} opts
 */
export function assertRemediationTarget(opts = {}) {
  const { inventoryOnly = false, requireApply = false } = opts;

  const target = assertStagingTarget();
  const cloneDb = getCloneDatabaseName();

  if (!CLONE_DB_PATTERN.test(cloneDb)) {
    throw new Error(`Clone DB must match ledger_stage_YYYYMMDD (got: ${cloneDb})`);
  }

  if (target.database === PRODUCTION_DB_NAME) {
    throw new Error(`Blocked: database "${PRODUCTION_DB_NAME}" is production. Use clone ${cloneDb}.`);
  }

  if (process.env.UNIFIED_LEDGER_VPS_CLONE !== '1') {
    throw new Error('UNIFIED_LEDGER_VPS_CLONE=1 is required for remediation scripts.');
  }

  if (requireApply && process.env.REMEDIATION_APPLY_CONFIRM !== '1') {
    throw new Error('REMEDIATION_APPLY_CONFIRM=1 is required for clone apply scripts.');
  }

  return { ...target, cloneDb, inventoryOnly, requireApply };
}

/**
 * @param {string} dryRunFilePath
 * @param {number} [expectedSafeCount]
 * @param {{ scope?: 'payment_contact'|'branch_attribution'|'all' }} [opts]
 */
export function verifyDryRunFile(dryRunFilePath, expectedSafeCount, opts = {}) {
  const scope = opts.scope ?? 'all';
  if (!dryRunFilePath || !fs.existsSync(dryRunFilePath)) {
    throw new Error(`Dry-run file not found: ${dryRunFilePath ?? 'n/a'}`);
  }

  const raw = fs.readFileSync(dryRunFilePath, 'utf8');
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`Dry-run file is not valid JSON: ${e.message}`);
  }

  const fileHash = sha256File(dryRunFilePath);
  const manifestHash = parsed.manifest?.sha256 ?? null;
  if (manifestHash && manifestHash !== fileHash) {
    throw new Error(
      `Dry-run SHA256 mismatch: file=${fileHash.slice(0, 16)}… manifest=${manifestHash.slice(0, 16)}…`
    );
  }

  let safeCount;
  if (scope === 'payment_contact') {
    safeCount =
      parsed.payment_contact?.safe_apply ??
      (parsed.payment_contact?.rows ?? []).filter((r) => r.safe_apply).length;
  } else if (scope === 'branch_attribution') {
    safeCount =
      parsed.branch_attribution?.safe_apply ??
      (parsed.branch_attribution?.rows ?? []).filter((r) => r.safe_apply).length;
  } else {
    safeCount =
      parsed.summary?.safe_apply_total ??
      parsed.totals?.safe_apply ??
      (parsed.rows || []).filter((r) => r.safe_apply).length;
  }

  if (expectedSafeCount != null && Number(expectedSafeCount) !== Number(safeCount)) {
    throw new Error(
      `Expected safe_apply count ${expectedSafeCount} (${scope}) but dry-run has ${safeCount}. Abort apply.`
    );
  }

  return { parsed, fileHash, safeCount };
}
