import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { User } from '../../types';
import { AccountsDashboard, type AccountEntry } from './AccountsDashboard';
import { GeneralEntryFlow } from './GeneralEntryFlow';
import { AccountTransferFlow } from './AccountTransferFlow';
import { SupplierPaymentFlow } from './SupplierPaymentFlow';
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
  onNavigateToDocumentEdit?: (kind: 'sale' | 'purchase', documentId: string) => void;
}

type View =
  | 'dashboard'
  | 'general-entry'
  | 'account-transfer'
  | 'supplier-payment'
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
  | 'inventory-report';

export function AccountsModule({ onBack, user, companyId, branch, initialView, onNavigateToDocumentEdit }: AccountsModuleProps) {
  const [view, setView] = useState<View>(initialView === 'reports' ? 'reports' : 'dashboard');
  const [selectedEntry, setSelectedEntry] = useState<AccountEntry | null>(null);
  const [ledgerInitialAccountId, setLedgerInitialAccountId] = useState<string | null>(null);
  const [reportRefreshEpoch, setReportRefreshEpoch] = useState(0);

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

  const backToReports = () => setView('reports');
  const backFromReportsHub = () => {
    if (initialView === 'reports') {
      onBack();
    } else {
      setView('dashboard');
    }
  };

  const openReport = (
    key: LegacyReportKey,
    opts?: { accountId?: string | null; partyId?: string | null; partyName?: string | null },
  ) => {
    if (opts?.accountId) setLedgerInitialAccountId(opts.accountId);
    else setLedgerInitialAccountId(null);
    setView(key as View);
  };

  if (view === 'dashboard') {
    return (
      <div className="min-h-screen pb-24 bg-[#111827]">
        <div className="bg-gradient-to-br from-[#8B5CF6] to-[#7C3AED] p-4 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="font-semibold text-white">Accounts</h1>
              <p className="text-xs text-white/80">Financial control center</p>
            </div>
          </div>
        </div>

        <div className="p-4">
          <AccountsDashboard
            user={user}
            companyId={companyId}
            branchId={branch?.id}
            onGeneralEntry={() => setView('general-entry')}
            onAccountTransfer={() => setView('account-transfer')}
            onSupplierPayment={() => setView('supplier-payment')}
            onWorkerPayment={() => setView('worker-payment')}
            onExpenseEntry={() => setView('expense-entry')}
            onViewReports={() => setView('reports')}
            onChartOfAccounts={() => setView('chart')}
            onEntryClick={(entry) => {
              setSelectedEntry(entry);
              setView('entry-detail');
            }}
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

  if (view === 'reports') {
    return (
      <ReportsHub
        key={`reports-hub-${reportRefreshEpoch}`}
        onBack={backFromReportsHub}
        onOpenReport={openReport}
        companyId={companyId ?? null}
        branchId={branch?.id ?? null}
        onNavigateToDocumentEdit={onNavigateToDocumentEdit}
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
        onBack={backToReports}
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
    return <AgingReport key={`payables-${reportRefreshEpoch}`} onBack={backToReports} kind="payables" companyId={companyId ?? null} branchId={branch?.id ?? null} user={user} />;
  }
  if (view === 'receivables') {
    return <AgingReport key={`receivables-${reportRefreshEpoch}`} onBack={backToReports} kind="receivables" companyId={companyId ?? null} branchId={branch?.id ?? null} user={user} />;
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
