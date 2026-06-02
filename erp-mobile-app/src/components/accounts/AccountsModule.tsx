import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { User } from '../../types';
import { usePermissions } from '../../context/PermissionContext';
import { AccountsDashboard, type AccountEntry } from './AccountsDashboard';
import { GeneralEntryFlow } from './GeneralEntryFlow';
import { AccountTransferFlow } from './AccountTransferFlow';
import { SupplierPaymentFlow } from './SupplierPaymentFlow';
import { CustomerPaymentFlow } from './CustomerPaymentFlow';
import { WorkerPaymentFlow } from './WorkerPaymentFlow';
import { ExpenseEntryFlow } from './ExpenseEntryFlow';
import { ChartOfAccountsView } from './ChartOfAccountsView';
import { AddAccountForm } from './AddAccountForm';
import { ReportsHub, type LegacyReportKey } from './reports/ReportsHub';
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
import {
  MOBILE_DATA_INVALIDATED_EVENT,
  shouldAcceptMobileInvalidation,
  type MobileInvalidationDetail,
} from '../../lib/dataInvalidationBus';

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
  | 'courier-shipments';

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
            onExpenseEntry={() => setView('expense-entry')}
            onViewReports={() => setView('reports')}
            onChartOfAccounts={() => setView('chart')}
            onEntryClick={(entry) => {
              setSelectedEntry(entry);
              setView('entry-detail');
            }}
            onMyActivity={() => setView('my-activity')}
          />
        </div>
      </div>
    );
  }

  if (view === 'general-entry') {
    return (
      <GeneralEntryFlow onBack={() => setView('dashboard')} onComplete={() => setView('dashboard')} user={user} companyId={companyId} branchId={branch?.id} />
    );
  }
  if (view === 'account-transfer') {
    return (
      <AccountTransferFlow onBack={() => setView('dashboard')} onComplete={() => setView('dashboard')} user={user} companyId={companyId} branchId={branch?.id} />
    );
  }
  if (view === 'supplier-payment') {
    return (
      <SupplierPaymentFlow onBack={() => setView('dashboard')} onComplete={() => setView('dashboard')} user={user} companyId={companyId} branchId={branch?.id} />
    );
  }
  if (view === 'client-payment') {
    return (
      <CustomerPaymentFlow onBack={() => setView('dashboard')} onComplete={() => setView('dashboard')} user={user} companyId={companyId} branchId={branch?.id ?? null} />
    );
  }
  if (view === 'worker-payment') {
    return (
      <WorkerPaymentFlow onBack={() => setView('dashboard')} onComplete={() => setView('dashboard')} user={user} companyId={companyId} branchId={branch?.id ?? null} />
    );
  }
  if (view === 'expense-entry') {
    return (
      <ExpenseEntryFlow onBack={() => setView('dashboard')} onComplete={() => setView('dashboard')} user={user} companyId={companyId} branchId={branch?.id} />
    );
  }
  if (view === 'chart') {
    return <ChartOfAccountsView key={`chart-${reportRefreshEpoch}`} onBack={() => setView('dashboard')} onAddAccount={() => setView('add-account')} companyId={companyId ?? null} />;
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
      />
    );
  }

  if (view === 'account-ledger') {
    return (
      <AccountLedgerReport
        key={`account-ledger-${reportRefreshEpoch}`}
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
        key={`customer-ledger-${reportRefreshEpoch}`}
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
        key={`supplier-ledger-${reportRefreshEpoch}`}
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
        key={`worker-ledger-${reportRefreshEpoch}`}
        onBack={backToReports}
        kind="worker"
        companyId={companyId ?? null}
        branchId={branch?.id ?? null}
        user={user}
      />
    );
  }
  if (view === 'daybook') {
    return <DayBookReport key={`daybook-${reportRefreshEpoch}`} onBack={backToReports} companyId={companyId ?? null} branchId={branch?.id ?? null} user={user} />;
  }
  if (view === 'cash-summary') {
    return (
      <AccountSummaryReport
        key={`cash-summary-${reportRefreshEpoch}`}
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
        key={`bank-summary-${reportRefreshEpoch}`}
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
        key={`wallet-summary-${reportRefreshEpoch}`}
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
        key={`payables-${reportRefreshEpoch}`}
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
        key={`receivables-${reportRefreshEpoch}`}
        onBack={backFromPartyReport}
        kind="receivables"
        companyId={companyId ?? null}
        branchId={branch?.id ?? null}
        user={user}
      />
    );
  }
  if (view === 'sales-report') {
    return <SalesReport key={`sales-report-${reportRefreshEpoch}`} onBack={backToReports} companyId={companyId ?? null} branchId={branch?.id ?? null} user={user} />;
  }
  if (view === 'studio-sales') {
    return <SalesReport key={`studio-sales-${reportRefreshEpoch}`} onBack={backToReports} companyId={companyId ?? null} branchId={branch?.id ?? null} user={user} isStudio />;
  }
  if (view === 'purchase-report') {
    return <PurchaseReport key={`purchase-report-${reportRefreshEpoch}`} onBack={backToReports} companyId={companyId ?? null} branchId={branch?.id ?? null} user={user} />;
  }
  if (view === 'expense-report') {
    return <ExpenseReport key={`expense-report-${reportRefreshEpoch}`} onBack={backToReports} companyId={companyId ?? null} branchId={branch?.id ?? null} user={user} />;
  }
  if (view === 'studio-report') {
    return <StudioReport key={`studio-report-${reportRefreshEpoch}`} onBack={backToReports} companyId={companyId ?? null} user={user} />;
  }
  if (view === 'rental-report') {
    return <RentalReport key={`rental-report-${reportRefreshEpoch}`} onBack={backToReports} companyId={companyId ?? null} user={user} />;
  }
  if (view === 'inventory-report') {
    return <InventoryReport key={`inventory-report-${reportRefreshEpoch}`} onBack={backToReports} companyId={companyId ?? null} user={user} />;
  }
  if (view === 'courier-shipments') {
    return (
      <CourierShipmentsReport
        key={`courier-shipments-${reportRefreshEpoch}`}
        onBack={backToReports}
        companyId={companyId ?? null}
        branchId={branch?.id ?? null}
        onOpenSale={(saleId) => onNavigateToDocumentEdit?.('sale', saleId)}
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
