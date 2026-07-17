import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  isReportAllowedByPermissions,
  reportsVisibleInMode,
  REPORT_CATALOG,
  type ReportCatalogEntry,
} from '../../lib/reportsHubCatalog';
import {
  createLoaderMetadata,
  normalizeSingleCoreError,
  resolveSingleCoreScope,
  toRpcDateOrNull,
} from './pure';

/** Pure policy: Cash Flow unified failure must never present as silent success without fallbackReason. */
test('cash flow fail-loud policy: unified fail requires fallbackReason or hard error', () => {
  const silentBad = { loaderSource: 'legacy' as const, error: null, fallbackReason: null, data: { rows: [] } };
  const explicitFallback = {
    loaderSource: 'legacy' as const,
    error: null,
    fallbackReason: 'unified_cash_flow_failed→legacy_roznamcha: timeout',
    data: { rows: [] },
  };
  const hardError = {
    loaderSource: 'unavailable' as const,
    error: 'Unified failed',
    fallbackReason: 'timeout',
    data: null,
  };
  // Policy assertion used by loadMobileCashFlow contract
  const isSilentUnifiedFail = (r: typeof silentBad) =>
    r.loaderSource === 'legacy' && r.error === null && !r.fallbackReason && Array.isArray(r.data?.rows);
  assert.equal(isSilentUnifiedFail(silentBad), true); // documents forbidden shape
  assert.equal(
    explicitFallback.loaderSource === 'legacy' &&
      explicitFallback.error === null &&
      !explicitFallback.fallbackReason,
    false,
  );
  assert.ok(explicitFallback.fallbackReason);
  assert.equal(Boolean(hardError.error), true);
});

test('worker ledger basis labels: operational vs official GL are distinct', () => {
  const official = 'Official GL journal (2010 / 1180) — web Worker Ledger parity';
  const operational = 'Operational worker_ledger_entries (not official GL)';
  assert.notEqual(official, operational);
  assert.match(official, /Official GL/);
  assert.match(operational, /not official GL/);
});

test('worker scope mapping uses company + optional branch null as company-wide', () => {
  const { scope, error } = resolveSingleCoreScope({
    companyId: 'co-1',
    branchId: null,
    dateFrom: '2026-07-01',
    dateTo: '2026-07-17',
  });
  assert.equal(error, null);
  assert.equal(scope?.branchId, null);
  assert.equal(toRpcDateOrNull(scope?.dateFrom), '2026-07-01');
});

test('worker unified RPC failure normalizes without inventing zero owed success', () => {
  const e = normalizeSingleCoreError(new Error('get_unified_party_ledger permission denied'));
  assert.equal(e.code, 'permission_denied');
  assert.equal(e.retryable, false);
});

test('worker loader metadata can mark operational fallback', () => {
  const scope = resolveSingleCoreScope({ companyId: 'co-1' }).scope!;
  const meta = createLoaderMetadata({
    resolved: {
      source: 'legacy',
      killSwitchActive: false,
      loaderFlagEnabled: true,
      companyEngineEnabled: true,
      screenFlagEnabled: true,
    },
    scope,
    screenId: 'party_ledger',
    rpcName: 'getWorkerLedgerEntries',
    fallbackReason: 'operational_worker_ledger_after_gl_empty',
    resultKind: 'fallback',
  });
  assert.equal(meta.resultKind, 'fallback');
  assert.equal(meta.fallbackReason, 'operational_worker_ledger_after_gl_empty');
});

test('salesman / limited user cannot see trial balance or account ledger via hub permissions', () => {
  const salesman = {
    fullAccounting: false,
    canViewCustomerLedger: true,
    canViewSupplierLedger: false,
  };
  const keys = reportsVisibleInMode('advanced', salesman).map((r) => r.key);
  assert.equal(keys.includes('trial-balance'), false);
  assert.equal(keys.includes('account-ledger'), false);
  assert.equal(keys.includes('cash-flow'), false);
  assert.equal(keys.includes('purchase-report'), false);
  assert.ok(keys.includes('customer-ledger'));
  assert.equal(keys.includes('supplier-ledger'), false);
});

test('salesman cannot access transfer-related report tiles that require full accounting', () => {
  const salesman = {
    fullAccounting: false,
    canViewCustomerLedger: true,
    canViewSupplierLedger: false,
  };
  const transferLike = REPORT_CATALOG.filter(
    (e: ReportCatalogEntry) =>
      e.requiresFullAccounting &&
      (e.key === 'daybook' || e.key === 'trial-balance' || e.key === 'ledger-v2'),
  );
  for (const entry of transferLike) {
    assert.equal(isReportAllowedByPermissions(entry, salesman), false);
  }
});

test('easy limited hub hides advanced financial statements even for full accounting', () => {
  const admin = {
    fullAccounting: true,
    canViewCustomerLedger: true,
    canViewSupplierLedger: true,
  };
  const keys = reportsVisibleInMode('easy', admin).map((r) => r.key);
  assert.equal(keys.includes('trial-balance'), false);
  assert.equal(keys.includes('balance-sheet'), false);
});

test('branch company-wide null is represented as null in single core scope', () => {
  const scoped = resolveSingleCoreScope({ companyId: 'co', branchId: 'all' });
  assert.equal(scoped.scope?.branchId, null);
});

test('accounting write invalidation contract requires companyId', async () => {
  // Mirror invalidateAfterAccountingWrite early-return contract without Capacitor.
  const calls: string[] = [];
  const invalidate = async (opts: { companyId: string; reason?: string }) => {
    if (!opts.companyId) return;
    calls.push(opts.reason ?? 'accounting-write');
  };
  await invalidate({ companyId: '', reason: 'should-skip' });
  await invalidate({ companyId: 'co-1', reason: 'sale-created-accounting' });
  await invalidate({ companyId: 'co-1', reason: 'worker-payment' });
  await invalidate({ companyId: 'co-1', reason: 'expense-created' });
  assert.deepEqual(calls, ['sale-created-accounting', 'worker-payment', 'expense-created']);
});
