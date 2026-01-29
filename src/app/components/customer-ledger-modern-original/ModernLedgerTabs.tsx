import { useState } from 'react';
import { LayoutGrid, List, FileText, DollarSign, Clock } from 'lucide-react';
import { OverviewTab } from './tabs/OverviewTab';
import { TransactionsTab } from './tabs/TransactionsTab';
import { InvoicesTab } from './tabs/InvoicesTab';
import { PaymentsTab } from './tabs/PaymentsTab';
import { AgingReportTab } from './tabs/AgingReportTab';
import type { LedgerData, Transaction } from '../../types';

interface ModernLedgerTabsProps {
  ledgerData: LedgerData;
  onTransactionClick: (transaction: Transaction) => void;
}

export function ModernLedgerTabs({ ledgerData, onTransactionClick }: ModernLedgerTabsProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'transactions' | 'invoices' | 'payments' | 'aging'>('overview');

  const tabs = [
    { 
      id: 'overview', 
      label: 'Overview', 
      icon: LayoutGrid,
      description: 'Account summary'
    },
    { 
      id: 'transactions', 
      label: 'All Transactions', 
      icon: List,
      description: `${ledgerData.transactions.length} entries`
    },
    { 
      id: 'invoices', 
      label: 'Invoices', 
      icon: FileText,
      description: `${ledgerData.invoices.length} invoices`
    },
    { 
      id: 'payments', 
      label: 'Payments', 
      icon: DollarSign,
      description: 'Payment history'
    },
    { 
      id: 'aging', 
      label: 'Aging Report', 
      icon: Clock,
      description: 'Receivables aging'
    },
  ];

  return (
    <div className="rounded-xl shadow-sm overflow-hidden bg-card border border-border">
      {/* Tab Headers – ERP theme */}
      <div className="border-b border-border bg-muted">
        <div className="flex gap-0 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-3 px-6 py-4 transition-all whitespace-nowrap border-b-2 ${
                  isActive ? 'border-primary bg-primary/10' : 'border-transparent hover:bg-accent'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                <div className="text-left">
                  <div className={`text-sm ${isActive ? 'text-primary' : 'text-foreground'}`}>
                    {tab.label}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {tab.description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {activeTab === 'overview' && (
          <OverviewTab ledgerData={ledgerData} onTransactionClick={onTransactionClick} />
        )}
        {activeTab === 'transactions' && (
          <TransactionsTab transactions={ledgerData.transactions} onTransactionClick={onTransactionClick} />
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
