import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { User } from '../../types';
import { usePermissions } from '../../context/PermissionContext';
import { AccountsDashboard, type AccountEntry } from './AccountsDashboard';
import { GeneralEntryFlow, type GeneralEntrySeed } from './GeneralEntryFlow';
import { AccountTransferFlow } from './AccountTransferFlow';
import { SupplierPaymentFlow } from './SupplierPaymentFlow';
import { CustomerPaymentFlow } from './CustomerPaymentFlow';
import { WorkerPaymentFlow } from './WorkerPaymentFlow';
import { CourierPaymentFlow } from './CourierPaymentFlow';
import { ExpenseEntryFlow } from './ExpenseEntryFlow';
import { getJournalEntryById } from '../../api/accounts';
import { supabase } from '../../lib/supabase';
import {
  buildGeneralEntrySeedFromJournalLines,
  buildTransferSeedFromJournalLines,
  duplicateViewForSourceKind,
} from '../../lib/duplicateEntryRouting';
import type { CopyTransactionPrefill } from '../../lib/copyTransactionPrefill';
import { ChartOfAccountsView } from './ChartOfAccountsView';
import { AddAccountForm } from './AddAccountForm';
import { ReportsHub, type LegacyReportKey } from './reports/ReportsHub';
import { loadStoredReportHubMode, saveReportHubMode, type ReportHubMode } from '../../lib/reportsHubCatalog';
import { AccountLedgerReport } from './reports/AccountLedgerReport';
import { PartyLedgerReport } from './reports/PartyLedgerReport';
import { DayBookReport } from './reports/DayBookReport';
import { AccountSummaryReport } from './reports/AccountSummaryReport';
import { AgingReport } from './reports/AgingReport';
import { SalesReport } from './reports/SalesReport';
import { PurchaseReport } from './reports/PurchaseReport';
import { ExpenseReport } from './reports/ExpenseReport';
import { StudioReport } from './reports/StudioReport';
import { RentalReport } from './reports/RentalReport';
import { InventoryReport } from './reports/InventoryReport';
import { JournalEntryDetailPanel } from './JournalEntryDetailPanel';
import { MyFinancialActivity } from './MyFinancialActivity';
import { CourierShipmentsReport } from './reports/CourierShipmentsReport';
import { BalanceSheetReport } from './reports/BalanceSheetReport';
import { ProfitLossReport } from './reports/ProfitLossReport';
import { TrialBalanceReport } from './reports/TrialBalanceReport';
import { CashFlowReport } from './reports/CashFlowReport';
import { LedgerV2Report } from './reports/LedgerV2Report';
import {
  MOBILE_DATA_INVALIDATED_EVENT,
  shouldAcceptMobileInvalidation,
  type MobileInvalidationDetail,
} from '../../lib/dataInvalidationBus';
import { localNowDateString } from '../../utils/localDate';

interface AccountsModuleProps {
  onBack: () => void;
  user: User;
  companyId?: string | null;
  branch?: { id: string; name: string; location: string } | null;
  /** If true, the module opens directly on the reports hub (used when navigating from the legacy
   * Reports / Ledger tiles on the home screen). */
  initialView?: 'dashboard' | 'reports';
  /** Open a specific report directly (e.g. customer-ledger from home Ledger tile). */
  initialReport?: LegacyReportKey;
  /** Worker home tile: open My Activity instead of company ledger. */
  initialWorkerActivity?: boolean;
  onNavigateToDocumentEdit?: (kind: 'sale' | 'purchase', documentId: string) => void;
}

type View =
  | 'dashboard'
  | 'general-entry'
  | 'account-transfer'
  | 'supplier-payment'
  | 'client-payment'
  | 'worker-payment'
  | 'courier-payment'
  | 'expense-entry'
  | 'reports'
  | 'chart'
  | 'add-account'
  | 'entry-detail'
  | 'account-ledger'
  | 'customer-ledger'
  | 'supplier-ledger'
  | 'worker-ledger'
  | 'daybook'
  | 'cash-summary'
  | 'bank-summary'
  | 'wallet-summary'
  | 'payables'
  | 'receivables'
  | 'sales-report'
  | 'studio-sales'
  | 'purchase-report'
  | 'expense-report'
  | 'studio-report'
  | 'rental-report'
  | 'inventory-report'
  | 'my-activity'
  | 'courier-shipments'
  | 'balance-sheet'
  | 'profit-loss'
  | 'trial-balance'
  | 'cash-flow'
  | 'ledger-v2';

