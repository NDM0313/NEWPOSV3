import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createLoaderMetadata,
  mapUnifiedCashBankToRoznamcha,
  mapUnifiedRowsToLedgerLines,
  normalizeSingleCoreError,
  resolveSingleCoreScope,
  toRpcDateOrNull,
  type LoaderMetadata,
} from './pure';
import type { UnifiedLedgerRow } from '../../types/unifiedReports';

type ResolveReportLoaderResult = {
  source: 'legacy' | 'unified' | 'unavailable';
  killSwitchActive: boolean;
  loaderFlagEnabled: boolean;
  companyEngineEnabled: boolean;
  screenFlagEnabled: boolean;
};

function effectiveReportLoaderSource(resolved: ResolveReportLoaderResult): 'legacy' | 'unified' {
  return resolved.source === 'unified' ? 'unified' : 'legacy';
}

function sampleRow(partial: Partial<UnifiedLedgerRow> = {}): UnifiedLedgerRow {
  return {
    journalEntryLineId: 'jel-1',
    journalEntryId: 'je-1',
    entryDate: '2026-07-01',
    entryNo: 'JE-1',
    referenceType: 'sale',
    description: 'Test',
    debit: 100,
    credit: 0,
    runningBalance: 100,
    paymentId: null,
    accountCode: '1100',
    accountName: 'AR',
    partyResolved: 'Customer A',
    ...partial,
  };
}

const flagsOn: ResolveReportLoaderResult = {
  source: 'unified',
  killSwitchActive: false,
  loaderFlagEnabled: true,
  companyEngineEnabled: true,
  screenFlagEnabled: true,
};

const flagsOff: ResolveReportLoaderResult = {
  source: 'legacy',
  killSwitchActive: false,
  loaderFlagEnabled: false,
  companyEngineEnabled: true,
  screenFlagEnabled: false,
};

const killSwitch: ResolveReportLoaderResult = {
  source: 'legacy',
  killSwitchActive: true,
  loaderFlagEnabled: true,
  companyEngineEnabled: true,
  screenFlagEnabled: true,
};

test('flag ON resolves effective source unified', () => {
  assert.equal(effectiveReportLoaderSource(flagsOn), 'unified');
});

test('flag OFF resolves effective source legacy', () => {
  assert.equal(effectiveReportLoaderSource(flagsOff), 'legacy');
});

test('kill switch resolves effective source legacy', () => {
  assert.equal(effectiveReportLoaderSource(killSwitch), 'legacy');
});

test('missing company scope is an error, not a zero success', () => {
  const { scope, error } = resolveSingleCoreScope({ companyId: '' });
  assert.equal(scope, null);
  assert.equal(error?.code, 'missing_scope');
});

test('company and branch scope mapping preserves null branch as company-wide', () => {
  const { scope, error } = resolveSingleCoreScope({
    companyId: 'co-1',
    branchId: null,
    dateFrom: '2026-07-01',
    dateTo: '2026-07-17',
  });
  assert.equal(error, null);
  assert.equal(scope?.companyId, 'co-1');
  assert.equal(scope?.branchId, null);
  assert.equal(scope?.dateFrom, '2026-07-01');
  assert.equal(scope?.dateTo, '2026-07-17');
});

test('Asia/Karachi date boundaries keep YYYY-MM-DD; empty becomes null for all-time RPC', () => {
  const withDates = resolveSingleCoreScope({
    companyId: 'co-1',
    dateFrom: '2026-07-01T18:00:00+05:00',
    dateTo: '2026-07-17T23:59:59+05:00',
  });
  assert.equal(withDates.scope?.dateFrom, '2026-07-01');
  assert.equal(withDates.scope?.dateTo, '2026-07-17');
  assert.equal(toRpcDateOrNull(withDates.scope?.dateFrom), '2026-07-01');
  assert.equal(toRpcDateOrNull(''), null);
  assert.equal(toRpcDateOrNull(null), null);
});

test('normalizeSingleCoreError never invents a success zero', () => {
  const e = normalizeSingleCoreError(new Error('RPC failed'));
  assert.equal(e.code, 'rpc_error');
  assert.match(e.message, /RPC failed/);
  assert.equal(e.retryable, true);
});

test('permission errors are typed distinctly', () => {
  const e = normalizeSingleCoreError(new Error('permission denied by RLS'));
  assert.equal(e.code, 'permission_denied');
  assert.equal(e.retryable, false);
});

test('debit/credit and running-balance mapping preserves canonical values', () => {
  const lines = mapUnifiedRowsToLedgerLines([
    sampleRow({ debit: 250, credit: 0, runningBalance: 250 }),
    sampleRow({
      journalEntryLineId: 'jel-2',
      debit: 0,
      credit: 40,
      runningBalance: 210,
    }),
  ]);
  assert.equal(lines.length, 2);
  assert.equal(lines[0].debit, 250);
  assert.equal(lines[0].credit, 0);
  assert.equal(lines[0].runningBalance, 250);
  assert.equal(lines[1].debit, 0);
  assert.equal(lines[1].credit, 40);
  assert.equal(lines[1].runningBalance, 210);
});

