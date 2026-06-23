/**
 * Remediation-specific guards extending staging-env-guard.
 */
import crypto from 'crypto';
import fs from 'fs';
import {
  assertStagingTarget,
  printMaskedTarget,
  loadEnvLocal,
  pgClientOptions,
} from '../single-core-ledger/staging-env-guard.mjs';

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

export function sha256Text(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

export function parseRemediationArgs() {
  const dryRunFileIdx = process.argv.indexOf('--dry-run-file');
  const dryRunFile = dryRunFileIdx >= 0 ? process.argv[dryRunFileIdx + 1] : null;
  const expectedIdx = process.argv.indexOf('--expected-safe-count');
  const expectedSafeCount =
    expectedIdx >= 0 && process.argv[expectedIdx + 1] != null
      ? Number(process.argv[expectedIdx + 1])
      : null;
  return { dryRunFile, expectedSafeCount };
}

function countSafeApply(rows = []) {
  return rows.filter((r) => r.safe_apply).length;
}

function scopedSafeCount(parsed, scope) {
  if (scope === 'payment_contact') {
    return (
      parsed.payment_contact?.safe_apply ??
      countSafeApply(parsed.sections?.payment_contact?.rows) ??
      countSafeApply(
        (parsed.rows || []).filter((r) => r.issue_type === 'payments_missing_contact_sale_linked')
      )
    );
  }
  if (scope === 'branch_attribution') {
    return (
      parsed.branch_attribution?.safe_apply ??
      countSafeApply(parsed.sections?.branch_attribution?.rows) ??
      countSafeApply(
        (parsed.rows || []).filter((r) => r.issue_type === 'branch_attribution_risk')
      )
    );
  }
  return parsed.summary?.safe_apply_total ?? countSafeApply(parsed.rows);
}

/**
 * @param {{ inventoryOnly?: boolean, requireApply?: boolean, dryRunFile?: string|null, expectedSafeCount?: number|null }} opts
 */
export function assertRemediationTarget(opts = {}) {
  const {
    inventoryOnly = false,
    requireApply = false,
    dryRunFile = null,
    expectedSafeCount = null,
  } = opts;

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

  if (requireApply) {
    if (!dryRunFile) {
      throw new Error('--dry-run-file <path> is required for apply scripts.');
    }
    if (!fs.existsSync(dryRunFile)) {
      throw new Error(`Dry-run file not found: ${dryRunFile}`);
    }
    const fileHash = sha256File(dryRunFile);
    let manifest;
    try {
      manifest = JSON.parse(fs.readFileSync(dryRunFile, 'utf8'));
    } catch (e) {
      throw new Error(`Dry-run file is not valid JSON: ${e.message}`);
    }
    const embedded = manifest.manifest?.sha256;
    if (embedded && embedded !== fileHash) {
      throw new Error(`Dry-run SHA256 mismatch (file=${fileHash}, manifest=${embedded})`);
    }
    if (expectedSafeCount != null) {
      const paymentExpected = scopedSafeCount(manifest, 'payment_contact');
      const branchExpected = scopedSafeCount(manifest, 'branch_attribution');
      const branchRows = (manifest.sections?.branch_attribution?.rows || manifest.branch_attribution?.rows || []).filter(
        (r) => r.issue_type === 'branch_attribution_risk' && r.safe_apply
      );
      const isBranchApply = branchRows.length > 0 && expectedSafeCount === branchRows.length;
      const actual = isBranchApply ? branchExpected : paymentExpected;
      if (Number(actual) !== Number(expectedSafeCount)) {
        throw new Error(
          `safe_apply count mismatch: dry-run has ${actual}, --expected-safe-count=${expectedSafeCount}`
        );
      }
    }
    return { ...target, cloneDb, dryRunFile, fileHash, manifest };
  }

  return { ...target, cloneDb, inventoryOnly, requireApply };
}

export function verifyDryRunFile(dryRunFilePath, expectedSafeCount, opts = {}) {
  const scope = opts.scope ?? 'all';
  if (!dryRunFilePath || !fs.existsSync(dryRunFilePath)) {
    throw new Error(`Dry-run file not found: ${dryRunFilePath ?? 'n/a'}`);
  }
  const parsed = JSON.parse(fs.readFileSync(dryRunFilePath, 'utf8'));
  const fileHash = sha256File(dryRunFilePath);
  const manifestHash = parsed.manifest?.sha256 ?? null;
  if (manifestHash && manifestHash !== fileHash) {
    throw new Error(`Dry-run SHA256 mismatch`);
  }
  const safeCount = scopedSafeCount(parsed, scope === 'all' ? 'payment_contact' : scope);
  if (expectedSafeCount != null && Number(expectedSafeCount) !== Number(safeCount)) {
    throw new Error(`Expected safe_apply ${expectedSafeCount} (${scope}) but dry-run has ${safeCount}`);
  }
  return { parsed, fileHash, safeCount };
}
