/**
 * Supplier / User / Worker party statements: three explicit engines (Operational, GL journal, Reconciliation).
 * No single mixed running-balance list across subledger + journal.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSupabase } from '@/app/context/SupabaseContext';
import { ModernDateFilter } from '@/app/components/customer-ledger-test/modern-original/ModernDateFilter';
import { getTodayYYYYMMDD, cn } from '@/app/components/ui/utils';
import { ModernSummaryCards } from '@/app/components/customer-ledger-test/modern-original/ModernSummaryCards';
import { ModernLedgerTabs } from '@/app/components/customer-ledger-test/modern-original/ModernLedgerTabs';
import { ModernTransactionModal } from '@/app/components/customer-ledger-test/modern-original/ModernTransactionModal';
import { buildTransactionsWithOpeningBalance } from '@/app/services/customerLedgerTypes';
import {
  getSupplierOperationalLedgerData,
  getUserLedgerData,
  getWorkerLedgerData,
  type LedgerEntityType,
} from '@/app/services/ledgerDataAdapters';
import type { LedgerData, Transaction } from '@/app/services/customerLedgerTypes';
import { LoadingSpinner } from '@/app/components/shared/LoadingSpinner';
import { toast } from 'sonner';
import { RefreshCw, Banknote } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { UnifiedPaymentDialog } from '@/app/components/shared/UnifiedPaymentDialog';
import { accountingService, type AccountLedgerEntry } from '@/app/services/accountingService';
import {
  getSingleSupplierPartyReconciliation,
  getSingleWorkerPartyReconciliation,
  type SingleSupplierPartyReconciliation,
  type SingleWorkerPartyReconciliation,
} from '@/app/services/contactBalanceReconciliationService';
import { CustomerGlJournalTable } from '@/app/components/customer-ledger-test/CustomerGlJournalTable';
import { Badge } from '@/app/components/ui/badge';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';

interface GenericLedgerViewProps {
  ledgerType: LedgerEntityType;
  entityId: string;
  entityName: string;
}

const TAB_LABELS: Record<LedgerEntityType, { dataTabLabel: string; agingDescription: string }> = {
  supplier: { dataTabLabel: 'Purchases', agingDescription: 'Payables aging' },
  user: { dataTabLabel: 'Expenses', agingDescription: 'Payables aging' },
  worker: { dataTabLabel: 'Jobs', agingDescription: 'Payables aging' },
};

const STATEMENT_TITLE: Record<LedgerEntityType, string> = {
  supplier: 'Supplier statement',
  user: 'User statement',
  worker: 'Worker statement',
};

/** Default GL view: if opening-balance JEs were re-posted after edits, show only the latest opening journal row; full history via toggle. */
function dedupeOlderOpeningJournalRows(
  entries: AccountLedgerEntry[],
  showAll: boolean
): AccountLedgerEntry[] {
  if (showAll || entries.length < 2) return entries;
  const isOpeningJe = (e: AccountLedgerEntry) => {
    if (!e.journal_entry_id) return false;
    const d = String(e.description || '').toLowerCase();
    const doc = String(e.document_type || '').toLowerCase();
    return d.includes('opening balance') || doc.includes('opening balance') || doc.includes('opening_balance');
  };
  const openingJes = entries.filter(isOpeningJe);
  if (openingJes.length <= 1) return entries;
  const sortKey = (e: AccountLedgerEntry) => {
    const c = e.created_at ? Date.parse(e.created_at) : NaN;
    if (!Number.isNaN(c)) return c;
    return Date.parse(e.date || '') || 0;
  };
  const sorted = [...openingJes].sort((a, b) => sortKey(b) - sortKey(a));
  const keepId = sorted[0]?.journal_entry_id;
  if (!keepId) return entries;
  return entries.filter((e) => !isOpeningJe(e) || e.journal_entry_id === keepId);
}

