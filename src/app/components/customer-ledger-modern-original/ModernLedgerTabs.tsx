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
    <div className="rounded-xl shadow-sm overflow-hidden" style={{
      background: '#273548',
      border: '1px solid #334155'
    }}>
      {/* Tab Headers */}
      <div style={{ 
        borderBottom: '1px solid #334155',
        background: 'linear-gradient(90deg, #1e293b 0%, #273548 100%)'
      }}>
        <div className="flex gap-0 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className="flex items-center gap-3 px-6 py-4 transition-all whitespace-nowrap"
                style={{
                  borderBottom: isActive ? '2px solid #3b82f6' : '2px solid transparent',
                  background: isActive ? 'rgba(59, 130, 246, 0.1)' : 'transparent'
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = '#1e293b';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                <Icon className="w-5 h-5" style={{ 
                  color: isActive ? '#3b82f6' : '#94a3b8'
                }} />
                <div className="text-left">
                  <div className="text-sm" style={{ 
                    color: isActive ? '#3b82f6' : '#ffffff'
                  }}>
                    {tab.label}
                  </div>
                  <div className="text-xs" style={{ color: '#94a3b8' }}>
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
