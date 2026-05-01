import { useState } from 'react';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import {
  allowsDayBookUnifiedEdit,
  getMobileSalePurchaseOpenTarget,
} from '../../lib/journalEntryEditPolicy';
import type { User } from '../../types';
import { AccountsDashboard, type AccountEntry } from './AccountsDashboard';
import { GeneralEntryFlow } from './GeneralEntryFlow';
import { AccountTransferFlow } from './AccountTransferFlow';
import { SupplierPaymentFlow } from './SupplierPaymentFlow';
import { WorkerPaymentFlow } from './WorkerPaymentFlow';
import { ExpenseEntryFlow } from './ExpenseEntryFlow';
import { ChartOfAccountsView } from './ChartOfAccountsView';
import { AddAccountForm } from './AddAccountForm';
import { EntryEditSheet } from './EntryEditSheet';
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
  const [editSheetOpen, setEditSheetOpen] = useState(false);

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
    return <ChartOfAccountsView onBack={() => setView('dashboard')} onAddAccount={() => setView('add-account')} companyId={companyId ?? null} />;
  }
  if (view === 'add-account') {
    return <AddAccountForm companyId={companyId ?? null} onBack={() => setView('chart')} onSuccess={() => setView('chart')} />;
  }

  if (view === 'reports') {
    return (
      <ReportsHub
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
        onBack={backToReports}
        kind="worker"
        companyId={companyId ?? null}
        branchId={branch?.id ?? null}
        user={user}
      />
    );
  }
  if (view === 'daybook') {
    return <DayBookReport onBack={backToReports} companyId={companyId ?? null} branchId={branch?.id ?? null} user={user} />;
  }
  if (view === 'cash-summary') {
    return (
      <AccountSummaryReport
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
    return <AgingReport onBack={backToReports} kind="payables" companyId={companyId ?? null} branchId={branch?.id ?? null} user={user} />;
  }
  if (view === 'receivables') {
    return <AgingReport onBack={backToReports} kind="receivables" companyId={companyId ?? null} branchId={branch?.id ?? null} user={user} />;
  }
  if (view === 'sales-report') {
    return <SalesReport onBack={backToReports} companyId={companyId ?? null} branchId={branch?.id ?? null} user={user} />;
  }
  if (view === 'studio-sales') {
    return <SalesReport onBack={backToReports} companyId={companyId ?? null} branchId={branch?.id ?? null} user={user} isStudio />;
  }
  if (view === 'purchase-report') {
    return <PurchaseReport onBack={backToReports} companyId={companyId ?? null} branchId={branch?.id ?? null} user={user} />;
  }
  if (view === 'expense-report') {
    return <ExpenseReport onBack={backToReports} companyId={companyId ?? null} branchId={branch?.id ?? null} user={user} />;
  }
  if (view === 'studio-report') {
    return <StudioReport onBack={backToReports} companyId={companyId ?? null} user={user} />;
  }
  if (view === 'rental-report') {
    return <RentalReport onBack={backToReports} companyId={companyId ?? null} user={user} />;
  }
  if (view === 'inventory-report') {
    return <InventoryReport onBack={backToReports} companyId={companyId ?? null} user={user} />;
  }

  if (view === 'entry-detail' && selectedEntry) {
    const getEntryTypeConfig = (type: AccountEntry['type']) => {
      switch (type) {
        case 'general':
          return { label: 'General Entry', color: 'from-[#8B5CF6] to-[#7C3AED]' };
        case 'transfer':
          return { label: 'Account Transfer', color: 'from-[#3B82F6] to-[#2563EB]' };
        case 'supplier-payment':
          return { label: 'Supplier Payment', color: 'from-[#F59E0B] to-[#D97706]' };
        case 'worker-payment':
          return { label: 'Worker Payment', color: 'from-[#10B981] to-[#059669]' };
        case 'expense':
          return { label: 'Expense Entry', color: 'from-[#EF4444] to-[#DC2626]' };
      }
    };

    const typeConfig = getEntryTypeConfig(selectedEntry.type);

    const canEditFromAccounts = allowsDayBookUnifiedEdit(
      selectedEntry.referenceType,
      selectedEntry.paymentId ?? null,
    );
    const salePurchaseTarget = getMobileSalePurchaseOpenTarget(
      selectedEntry.referenceType,
      selectedEntry.referenceId ?? null,
      selectedEntry.paymentId ?? null,
    );

    return (
      <>
        <div className="min-h-screen pb-24 bg-[#111827]">
        <div className={`bg-gradient-to-br ${typeConfig.color} p-4 sticky top-0 z-10`}>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setView('dashboard');
                setSelectedEntry(null);
              }}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="font-semibold text-white">{selectedEntry.entryNumber}</h1>
              <p className="text-xs text-white/80">{typeConfig.label}</p>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-4">
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <h2 className="text-sm font-semibold text-white mb-4">Entry Details</h2>
            <div className="space-y-3">
              <div className="flex justify-between pb-3 border-b border-[#374151]">
                <span className="text-sm text-[#9CA3AF]">Entry Number</span>
                <span className="text-sm text-white font-medium">{selectedEntry.entryNumber}</span>
              </div>
              <div className="flex justify-between pb-3 border-b border-[#374151]">
                <span className="text-sm text-[#9CA3AF]">Type</span>
                <span className="text-sm text-white font-medium">{typeConfig.label}</span>
              </div>
              <div className="flex justify-between pb-3 border-b border-[#374151]">
                <span className="text-sm text-[#9CA3AF]">Date</span>
                <span className="text-sm text-white">{selectedEntry.date}</span>
              </div>
              <div className="pb-3 border-b border-[#374151]">
                <p className="text-sm text-[#9CA3AF] mb-1">Description</p>
                <p className="text-sm text-white">{selectedEntry.description}</p>
              </div>
              <div className="flex justify-between pb-3 border-b border-[#374151]">
                <span className="text-sm text-[#9CA3AF]">Amount</span>
                <span className="text-lg text-white font-bold">Rs. {selectedEntry.amount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between pb-3 border-b border-[#374151]">
                <span className="text-sm text-[#9CA3AF]">Status</span>
                <span className="px-2 py-1 bg-[#10B981]/20 text-[#10B981] rounded text-xs font-medium capitalize">{selectedEntry.status}</span>
              </div>
            </div>
          </div>

          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <h2 className="text-sm font-semibold text-white mb-4">Accounting Details</h2>
            <div className="space-y-3">
              <div className="p-3 bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-lg">
                <p className="text-xs text-[#9CA3AF] mb-1">Debit Account</p>
                <p className="text-sm text-white font-semibold">{selectedEntry.debitAccount}</p>
              </div>
              <div className="p-3 bg-[#10B981]/10 border border-[#10B981]/30 rounded-lg">
                <p className="text-xs text-[#9CA3AF] mb-1">Credit Account</p>
                <p className="text-sm text-white font-semibold">{selectedEntry.creditAccount}</p>
              </div>
            </div>
          </div>

            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
              <h2 className="text-sm font-semibold text-white mb-4">Audit Trail</h2>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-[#8B5CF6] to-[#7C3AED] rounded-full flex items-center justify-center">
                  <span className="text-white font-bold">{selectedEntry.addedBy.split(' ').map((n) => n[0]).join('')}</span>
                </div>
                <div className="flex-1">
                  <p className="text-xs text-[#9CA3AF]">Added By</p>
                  <p className="text-sm font-semibold text-white">{selectedEntry.addedBy}</p>
                  <p className="text-xs text-[#6B7280]">{selectedEntry.addedByRole}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-[#9CA3AF]">Created At</p>
                  <p className="text-sm text-white">{selectedEntry.createdAt}</p>
                </div>
              </div>
            </div>

            {canEditFromAccounts ? (
              <button
                type="button"
                onClick={() => setEditSheetOpen(true)}
                className="w-full flex items-center justify-center gap-2 py-3 bg-[#4B5563] hover:bg-[#374151] rounded-lg text-white font-semibold text-sm mt-4"
              >
                Edit Entry
              </button>
            ) : (
              <div className="space-y-3 mt-4">
                <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
                  <p className="text-sm text-white font-medium mb-1">
                    {salePurchaseTarget
                      ? 'Invoices and purchases cannot be edited here — open Sales or Purchases to change the document.'
                      : 'This entry is controlled by its source module (inventory, opening balance, rental, returns, etc.). Edit it there, not from Accounts.'}
                  </p>
                  <p className="text-xs text-amber-100/90 leading-relaxed">
                    {salePurchaseTarget
                      ? 'سیل یا پرچیز یہاں سے ایڈٹ نہیں ہو سکتے — براہ کرم سیلز یا پرچیز سیکشن میں جا کر ڈاکیومنٹ ایڈٹ کریں۔'
                      : 'یہ واؤچر سورس ماڈیول سے کنٹرول ہوتا ہے۔ اسے Accounts سے نہیں، متعلقہ جگہ (سٹاک، اوپننگ، رینٹل، وغیرہ) میں جا کر درست کریں۔'}
                  </p>
                </div>
                {salePurchaseTarget && onNavigateToDocumentEdit ? (
                  <button
                    type="button"
                    onClick={() =>
                      onNavigateToDocumentEdit(salePurchaseTarget.kind, salePurchaseTarget.id)
                    }
                    className="w-full flex items-center justify-center gap-2 py-3 bg-[#6366F1] hover:bg-[#4F46E5] rounded-lg text-white font-semibold text-sm"
                  >
                    <ExternalLink className="w-4 h-4 shrink-0" />
                    {salePurchaseTarget.kind === 'sale' ? 'Open in Sales' : 'Open in Purchase'}
                  </button>
                ) : null}
              </div>
            )}
          </div>
        </div>

        {editSheetOpen && companyId && (
          <EntryEditSheet
            entry={selectedEntry}
            companyId={companyId}
            onClose={() => setEditSheetOpen(false)}
            onSuccess={() => {
              setEditSheetOpen(false);
              // Optimistically set view back to dashboard to refresh
              setView('dashboard');
              setSelectedEntry(null);
            }}
          />
        )}
      </>
    );
  }

  return null;
}
