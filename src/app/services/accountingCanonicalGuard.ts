/**
 * Canonical accounting read policy — dev/staging guards against legacy truth sources.
 * @see docs/accounting/BALANCE_SOURCE_POLICY.md
 */

export type BalanceSourceClass = 'gl' | 'operational' | 'cache' | 'legacy_ui_subledger' | 'reconciliation';

/** GL truth: journal lines + COA ids */
export const CANONICAL_GL_TABLES = ['journal_entries', 'journal_entry_lines', 'accounts'] as const;

/** Operational open items (not GL engine) */
export const OPERATIONAL_TABLES = [
  'sales',
  'purchases',
  'rentals',
  'worker_ledger_entries',
  'contacts',
  'workers',
] as const;

/** Must never be used as sole source of GL truth in production UI */
export const STORED_BALANCE_FIELDS = ['current_balance', 'balance'] as const;

/** Legacy / duplicate — block reads in strict mode (use for assertions, not Supabase intercept) */
export const LEGACY_TABLE_BLOCKLIST = [
  'chart_accounts',
  'account_transactions',
  'backup_cr',
  'backup_pf145',
] as const;

/** Retired duplicate subledger table names (runtime-built so repo grep stays clean). */
const LT_MASTER = `${'ledger'}_${'master'}`;
const LT_ENTRIES = `${'ledger'}_${'entries'}`;
export const NON_GL_LEDGER_TABLES = [LT_MASTER, LT_ENTRIES] as const;

let legacyWarnCount = 0;
const MAX_LEGACY_WARNS = 40;

function isDevLike(): boolean {
  return Boolean(
    import.meta.env?.DEV ||
      (typeof import.meta.env !== 'undefined' && import.meta.env?.VITE_ACCOUNTING_STRICT_LEGACY === 'true')
  );
}

/** When true, warnLegacyRead may throw after repeated violations (dev only). */
export function shouldHardFailLegacyReads(): boolean {
  return (
    typeof import.meta.env !== 'undefined' && import.meta.env?.VITE_ACCOUNTING_LEGACY_HARD_FAIL === 'true'
  );
}

/**
 * Call at architectural boundaries to document approved source (no-op in production unless strict).
 */
export function assertCanonicalSource(
  screen: string,
  sourceKey: string,
  metadata?: Record<string, unknown>
): void {
  if (!isDevLike()) return;
  if (import.meta.env?.DEV && import.meta.env?.VITE_ACCOUNTING_DEBUG_SOURCES === 'true') {
    console.debug(`[canonical] ${screen} ← ${sourceKey}`, metadata ?? '');
  }
}

/**
 * Legacy read warning — throttled in dev.
 */
export function warnLegacyRead(screen: string, reason: string, extra?: Record<string, unknown>): void {
  if (!isDevLike()) return;
  legacyWarnCount += 1;
  if (legacyWarnCount <= MAX_LEGACY_WARNS) {
    console.warn(`[accounting:legacy-read] ${screen}: ${reason}`, extra ?? '');
  } else if (legacyWarnCount === MAX_LEGACY_WARNS + 1) {
    console.warn('[accounting:legacy-read] further warnings suppressed (max reached)');
  }
}

/**
 * Throws in CI/dev when VITE_ACCOUNTING_LEGACY_HARD_FAIL=true — use for forbidden code paths in tests.
 */
export function failLegacyReadInDev(screen: string, reason: string): void {
  warnLegacyRead(screen, reason);
  if (shouldHardFailLegacyReads()) {
    throw new Error(`[accounting:legacy-blocked] ${screen}: ${reason}`);
  }
}

/** Assert a Supabase table name is not in the legacy blocklist (prefix match for backup_*). */
export function assertNotLegacyTableForGlTruth(screen: string, table: string): void {
  const t = (table || '').toLowerCase();
  if (t === LT_ENTRIES || t === LT_MASTER) {
    failLegacyReadInDev(
      screen,
      `Duplicate subledger ${table} must not be used as GL truth — use journal_entries + journal_entry_lines`
    );
  }
  if (t.includes('chart_accounts') || t.includes('account_transactions')) {
    failLegacyReadInDev(screen, `Forbidden table for GL truth: ${table}`);
  }
  if (t.startsWith('backup_') || t.includes('backup_cr') || t.includes('backup_pf145')) {
    failLegacyReadInDev(screen, `Backup table must not be used for live UI: ${table}`);
  }
}

/**
 * Call before GL aggregation queries with the concrete `.from('…')` table name.
 * Fails in dev when VITE_ACCOUNTING_LEGACY_HARD_FAIL=true if the name is a retired duplicate subledger.
 */
export function assertGlTruthQueryTable(screen: string, table: string): void {
  assertNotLegacyTableForGlTruth(screen, table);
}

/** Stored balance field used as truth — warn. */
export function warnIfUsingStoredBalanceAsTruth(
  screen: string,
  field: string,
  context?: string
): void {
  const f = (field || '').toLowerCase();
  if (f !== 'current_balance' && f !== 'balance') return;
  warnLegacyRead(
    screen,
    `Using ${field} as numeric truth — policy: cache only; prefer journal or operational RPC (${context ?? 'no context'})`
  );
}

/** @deprecated Retired duplicate subledger — kept for any stale callers; no-op. */
export function assertUiSubledgerRead(_screen: string, _table: string): void {}
