import { useState } from 'react';
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

interface AccountsModuleProps {
  onBack: () => void;
  user: User;
  companyId?: string | null;
  branch?: { id: string; name: string; location: string } | null;
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
  | 'entry-detail';

export function AccountsModule({ onBack, user, companyId, branch }: AccountsModuleProps) {
  const [view, setView] = useState<View>('dashboard');
  const [selectedEntry, setSelectedEntry] = useState<AccountEntry | null>(null);

  // Dashboard View
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
      <GeneralEntryFlow
        onBack={() => setView('dashboard')}
        onComplete={() => setView('dashboard')}
        user={user}
        companyId={companyId}
        branchId={branch?.id}
      />
    );
  }

  if (view === 'account-transfer') {
    return (
      <AccountTransferFlow
        onBack={() => setView('dashboard')}
        onComplete={() => setView('dashboard')}
        user={user}
        companyId={companyId}
        branchId={branch?.id}
      />
    );
  }

  if (view === 'supplier-payment') {
    return (
      <SupplierPaymentFlow
        onBack={() => setView('dashboard')}
        onComplete={() => setView('dashboard')}
        user={user}
        companyId={companyId}
        branchId={branch?.id}
      />
    );
  }

  if (view === 'worker-payment') {
    return (
      <WorkerPaymentFlow
        onBack={() => setView('dashboard')}
        onComplete={() => setView('dashboard')}
        user={user}
        companyId={companyId}
      />
    );
  }

  if (view === 'expense-entry') {
    return (
      <ExpenseEntryFlow
        onBack={() => setView('dashboard')}
        onComplete={() => setView('dashboard')}
        user={user}
        companyId={companyId}
        branchId={branch?.id}
      />
    );
  }

  if (view === 'chart') {
    return (
      <ChartOfAccountsView
        onBack={() => setView('dashboard')}
        onAddAccount={() => setView('add-account')}
        companyId={companyId ?? null}
      />
    );
  }

  if (view === 'add-account') {
    return (
      <AddAccountForm
        companyId={companyId ?? null}
        onBack={() => setView('chart')}
        onSuccess={() => setView('chart')}
      />
    );
  }

  if (view === 'reports') {
    return (
      <div className="min-h-screen pb-24 bg-[#111827]">
        <div className="bg-gradient-to-br from-[#6366F1] to-[#4F46E5] p-4 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button onClick={() => setView('dashboard')} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="font-semibold text-white">Account Reports</h1>
              <p className="text-xs text-white/80">View financial reports</p>
            </div>
          </div>
        </div>

        <div className="p-4">
          <div className="grid grid-cols-2 gap-3">
            <ReportCard title="Account Ledger" description="View account-wise ledger" icon="📚" onClick={() => alert('Account Ledger - Coming Soon')} />
            <ReportCard title="Day Book" description="Daily transaction log" icon="📅" onClick={() => alert('Day Book - Coming Soon')} />
            <ReportCard title="Cash Summary" description="Cash account summary" icon="💵" onClick={() => alert('Cash Summary - Coming Soon')} />
            <ReportCard title="Bank Summary" description="Bank accounts summary" icon="🏦" onClick={() => alert('Bank Summary - Coming Soon')} />
            <ReportCard title="Payables" description="Outstanding payables" icon="📤" onClick={() => alert('Payables Report - Coming Soon')} />
            <ReportCard title="Receivables" description="Outstanding receivables" icon="📥" onClick={() => alert('Receivables Report - Coming Soon')} />
          </div>
        </div>
      </div>
    );
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

    return (
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
        </div>
      </div>
    );
  }

  return null;
}

interface ReportCardProps {
  title: string;
  description: string;
  icon: string;
  onClick: () => void;
}

function ReportCard({ title, description, icon, onClick }: ReportCardProps) {
  return (
    <button onClick={onClick} className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 hover:border-[#6366F1] transition-all text-left">
      <span className="text-3xl block mb-2">{icon}</span>
      <h3 className="text-sm font-semibold text-white mb-1">{title}</h3>
      <p className="text-xs text-[#9CA3AF]">{description}</p>
    </button>
  );
}
