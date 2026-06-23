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
    const rows =
      parsed.sections?.payment_contact?.rows ??
      parsed.payment_contact?.rows ??
      (parsed.rows || []).filter((r) => r.issue_type === 'payments_missing_contact_sale_linked');
    return parsed.payment_contact?.safe_apply ?? countSafeApply(rows);
  }
  if (scope === 'branch_attribution') {
    const rows =
      parsed.sections?.branch_attribution?.rows ??
      parsed.branch_attribution?.rows ??
      (parsed.rows || []).filter((r) => r.issue_type === 'branch_attribution_risk');
    return parsed.branch_attribution?.safe_apply ?? countSafeApply(rows);
  }
  return parsed.summary?.safe_apply_total ?? countSafeApply(parsed.rows);
}

/**
 * @param {{ inventoryOnly?: boolean, requireApply?: boolean, dryRunFile?: string|null, expectedSafeCount?: number|null, dryRunScope?: 'payment_contact'|'branch_attribution'|'all' }} opts
 */
export function assertRemediationTarget(opts = {}) {
  const {
    inventoryOnly = false,
    requireApply = false,
    dryRunFile = null,
    expectedSafeCount = null,
    dryRunScope = 'payment_contact',
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
    const verified = verifyDryRunFile(dryRunFile, expectedSafeCount, { scope: dryRunScope });
    return { ...target, cloneDb, dryRunFile, ...verified, manifest: verified.parsed };
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
  const bodyOnly = { ...parsed };
  delete bodyOnly.manifest;
  const bodyHash = sha256Text(JSON.stringify(bodyOnly, null, 2));
  if (manifestHash && manifestHash !== bodyHash) {
    throw new Error(`Dry-run SHA256 mismatch (manifest=${manifestHash.slice(0, 12)}… body=${bodyHash.slice(0, 12)}…)`);
  }
  const safeCount = scopedSafeCount(parsed, scope === 'all' ? 'payment_contact' : scope);
  if (expectedSafeCount != null && Number(expectedSafeCount) !== Number(safeCount)) {
    throw new Error(`Expected safe_apply ${expectedSafeCount} (${scope}) but dry-run has ${safeCount}`);
  }
  return { parsed, fileHash: manifestHash || bodyHash, safeCount };
}