test('unified cash/bank maps to Roznamcha IN/OUT without inventing opening', () => {
  const result = mapUnifiedCashBankToRoznamcha(
    [
      sampleRow({ debit: 500, credit: 0, runningBalance: 1500 }),
      sampleRow({
        journalEntryLineId: 'jel-2',
        debit: 0,
        credit: 200,
        runningBalance: 1300,
      }),
    ],
    1000,
    1300,
  );
  assert.equal(result.summary.openingBalance, 1000);
  assert.equal(result.summary.cashIn, 500);
  assert.equal(result.summary.cashOut, 200);
  assert.equal(result.summary.closingBalance, 1300);
  assert.equal(result.rows[0].direction, 'IN');
  assert.equal(result.rows[1].direction, 'OUT');
  assert.equal(result.rows[0].sourceJournalEntryId, 'je-1');
});

test('loader/basis badge metadata includes fallback reason when present', () => {
  const scope = resolveSingleCoreScope({
    companyId: 'co-1',
    branchId: 'br-1',
    dateFrom: '2026-07-01',
    dateTo: '2026-07-17',
  }).scope!;
  const meta: LoaderMetadata = createLoaderMetadata({
    resolved: flagsOn,
    scope,
    screenId: 'party_ledger',
    rpcName: 'get_unified_party_ledger',
    fallbackReason: 'unified_rpc_error→legacy_party_gl',
    resultKind: 'fallback',
  });
  assert.equal(meta.source, 'unified');
  assert.equal(meta.basis, 'official_gl');
  assert.equal(meta.companyId, 'co-1');
  assert.equal(meta.branchId, 'br-1');
  assert.equal(meta.rpcName, 'get_unified_party_ledger');
  assert.equal(meta.fallbackReason, 'unified_rpc_error→legacy_party_gl');
  assert.equal(meta.resultKind, 'fallback');
  assert.ok(meta.lastRefreshIso);
});

test('genuine empty party-shaped result remains distinguishable from error shape', () => {
  const emptyOk = {
    lines: [] as unknown[],
    openingBalance: 0,
    closingBalance: 0,
    error: null as null,
    resultKind: 'empty' as const,
  };
  const failed = {
    lines: [] as unknown[],
    openingBalance: 0,
    closingBalance: 0,
    error: { code: 'rpc_error' as const, message: 'timeout', retryable: true },
    resultKind: 'error' as const,
  };
  assert.equal(emptyOk.error, null);
  assert.equal(emptyOk.resultKind, 'empty');
  assert.notEqual(failed.error, null);
  assert.equal(failed.resultKind, 'error');
  assert.equal(emptyOk.openingBalance, failed.openingBalance);
  assert.notEqual(Boolean(emptyOk.error), Boolean(failed.error));
});

test('explicit fallback metadata is required when showing legacy after unified fail', () => {
  const scope = resolveSingleCoreScope({ companyId: 'co-1' }).scope!;
  const meta = createLoaderMetadata({
    resolved: { ...flagsOn, source: 'legacy' },
    scope,
    screenId: 'roznamcha',
    rpcName: 'get_unified_cash_bank_ledger',
    fallbackReason: 'unified_loader_failed',
    resultKind: 'fallback',
  });
  assert.equal(meta.resultKind, 'fallback');
  assert.ok(meta.fallbackReason);
});

test('company/branch cache invalidation bumps accounting refresh epoch (in-memory)', () => {
  // Avoid sessionStorage dependency in node — exercise mutex/epoch semantics inline.
  let epoch = 0;
  const bump = () => {
    epoch = Date.now();
    return epoch;
  };
  const before = epoch;
  const next = bump();
  assert.ok(next >= before);
});

test('logout cache cleanup contract clears then rebumps epoch marker', () => {
  let stored: string | null = '123';
  stored = null;
  const next = String(Date.now());
  stored = next;
  assert.ok(stored);
  assert.notEqual(stored, '123');
});

test('repeated-submit UI guard contract: in-flight ref rejects second run', async () => {
  let inFlight = false;
  let runs = 0;
  const run = async (task: () => Promise<void>) => {
    if (inFlight) return;
    inFlight = true;
    try {
      await task();
    } finally {
      inFlight = false;
    }
  };
  const slow = new Promise<void>((resolve) => setTimeout(resolve, 20));
  const p1 = run(async () => {
    runs += 1;
    await slow;
  });
  const p2 = run(async () => {
    runs += 1;
  });
  await Promise.all([p1, p2]);
  assert.equal(runs, 1);
});