export function GenericLedgerView({ ledgerType, entityId, entityName }: GenericLedgerViewProps) {
  const { companyId, branchId } = useSupabase();
  const { formatCurrency } = useFormatCurrency();
  const [dateRange, setDateRange] = useState(() => {
    const to = getTodayYYYYMMDD();
    const fromD = new Date(to + 'T12:00:00');
    fromD.setDate(fromD.getDate() - 30);
    const from = fromD.toISOString().split('T')[0];
    return { from, to };
  });

  const [statementEngine, setStatementEngine] = useState<'operational' | 'gl' | 'reconciliation'>('operational');
  const [operationalData, setOperationalData] = useState<LedgerData | null>(null);
  const [operationalLoading, setOperationalLoading] = useState(true);
  const [operationalError, setOperationalError] = useState<string | null>(null);

  const [glEntries, setGlEntries] = useState<AccountLedgerEntry[]>([]);
  const [glLoading, setGlLoading] = useState(false);
  const [glError, setGlError] = useState<string | null>(null);

  const [supplierRecon, setSupplierRecon] = useState<SingleSupplierPartyReconciliation | null>(null);
  const [workerRecon, setWorkerRecon] = useState<SingleWorkerPartyReconciliation | null>(null);
  const [reconLoading, setReconLoading] = useState(false);
  const [reconError, setReconError] = useState<string | null>(null);

  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [workerPaymentDialogOpen, setWorkerPaymentDialogOpen] = useState(false);
  const [balanceRefreshTick, setBalanceRefreshTick] = useState(0);
  const [showOpeningJournalHistory, setShowOpeningJournalHistory] = useState(false);

  const glEntriesDisplay = useMemo(
    () => dedupeOlderOpeningJournalRows(glEntries, showOpeningJournalHistory),
    [glEntries, showOpeningJournalHistory]
  );

  const loadOperationalRef = useRef<() => void>(() => {});
  const loadOperational = useCallback(async () => {
    if (!companyId || !entityId) {
      setOperationalData(null);
      setOperationalLoading(false);
      return;
    }
    setOperationalLoading(true);
    setOperationalError(null);
    try {
      const data =
        ledgerType === 'supplier'
          ? await getSupplierOperationalLedgerData(companyId, entityId, entityName, dateRange.from, dateRange.to)
          : ledgerType === 'user'
            ? await getUserLedgerData(companyId, entityId, entityName, dateRange.from, dateRange.to)
            : await getWorkerLedgerData(companyId, entityId, entityName, dateRange.from, dateRange.to);
      setOperationalData(data);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load operational statement';
      console.error('[GenericLedgerView] operational', e);
      setOperationalError(msg);
      toast.error(msg);
    } finally {
      setOperationalLoading(false);
    }
  }, [companyId, entityId, entityName, ledgerType, dateRange.from, dateRange.to]);

  loadOperationalRef.current = loadOperational;

  useEffect(() => {
    loadOperational();
  }, [loadOperational]);

  useEffect(() => {
    setOperationalData(null);
  }, [entityId, ledgerType]);

  useEffect(() => {
    const bump = () => setBalanceRefreshTick((t) => t + 1);
    window.addEventListener('contactBalancesRefresh', bump);
    return () => window.removeEventListener('contactBalancesRefresh', bump);
  }, []);

  useEffect(() => {
    if (statementEngine !== 'gl' || !companyId || !entityId) return;
    if (ledgerType === 'user') {
      setGlEntries([]);
      setGlLoading(false);
      setGlError(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setGlLoading(true);
      setGlError(null);
      try {
        const entries =
          ledgerType === 'supplier'
            ? await accountingService.getSupplierApGlJournalLedger(
                entityId,
                companyId,
                branchId ?? undefined,
                dateRange.from,
                dateRange.to
              )
            : await accountingService.getWorkerPartyGlJournalLedger(
                entityId,
                companyId,
                branchId ?? undefined,
                dateRange.from,
                dateRange.to
              );
        if (!cancelled) setGlEntries(entries);
      } catch (e: unknown) {
        if (!cancelled) setGlError(e instanceof Error ? e.message : 'Failed to load GL statement');
      } finally {
        if (!cancelled) setGlLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    statementEngine,
    ledgerType,
    entityId,
    companyId,
    branchId,
    dateRange.from,
    dateRange.to,
    balanceRefreshTick,
  ]);

  useEffect(() => {
    if (statementEngine !== 'reconciliation' || !companyId || !entityId) return;
    let cancelled = false;
    (async () => {
      setReconLoading(true);
      setReconError(null);
      try {
        if (ledgerType === 'supplier') {
          const r = await getSingleSupplierPartyReconciliation(companyId, entityId, branchId);
          if (!cancelled) {
            setSupplierRecon(r);
            setWorkerRecon(null);
          }
        } else if (ledgerType === 'worker') {
          const r = await getSingleWorkerPartyReconciliation(companyId, entityId, branchId);
          if (!cancelled) {
            setWorkerRecon(r);
            setSupplierRecon(null);
          }
        } else {
          if (!cancelled) {
            setSupplierRecon(null);
            setWorkerRecon(null);
          }
        }
      } catch (e: unknown) {
        if (!cancelled) setReconError(e instanceof Error ? e.message : 'Failed to load reconciliation');
      } finally {
        if (!cancelled) setReconLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [statementEngine, ledgerType, entityId, companyId, branchId, balanceRefreshTick]);

  useEffect(() => {
    const handlePurchaseDelete = () => {
      if (ledgerType === 'supplier') loadOperationalRef.current();
    };
    const handleLedgerUpdated = (e: Event) => {
      const d = (e as CustomEvent)?.detail;
      if (!d || d.ledgerType !== ledgerType) return;
      if (d.entityId && d.entityId !== entityId) return;
      loadOperationalRef.current();
    };
    const handleStudioProductionSaved = () => {
      if (ledgerType === 'worker') loadOperationalRef.current();
    };
    const handlePurchaseSaved = () => {
      if (ledgerType === 'supplier') loadOperationalRef.current();
    };
    const handlePaymentAdded = () => {
      if (ledgerType === 'supplier' || ledgerType === 'worker') loadOperationalRef.current();
    };

    window.addEventListener('purchaseDeleted', handlePurchaseDelete);
    window.addEventListener('ledgerUpdated', handleLedgerUpdated as EventListener);
    window.addEventListener('studio-production-saved', handleStudioProductionSaved);
    window.addEventListener('purchaseSaved', handlePurchaseSaved);
    window.addEventListener('paymentAdded', handlePaymentAdded);

    return () => {
      window.removeEventListener('purchaseDeleted', handlePurchaseDelete);
      window.removeEventListener('ledgerUpdated', handleLedgerUpdated as EventListener);
      window.removeEventListener('studio-production-saved', handleStudioProductionSaved);
      window.removeEventListener('purchaseSaved', handlePurchaseSaved);
      window.removeEventListener('paymentAdded', handlePaymentAdded);
    };
  }, [ledgerType, entityId]);

  const labels = TAB_LABELS[ledgerType];
  const displayTransactions = operationalData
    ? buildTransactionsWithOpeningBalance(operationalData.openingBalance, operationalData.transactions, dateRange.from)
    : [];
  const ledgerDataForViews = operationalData
    ? { ...operationalData, transactions: displayTransactions }
    : null;

  if (!companyId || !entityId) {
    return <div className="py-8 text-center text-gray-400 text-sm">Select an entity above.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-white">{STATEMENT_TITLE[ledgerType]}</p>
        <p className="text-[11px] text-gray-500">
          Operational (Not GL) · GL (Journal) · Reconciliation (Variance). No unlabeled mixed running balance.
        </p>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <ModernDateFilter dateRange={dateRange} onApply={setDateRange} />
        <button
          type="button"
          onClick={() => loadOperational()}
          disabled={operationalLoading}
          className="p-3 rounded-lg transition-colors flex items-center justify-center bg-gray-900 border border-gray-700 text-gray-400 hover:bg-gray-800 hover:text-white disabled:opacity-50"
          title="Refresh operational statement"
        >
          <RefreshCw size={18} className={operationalLoading ? 'animate-spin' : ''} />
        </button>
        {ledgerType === 'worker' && (
          <Button
            type="button"
            onClick={() => setWorkerPaymentDialogOpen(true)}
            className="bg-green-600 hover:bg-green-500 text-white"
          >
            <Banknote className="w-4 h-4 mr-2" />
            Pay Worker
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            {
              id: 'operational' as const,
              label: 'Operational',
              badge: 'Not GL',
              sub:
                ledgerType === 'supplier'
                  ? 'Purchases + supplier payments (document path)'
                  : ledgerType === 'worker'
                    ? 'Worker jobs / payments (worker_ledger_entries)'
                    : 'Paid expenses (paid_to_user) + posted commission (sales)',
            },
            {
              id: 'gl' as const,
              label: 'GL (journal)',
              badge: 'Journal',
              sub:
                ledgerType === 'supplier'
                  ? 'AP (2000) lines only'
                  : ledgerType === 'worker'
                    ? '2010 + 1180 lines; net running balance'
                    : 'No per-user party GL bucket',
            },
            {
              id: 'reconciliation' as const,
              label: 'Reconciliation',
              badge: 'Variance',
              sub:
                ledgerType === 'supplier'
                  ? 'RPC payables vs GL AP'
                  : ledgerType === 'worker'
                    ? 'RPC vs GL worker payable net'
                    : 'Subledger only (no GL party slice)',
            },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setStatementEngine(t.id)}
            className={cn(
              'flex flex-col items-start rounded-lg border px-3 py-2 text-left transition-colors min-w-[150px]',
              statementEngine === t.id
                ? 'border-blue-500/80 bg-blue-500/15 text-white'
                : 'border-gray-700 bg-[#0F1419] text-gray-300 hover:border-gray-600'
            )}
          >
            <span className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold">{t.label}</span>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-gray-700/80 text-gray-100">
                {t.badge}
              </Badge>
            </span>
            <span className="text-[11px] text-gray-500 mt-0.5">{t.sub}</span>
          </button>
        ))}
      </div>

      {statementEngine === 'operational' && (
        <>
          {operationalError && (
            <div className="rounded-lg border border-red-900/40 bg-red-950/30 px-3 py-2 text-sm text-red-200">
              {operationalError}
            </div>
          )}
          <p className="text-[11px] text-sky-200/80">
            <Badge className="mr-2 bg-sky-600/25 text-sky-100 border-0">Operational</Badge>
            Not GL — subledger / open documents only. Running balance does not include merged journal lines.
          </p>
          {operationalLoading && !operationalData ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner />
            </div>
          ) : ledgerDataForViews ? (
            <>
              <div className="shrink-0 pb-6 border-b border-gray-800">
                <ModernSummaryCards ledgerData={ledgerDataForViews} />
              </div>
              <div>
                <ModernLedgerTabs
                  ledgerData={ledgerDataForViews}
                  saleItemsMap={new Map()}
                  accountName={entityName}
                  dateRange={dateRange}
                  tabLabels={{ dataTabLabel: labels.dataTabLabel, agingDescription: labels.agingDescription }}
                  onTransactionClick={(t) => {
                    if (t.documentType === 'Opening Balance') return;
                    setSelectedTransaction(t);
                  }}
                />
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-500 py-8 text-center">No operational rows in this range.</p>
          )}
        </>
      )}

      {statementEngine === 'gl' && (
        <div className="space-y-3">
          <p className="text-[11px] text-violet-200/85">
            <Badge className="mr-2 bg-violet-600/30 text-violet-100 border-0">GL (journal)</Badge>
            {ledgerType === 'user'
              ? 'Staff/users have no dedicated AR/AP party bucket in COA — use company expense/cash ledgers for GL truth.'
              : ledgerType === 'supplier'
                ? 'Accounts Payable (2000) only. Running balance = credit − debit on AP (what we owe).'
                : 'Worker Payable (2010) and Advance (1180). Running balance = WP liability minus WA asset (journal net).'}
          </p>
          {ledgerType === 'user' ? (
            <div className="rounded-xl border border-gray-800 bg-[#0F1419] p-8 text-center text-sm text-gray-400">
              No GL party statement for this user type. Operational tab shows the staff subledger only.
            </div>
          ) : (
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="rounded border-gray-600"
                  checked={showOpeningJournalHistory}
                  onChange={(e) => setShowOpeningJournalHistory(e.target.checked)}
                />
                <span>
                  Show all opening-balance journal history (edits/reposts). Off = latest opening JE only for a clearer default view.
                </span>
              </label>
              <CustomerGlJournalTable
                entries={glEntriesDisplay}
                loading={glLoading}
                error={glError}
                formatCurrency={formatCurrency}
                dateFrom={dateRange.from}
                dateTo={dateRange.to}
                balanceColumnLabel={ledgerType === 'supplier' ? 'Balance (AP GL)' : 'Net (WP−WA GL)'}
                showAccountCodeColumn={ledgerType === 'worker'}
                loadingHint="Loading GL (journal) statement…"
                emptyHint={
                  ledgerType === 'supplier'
                    ? `No AP journal lines for this supplier in ${dateRange.from} — ${dateRange.to}.`
                    : `No 2010/1180 journal lines for this worker in ${dateRange.from} — ${dateRange.to}.`
                }
              />
            </div>
          )}
        </div>
      )}

      {statementEngine === 'reconciliation' && (
        <div className="rounded-xl border border-gray-800 bg-[#0F1419] p-6 space-y-4">
          <p className="text-[11px] text-amber-200/85">
            <Badge className="mr-2 bg-amber-600/25 text-amber-100 border-0">Reconciliation</Badge>
            {ledgerType === 'user'
              ? 'There is no per-user GL party total to compare; operational subledger is the only slice here.'
              : ledgerType === 'worker'
                ? 'Operational pending (RPC payables for worker) vs GL worker net from journals (2010 liability minus 1180 advance, same basis as Contacts / party GL RPC).'
                : 'Operational RPC vs journal-derived party slice. Unmapped counts are company-wide hygiene signals.'}
          </p>

          {ledgerType === 'user' && (
            <dl className="grid grid-cols-1 gap-4 text-sm">
              <div className="rounded-lg border border-gray-800 bg-[#0B0F14] p-4">
                <dt className="text-gray-500 text-xs uppercase tracking-wide">Operational closing (subledger)</dt>
                <dd className="text-xl font-semibold text-white mt-1 tabular-nums">
                  {formatCurrency(operationalData?.closingBalance ?? 0)}
                </dd>
                <p className="text-[11px] text-gray-500 mt-2">GL party reconciliation — not applicable for user/staff.</p>
              </div>
            </dl>
          )}

          {ledgerType !== 'user' && reconLoading && (
            <div className="flex justify-center py-12">
              <LoadingSpinner />
            </div>
          )}
          {ledgerType !== 'user' && reconError && (
            <div className="rounded-lg border border-red-900/40 bg-red-950/30 px-3 py-2 text-sm text-red-200">
              {reconError}
            </div>
          )}

          {ledgerType === 'supplier' && !reconLoading && !reconError && supplierRecon && (
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="rounded-lg border border-gray-800 bg-[#0B0F14] p-4">
                <dt className="text-gray-500 text-xs uppercase tracking-wide">Operational payable (RPC)</dt>
                <dd className="text-xl font-semibold text-white mt-1 tabular-nums">
                  {formatCurrency(supplierRecon.operationalPayable)}
                </dd>
              </div>
              <div className="rounded-lg border border-gray-800 bg-[#0B0F14] p-4">
                <dt className="text-gray-500 text-xs uppercase tracking-wide">GL AP (journal slice)</dt>
                <dd className="text-xl font-semibold text-violet-200 mt-1 tabular-nums">
                  {formatCurrency(supplierRecon.glApPayable)}
                </dd>
              </div>
              <div className="rounded-lg border border-gray-800 bg-[#0B0F14] p-4 sm:col-span-2">
                <dt className="text-gray-500 text-xs uppercase tracking-wide">Variance (operational − GL)</dt>
                <dd
                  className={cn(
                    'text-2xl font-bold mt-1 tabular-nums',
                    Math.abs(supplierRecon.variance) < 0.01 ? 'text-emerald-300' : 'text-amber-300'
                  )}
                >
                  {formatCurrency(supplierRecon.variance)}
                </dd>
                <p className="text-[11px] text-gray-500 mt-2">As of {supplierRecon.asOfDate}.</p>
              </div>
              <div className="rounded-lg border border-amber-900/30 bg-amber-950/15 p-4 sm:col-span-2">
                <dt className="text-amber-200/90 text-xs uppercase tracking-wide">Unmapped AP journal entries (company)</dt>
                <dd className="text-lg font-semibold text-amber-100 mt-1 tabular-nums">
                  {supplierRecon.companyUnmappedApCount} distinct JEs
                </dd>
              </div>
            </dl>
          )}

          {ledgerType === 'worker' && !reconLoading && !reconError && workerRecon && (
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="rounded-lg border border-gray-800 bg-[#0B0F14] p-4">
                <dt className="text-gray-500 text-xs uppercase tracking-wide">Operational pending (RPC)</dt>
                <dd className="text-xl font-semibold text-white mt-1 tabular-nums">
                  {formatCurrency(workerRecon.operationalPending)}
                </dd>
              </div>
              <div className="rounded-lg border border-gray-800 bg-[#0B0F14] p-4">
                <dt className="text-gray-500 text-xs uppercase tracking-wide">GL worker payable net</dt>
                <dd className="text-xl font-semibold text-violet-200 mt-1 tabular-nums">
                  {formatCurrency(workerRecon.glWorkerPayableNet)}
                </dd>
              </div>
              <div className="rounded-lg border border-gray-800 bg-[#0B0F14] p-4 sm:col-span-2">
                <dt className="text-gray-500 text-xs uppercase tracking-wide">Variance (operational − GL)</dt>
                <dd
                  className={cn(
                    'text-2xl font-bold mt-1 tabular-nums',
                    Math.abs(workerRecon.variance) < 0.01 ? 'text-emerald-300' : 'text-amber-300'
                  )}
                >
                  {formatCurrency(workerRecon.variance)}
                </dd>
                <p className="text-[11px] text-gray-500 mt-2">As of {workerRecon.asOfDate}.</p>
              </div>
              <div className="rounded-lg border border-amber-900/30 bg-amber-950/15 p-4 sm:col-span-2">
                <dt className="text-amber-200/90 text-xs uppercase tracking-wide">Company unmapped JE counts (hygiene)</dt>
                <dd className="text-sm text-amber-100 mt-1">
                  AP: {workerRecon.companyUnmappedApCount} · AR: {workerRecon.companyUnmappedArCount} distinct JEs
                </dd>
                <p className="text-[11px] text-gray-500 mt-2">
                  Worker-specific unmapped detection is not split in this RPC; use Integrity / Reconciliation Center for
                  line review.
                </p>
              </div>
            </dl>
          )}
        </div>
      )}

      {selectedTransaction && (
        <ModernTransactionModal
          transaction={selectedTransaction}
          onClose={() => setSelectedTransaction(null)}
        />
      )}

      {ledgerType === 'worker' && (
        <UnifiedPaymentDialog
          isOpen={workerPaymentDialogOpen}
          onClose={() => setWorkerPaymentDialogOpen(false)}
          context="worker"
          entityName={entityName}
          entityId={entityId}
          outstandingAmount={ledgerDataForViews?.invoicesSummary?.pendingAmount ?? 0}
          onSuccess={() => {
            setWorkerPaymentDialogOpen(false);
            loadOperational();
            setBalanceRefreshTick((t) => t + 1);
          }}
        />
      )}
    </div>
  );
}
