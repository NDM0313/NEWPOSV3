'use client';

import React, { useState } from 'react';
import { AccountLedgerEntry } from '@/app/services/accountingService';
import { SummaryLedgerTable } from './SummaryLedgerTable';
import { DetailLedgerTable } from './DetailLedgerTable';
import { ItemPurchaseTable } from './ItemPurchaseTable';

interface LedgerTabsProps {
  ledgerEntries: AccountLedgerEntry[];
  loading: boolean;
  onReferenceClick: (entry: AccountLedgerEntry) => void;
  companyId: string;
  customerId: string;
}

export const LedgerTabs: React.FC<LedgerTabsProps> = ({
  ledgerEntries,
  loading,
  onReferenceClick,
  companyId,
  customerId,
}) => {
  const [activeTab, setActiveTab] = useState<'summary' | 'detail' | 'items'>('summary');

  return (
    <div className="flex flex-col h-full bg-input-background">
      {/* Tab Headers */}
      <div className="flex border-b border-border bg-card">
        <button
          onClick={() => setActiveTab('summary')}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'summary'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-muted-foreground hover:text-muted-foreground'
          }`}
        >
          Summary Ledger
        </button>
        <button
          onClick={() => setActiveTab('detail')}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'detail'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-muted-foreground hover:text-muted-foreground'
          }`}
        >
          Detail Ledger
        </button>
        <button
          onClick={() => setActiveTab('items')}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'items'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-muted-foreground hover:text-muted-foreground'
          }`}
        >
          Item Purchase Detail
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Loading ledger...
          </div>
        ) : activeTab === 'summary' ? (
          <SummaryLedgerTable
            entries={ledgerEntries}
            onReferenceClick={onReferenceClick}
          />
        ) : activeTab === 'detail' ? (
          <DetailLedgerTable
            entries={ledgerEntries}
            onReferenceClick={onReferenceClick}
          />
        ) : (
          <ItemPurchaseTable
            entries={ledgerEntries}
            companyId={companyId}
            customerId={customerId}
          />
        )}
      </div>
    </div>
  );
};
