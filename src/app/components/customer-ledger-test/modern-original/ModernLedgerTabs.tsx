import { useState } from 'react';
import { LayoutGrid, List, FileText, DollarSign, Clock } from 'lucide-react';
import { OverviewTab } from './tabs/OverviewTab';
import { TransactionsTab } from './tabs/TransactionsTab';
import { InvoicesTab } from './tabs/InvoicesTab';
import { PaymentsTab } from './tabs/PaymentsTab';
import { AgingReportTab } from './tabs/AgingReportTab';
import type { LedgerData, Transaction } from '@/app/services/customerLedgerTypes';

export interface LedgerTabLabels {
  /** First data tab: Invoices (customer), Purchases (supplier), Expenses (user), Jobs (worker) */
  dataTabLabel?: string;
  /** Aging tab description: Receivables aging vs Payables aging */
  agingDescription?: string;
}

interface ModernLedgerTabsProps {
  ledgerData: LedgerData;
  saleItemsMap?: Map<string, any[]>;
  studioDetailsMap?: Map<string, { notes?: string; productionStatus?: string }>;
  onTransactionClick: (transaction: Transaction) => void;
  accountName?: string;
  dateRange?: { from: string; to: string };
  tabLabels?: LedgerTabLabels;
}

export function ModernLedgerTabs({ ledgerData, saleItemsMap = new Map(), studioDetailsMap = new Map(), onTransactionClick, accountName = '', dateRange, tabLabels }: ModernLedgerTabsProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'transactions' | 'invoices' | 'payments' | 'aging'>('overview');

  const dataLabel = tabLabels?.dataTabLabel ?? 'Invoices';
  const agingDesc = tabLabels?.agingDescription ?? 'Receivables aging';

  const tabs = [
    { id: 'overview', label: 'Overview', icon: LayoutGrid, description: 'Account summary' },
    { id: 'transactions', label: 'All Transactions', icon: List, description: `${ledgerData.transactions.length} entries` },
    { id: 'invoices', label: dataLabel, icon: FileText, description: `${ledgerData.invoices.length} ${dataLabel.toLowerCase()}` },
    { id: 'payments', label: 'Payments', icon: DollarSign, description: 'Payment history' },
    { id: 'aging', label: 'Aging Report', icon: Clock, description: agingDesc },
  ];

  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
      {/* Tab Headers – same style as Products table header (text-xs font-semibold text-gray-500 uppercase) */}
      <div className="border-b border-gray-800 bg-gray-950/95 backdrop-blur-sm">
        <div className="flex gap-0 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center gap-3 px-6 py-4 transition-all whitespace-nowrap border-b-2 ${
                  isActive ? 'border-blue-500 bg-blue-500/10 text-blue-500' : 'border-transparent text-gray-300 hover:bg-gray-800/30'
                }`}
              >
                <Icon className="w-5 h-5" />
                <div className="text-left">
                  <div className={`text-sm font-medium ${isActive ? 'text-blue-500' : 'text-white'}`}>
                    {tab.label}
                  </div>
                  <div className="text-xs text-gray-500">
                    {tab.description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content – same padding as Products table area */}
      <div className="p-6">
        {activeTab === 'overview' && (
          <OverviewTab ledgerData={ledgerData} onTransactionClick={onTransactionClick} />
        )}
        {activeTab === 'transactions' && (
          <TransactionsTab
            transactions={ledgerData.transactions}
            saleItemsMap={saleItemsMap}
            studioDetailsMap={studioDetailsMap}
            onTransactionClick={onTransactionClick}
            openingBalance={ledgerData.openingBalance}
            accountName={accountName}
            dateRange={dateRange}
          />
        )}
        {activeTab === 'invoices' && (
          <InvoicesTab invoices={ledgerData.invoices || []} />
        )}
        {activeTab === 'payments' && (
          <PaymentsTab transactions={ledgerData.transactions} onTransactionClick={onTransactionClick} />
        )}
        {activeTab === 'aging' && (
          <AgingReportTab invoices={ledgerData.invoices || []} />
        )}
      </div>
    </div>
  );
}