const PARTY_VIEWS: View[] = ['dashboard', 'my-activity'];

function isPartyViewAllowed(view: View): boolean {
  return PARTY_VIEWS.includes(view);
}

function resolveInitialAccountsView(
  fullAccounting: boolean,
  initialReport?: LegacyReportKey,
  initialView?: 'dashboard' | 'reports',
  initialWorkerActivity?: boolean,
): View {
  if (!fullAccounting) {
    if (initialWorkerActivity) return 'my-activity';
    return 'dashboard';
  }
  if (initialReport) return initialReport as View;
  return initialView === 'reports' ? 'reports' : 'dashboard';
}

export function AccountsModule({
  onBack,
  user,
  companyId,
  branch,
  initialView,
  initialReport,
  initialWorkerActivity,
  onNavigateToDocumentEdit,
}: AccountsModuleProps) {
  const { canUseFullAccounting, canViewCustomerLedger, canViewSupplierLedger } = usePermissions();

  const [view, setView] = useState<View>(() =>
    resolveInitialAccountsView(canUseFullAccounting, initialReport, initialView, initialWorkerActivity),
  );
  const [selectedEntry, setSelectedEntry] = useState<AccountEntry | null>(null);
  const [ledgerInitialAccountId, setLedgerInitialAccountId] = useState<string | null>(null);
  const [reportRefreshEpoch, setReportRefreshEpoch] = useState(0);
  const [hubMode, setHubMode] = useState<ReportHubMode>(() => loadStoredReportHubMode());
  const [generalEntrySeed, setGeneralEntrySeed] = useState<GeneralEntrySeed | null>(null);
  const [transferSeed, setTransferSeed] = useState<{
    fromAccountId?: string;
    fromAccountName?: string;
    toAccountId?: string;
    toAccountName?: string;
    amount?: number;
    date?: string;
  } | null>(null);
  const [duplicateContactId, setDuplicateContactId] = useState<string | null>(null);
  const [duplicateWorkerId, setDuplicateWorkerId] = useState<string | null>(null);

  const clearDuplicateSeeds = useCallback(() => {
    setGeneralEntrySeed(null);
    setTransferSeed(null);
    setDuplicateContactId(null);
    setDuplicateWorkerId(null);
  }, []);

  const backToDashboardFromFlow = useCallback(() => {
    clearDuplicateSeeds();
    setView('dashboard');
  }, [clearDuplicateSeeds]);

  const handleDuplicateEntry = useCallback(
    async (entry: AccountEntry) => {
      const target = duplicateViewForSourceKind(entry.sourceKind);
      if (!target || !companyId) return;

      clearDuplicateSeeds();

      if (target === 'general-entry' || target === 'account-transfer') {
        const { data } = await getJournalEntryById(companyId, entry.id);
        const lines = data?.lines;
        if (target === 'general-entry') {
          const seed = buildGeneralEntrySeedFromJournalLines(lines, {
            amount: entry.amount,
            date: localNowDateString(),
          });
          setGeneralEntrySeed(seed);
          setView('general-entry');
          return;
        }
        const tSeed = buildTransferSeedFromJournalLines(lines, {
          amount: entry.amount,
          date: localNowDateString(),
        });
        setTransferSeed(tSeed);
        setView('account-transfer');
        return;
      }

      let contactId = entry.referenceId?.trim() || null;
      let workerId: string | null = null;
      if (entry.paymentId) {
        const { data: pay } = await supabase
          .from('payments')
          .select('contact_id, worker_id')
          .eq('id', entry.paymentId)
          .maybeSingle();
        const row = pay as { contact_id?: string | null; worker_id?: string | null } | null;
        if (!contactId) contactId = row?.contact_id?.trim() || null;
        workerId = row?.worker_id?.trim() || null;
      }

      if (target === 'client-payment' || target === 'supplier-payment') {
        setDuplicateContactId(contactId);
        setView(target);
        return;
      }
      if (target === 'worker-payment') {
        setDuplicateWorkerId(workerId || contactId);
        setView(target);
        return;
      }
      setView(target);
    },
    [companyId, clearDuplicateSeeds],
  );

  const openCopyTransaction = useCallback(
    (prefill: CopyTransactionPrefill) => {
      clearDuplicateSeeds();
      setGeneralEntrySeed({
        debitAccountId: prefill.debitAccountId,
        creditAccountId: prefill.creditAccountId,
        startAtDetails: true,
      });
      setView('general-entry');
    },
    [clearDuplicateSeeds],
  );

  useEffect(() => {
    if (canUseFullAccounting) return;
    if (!isPartyViewAllowed(view)) {
      setView('my-activity');
    }
  }, [canUseFullAccounting, view]);

  useEffect(() => {
    if (!companyId) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onInvalidated = (event: Event) => {
      const detail = (event as CustomEvent<MobileInvalidationDetail>).detail;
      if (
        !shouldAcceptMobileInvalidation(detail, {
          domain: ['accounting', 'sales', 'purchases', 'contacts'],
          companyId,
        })
      ) {
        return;
      }
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        setReportRefreshEpoch((v) => v + 1);
      }, 220);
    };
    window.addEventListener(MOBILE_DATA_INVALIDATED_EVENT, onInvalidated as EventListener);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener(MOBILE_DATA_INVALIDATED_EVENT, onInvalidated as EventListener);
    };
  }, [companyId]);

  // Company switch: clear stale company-scoped list caches and force report reload.
  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    void (async () => {
      try {
        const { invalidateCompanyAccountingCaches } = await import('../../api/singleCore/accountingCache');
        await invalidateCompanyAccountingCaches(companyId);
      } catch {
        /* ignore */
      }
      if (!cancelled) setReportRefreshEpoch((v) => v + 1);
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  // Branch switch: clear company list caches (branch-scoped contact balances) and reload reports.
  useEffect(() => {
    if (!companyId) {
      setReportRefreshEpoch((v) => v + 1);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const { invalidateCompanyAccountingCaches } = await import('../../api/singleCore/accountingCache');
        await invalidateCompanyAccountingCaches(companyId);
      } catch {
        /* ignore */
      }
      if (!cancelled) setReportRefreshEpoch((v) => v + 1);
    })();
    return () => {
      cancelled = true;
    };
  }, [branch?.id, companyId]);

  // Revalidate accounting reports when returning to the app / tab.
  useEffect(() => {
    const onFocusLike = () => {
      if (document.visibilityState && document.visibilityState !== 'visible') return;
      setReportRefreshEpoch((v) => v + 1);
    };
    const onAccountingRefresh = () => setReportRefreshEpoch((v) => v + 1);
    document.addEventListener('visibilitychange', onFocusLike);
    window.addEventListener('focus', onFocusLike);
    window.addEventListener('erp-mobile-accounting-refresh', onAccountingRefresh as EventListener);
    return () => {
      document.removeEventListener('visibilitychange', onFocusLike);
      window.removeEventListener('focus', onFocusLike);
      window.removeEventListener('erp-mobile-accounting-refresh', onAccountingRefresh as EventListener);
    };
  }, []);

  const backToDashboard = () => setView('dashboard');
  const backToReports = () => setView(canUseFullAccounting ? 'reports' : 'dashboard');
  const backFromReportsHub = () => {
    if (initialView === 'reports' || (initialReport === 'customer-ledger' && canUseFullAccounting)) {
      onBack();
    } else {
      setView('dashboard');
    }
  };
  const backFromPartyLedger = () => {
    if (initialWorkerActivity || (!canUseFullAccounting && view === 'my-activity')) onBack();
    else if (initialReport === 'customer-ledger') onBack();
    else if (canUseFullAccounting) backToReports();
    else backToDashboard();
  };
  const backFromPartyReport = () => {
    if (canUseFullAccounting) backToReports();
    else backToDashboard();
  };

  const openReport = useCallback(
    (
      key: LegacyReportKey,
      opts?: { accountId?: string | null; partyId?: string | null; partyName?: string | null },
    ) => {
      const target = key as View;
      if (!canUseFullAccounting && !isPartyViewAllowed(target)) {
        setView('my-activity');
        return;
      }
      if (opts?.accountId) setLedgerInitialAccountId(opts.accountId);
      else setLedgerInitialAccountId(null);
      setView(target);
    },
    [canUseFullAccounting],
  );

  const dashboardSubtitle = canUseFullAccounting
    ? 'Financial control center'
    : 'Your payments and expenses';

  if (view === 'dashboard') {
    return (
      <div className="min-h-screen pb-24 bg-[#111827]">
        <div className="bg-gradient-to-br from-[#8B5CF6] to-[#7C3AED] p-4 sticky top-0 z-10 flow-screen-header">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="font-semibold text-white">Accounts</h1>
              <p className="text-xs text-white/80">{dashboardSubtitle}</p>
            </div>
          </div>
        </div>

        <div className="p-4">
          <AccountsDashboard
            user={user}
            companyId={companyId}
            branchId={branch?.id}
            mode={canUseFullAccounting ? 'full' : 'party'}
            onGeneralEntry={() => setView('general-entry')}
            onAccountTransfer={() => setView('account-transfer')}
            onSupplierPayment={() => setView('supplier-payment')}
            onClientPayment={() => setView('client-payment')}
            onWorkerPayment={() => setView('worker-payment')}
            onCourierPayment={() => setView('courier-payment')}
            onExpenseEntry={() => setView('expense-entry')}
            onViewReports={() => setView('reports')}
            onChartOfAccounts={() => setView('chart')}
            onEntryClick={(entry) => {
              setSelectedEntry(entry);
              setView('entry-detail');
            }}
            onMyActivity={() => setView('my-activity')}
            onDuplicateEntry={(entry) => void handleDuplicateEntry(entry)}
          />
        </div>
      </div>
    );
  }

  if (view === 'general-entry') {
    return (
      <GeneralEntryFlow
        onBack={backToDashboardFromFlow}
        onComplete={backToDashboardFromFlow}
        user={user}
        companyId={companyId}
        branchId={branch?.id}
        seed={generalEntrySeed}
      />
    );
  }
  if (view === 'account-transfer') {
    return (
      <AccountTransferFlow
        onBack={backToDashboardFromFlow}
        onComplete={backToDashboardFromFlow}
        user={user}
        companyId={companyId}
        branchId={branch?.id}
        seed={transferSeed}
      />
    );
  }
  if (view === 'supplier-payment') {
    return (
      <SupplierPaymentFlow
        onBack={backToDashboardFromFlow}
        onComplete={backToDashboardFromFlow}
        user={user}
        companyId={companyId}
        branchId={branch?.id}
        initialContactId={duplicateContactId}
      />
    );
  }
  if (view === 'client-payment') {
    return (
      <CustomerPaymentFlow
        onBack={backToDashboardFromFlow}
        onComplete={backToDashboardFromFlow}
        user={user}
        companyId={companyId}
        branchId={branch?.id ?? null}
        initialContactId={duplicateContactId}
      />
    );
  }
  if (view === 'worker-payment') {
    return (
      <WorkerPaymentFlow
        onBack={backToDashboardFromFlow}
        onComplete={backToDashboardFromFlow}
        user={user}
        companyId={companyId}
        branchId={branch?.id ?? null}
        initialWorkerId={duplicateWorkerId}
      />
    );
  }
  if (view === 'courier-payment') {
    return (
      <CourierPaymentFlow
        onBack={backToDashboardFromFlow}
        onComplete={backToDashboardFromFlow}
        user={user}
        companyId={companyId}
        branchId={branch?.id ?? null}
      />
    );
  }
  if (view === 'expense-entry') {
    return (
      <ExpenseEntryFlow
        onBack={backToDashboardFromFlow}
        onComplete={backToDashboardFromFlow}
        user={user}
        companyId={companyId}
        branchId={branch?.id}
      />
    );
  }
  if (view === 'chart') {
    return (
      <ChartOfAccountsView
        reportRefreshEpoch={reportRefreshEpoch}
        onBack={() => setView('dashboard')}
        onAddAccount={() => setView('add-account')}
        companyId={companyId ?? null}
      />
    );
  }
  if (view === 'add-account') {
    return <AddAccountForm companyId={companyId ?? null} onBack={() => setView('chart')} onSuccess={() => setView('chart')} />;
  }

  if (view === 'my-activity') {
    return (
      <MyFinancialActivity
        reportRefreshEpoch={reportRefreshEpoch}
        onBack={backFromPartyLedger}
        user={user}
        companyId={companyId ?? null}
        branchId={branch?.id ?? null}
        onCopyTransaction={openCopyTransaction}
      />
    );
  }

  if (view === 'reports') {
    return (
      <ReportsHub
        reportRefreshEpoch={reportRefreshEpoch}
        onBack={backFromReportsHub}
        onOpenReport={openReport}
        companyId={companyId ?? null}
        branchId={branch?.id ?? null}
        onNavigateToDocumentEdit={onNavigateToDocumentEdit}
        fullAccounting={canUseFullAccounting}
        canViewCustomerLedger={canViewCustomerLedger}
        canViewSupplierLedger={canViewSupplierLedger}
        hubMode={hubMode}
        onHubModeChange={(mode) => {
          setHubMode(mode);
          saveReportHubMode(mode);
        }}
        onCopyTransaction={openCopyTransaction}
      />
    );
  }

  if (view === 'account-ledger') {
    return (
      <AccountLedgerReport
        reportRefreshEpoch={reportRefreshEpoch}
        onBack={() => {
          setLedgerInitialAccountId(null);
          backToReports();
        }}
        companyId={companyId ?? null}
        user={user}
        initialAccountId={ledgerInitialAccountId}
        branchId={branch?.id ?? null}
      />
    );
  }
  if (view === 'customer-ledger') {
    return (
      <PartyLedgerReport
        reportRefreshEpoch={reportRefreshEpoch}
        onBack={backFromPartyLedger}
        kind="customer"
        companyId={companyId ?? null}
        branchId={branch?.id ?? null}
        user={user}
      />
    );
  }
  if (view === 'supplier-ledger') {
    return (
      <PartyLedgerReport
        reportRefreshEpoch={reportRefreshEpoch}
        onBack={backToReports}
        kind="supplier"
        companyId={companyId ?? null}
        branchId={branch?.id ?? null}
        user={user}
      />
    );
  }
  if (view === 'worker-ledger') {
    return (
      <PartyLedgerReport
        reportRefreshEpoch={reportRefreshEpoch}
        onBack={backToReports}
        kind="worker"
        companyId={companyId ?? null}
        branchId={branch?.id ?? null}
        user={user}
      />
    );
  }
  if (view === 'daybook') {
    return (
      <DayBookReport
        reportRefreshEpoch={reportRefreshEpoch}
        onBack={backToReports}
        companyId={companyId ?? null}
        branchId={branch?.id ?? null}
        user={user}
      />
    );
  }
  if (view === 'cash-summary') {
    return (
      <AccountSummaryReport
        reportRefreshEpoch={reportRefreshEpoch}
        onBack={backToReports}
        companyId={companyId ?? null}
        user={user}
        kind="cash"
        branchId={branch?.id ?? null}
        onViewLedger={(accountId) => openReport('account-ledger', { accountId })}
      />
    );
  }
  if (view === 'bank-summary') {
    return (
      <AccountSummaryReport
        reportRefreshEpoch={reportRefreshEpoch}
        onBack={backToReports}
        companyId={companyId ?? null}
        user={user}
        kind="bank"
        branchId={branch?.id ?? null}
        onViewLedger={(accountId) => openReport('account-ledger', { accountId })}
      />
    );
  }
  if (view === 'wallet-summary') {
    return (
      <AccountSummaryReport
        reportRefreshEpoch={reportRefreshEpoch}
        onBack={backToReports}
        companyId={companyId ?? null}
        user={user}
        kind="wallet"
        branchId={branch?.id ?? null}
        onViewLedger={(accountId) => openReport('account-ledger', { accountId })}
      />
    );
  }
  if (view === 'payables') {
    return (
      <AgingReport
        reportRefreshEpoch={reportRefreshEpoch}
        onBack={backFromPartyReport}
        kind="payables"
        companyId={companyId ?? null}
        branchId={branch?.id ?? null}
        user={user}
      />
    );
  }
  if (view === 'receivables') {
    return (
      <AgingReport
        reportRefreshEpoch={reportRefreshEpoch}
        onBack={backFromPartyReport}
        kind="receivables"
        companyId={companyId ?? null}
        branchId={branch?.id ?? null}
        user={user}
      />
    );
  }
  if (view === 'sales-report') {
    return (
      <SalesReport
        reportRefreshEpoch={reportRefreshEpoch}
        onBack={backToReports}
        companyId={companyId ?? null}
        branchId={branch?.id ?? null}
        user={user}
      />
    );
  }
  if (view === 'studio-sales') {
    return (
      <SalesReport
        reportRefreshEpoch={reportRefreshEpoch}
        onBack={backToReports}
        companyId={companyId ?? null}
        branchId={branch?.id ?? null}
        user={user}
        isStudio
      />
    );
  }
  if (view === 'purchase-report') {
    return (
      <PurchaseReport
        reportRefreshEpoch={reportRefreshEpoch}
        onBack={backToReports}
        companyId={companyId ?? null}
        branchId={branch?.id ?? null}
        user={user}
      />
    );
  }
  if (view === 'expense-report') {
    return (
      <ExpenseReport
        reportRefreshEpoch={reportRefreshEpoch}
        onBack={backToReports}
        companyId={companyId ?? null}
        branchId={branch?.id ?? null}
        user={user}
      />
    );
  }
  if (view === 'studio-report') {
    return (
      <StudioReport reportRefreshEpoch={reportRefreshEpoch} onBack={backToReports} companyId={companyId ?? null} user={user} />
    );
  }
  if (view === 'rental-report') {
    return (
      <RentalReport reportRefreshEpoch={reportRefreshEpoch} onBack={backToReports} companyId={companyId ?? null} user={user} />
    );
  }
  if (view === 'inventory-report') {
    return (
      <InventoryReport reportRefreshEpoch={reportRefreshEpoch} onBack={backToReports} companyId={companyId ?? null} user={user} />
    );
  }
  if (view === 'courier-shipments') {
    return (
      <CourierShipmentsReport
        reportRefreshEpoch={reportRefreshEpoch}
        onBack={backToReports}
        companyId={companyId ?? null}
        branchId={branch?.id ?? null}
        onOpenSale={(saleId) => onNavigateToDocumentEdit?.('sale', saleId)}
      />
    );
  }
  if (view === 'balance-sheet') {
    return (
      <BalanceSheetReport
        reportRefreshEpoch={reportRefreshEpoch}
        onBack={backToReports}
        companyId={companyId ?? null}
        branchId={branch?.id ?? null}
        user={user}
      />
    );
  }
  if (view === 'profit-loss') {
    return (
      <ProfitLossReport
        reportRefreshEpoch={reportRefreshEpoch}
        onBack={backToReports}
        companyId={companyId ?? null}
        branchId={branch?.id ?? null}
        user={user}
      />
    );
  }
  if (view === 'trial-balance') {
    return (
      <TrialBalanceReport
        reportRefreshEpoch={reportRefreshEpoch}
        onBack={backToReports}
        companyId={companyId ?? null}
        branchId={branch?.id ?? null}
      />
    );
  }
  if (view === 'cash-flow') {
    return (
      <CashFlowReport
        reportRefreshEpoch={reportRefreshEpoch}
        onBack={backToReports}
        companyId={companyId ?? null}
        branchId={branch?.id ?? null}
      />
    );
  }
  if (view === 'ledger-v2') {
    return (
      <LedgerV2Report
        reportRefreshEpoch={reportRefreshEpoch}
        onBack={backToReports}
        companyId={companyId ?? null}
        branchId={branch?.id ?? null}
      />
    );
  }

  if (view === 'entry-detail' && selectedEntry && companyId) {
    return (
      <JournalEntryDetailPanel
        entry={selectedEntry}
        companyId={companyId}
        branchId={branch?.id ?? null}
        onBack={() => {
          setView('dashboard');
          setSelectedEntry(null);
        }}
        onNavigateToDocumentEdit={onNavigateToDocumentEdit}
      />
    );
  }

  return null;
}
