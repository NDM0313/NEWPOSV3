/**
 * Same UI as Customer Ledger (summary cards + tabs) for Supplier, User, Worker.
 * Data from ledgerDataAdapters; labels per type: Purchases/Expenses/Jobs, Payments, Aging (Payables).
 */

import { useState, useEffect } from 'react';
import { useSupabase } from '@/app/context/SupabaseContext';
import { ModernDateFilter } from '@/app/components/customer-ledger-test/modern-original/ModernDateFilter';
import { ModernSummaryCards } from '@/app/components/customer-ledger-test/modern-original/ModernSummaryCards';
import { ModernLedgerTabs } from '@/app/components/customer-ledger-test/modern-original/ModernLedgerTabs';
import { ModernTransactionModal } from '@/app/components/customer-ledger-test/modern-original/ModernTransactionModal';
import { buildTransactionsWithOpeningBalance } from '@/app/services/customerLedgerTypes';
import {
  getSupplierLedgerData,
  getUserLedgerData,
  getWorkerLedgerData,
  type LedgerEntityType,
} from '@/app/services/ledgerDataAdapters';
import type { LedgerData, Transaction } from '@/app/services/customerLedgerTypes';
import { LoadingSpinner } from '@/app/components/shared/LoadingSpinner';
import { toast } from 'sonner';

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

export function GenericLedgerView({ ledgerType, entityId, entityName }: GenericLedgerViewProps) {
  const { companyId } = useSupabase();
  const [dateRange, setDateRange] = useState({ from: '2025-01-01', to: new Date().toISOString().split('T')[0] });
  const [ledgerData, setLedgerData] = useState<LedgerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

  useEffect(() => {
    if (!companyId || !entityId) {
      setLedgerData(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const load = async () => {
      try {
        const data =
          ledgerType === 'supplier'
            ? await getSupplierLedgerData(companyId, entityId, entityName, dateRange.from, dateRange.to)
            : ledgerType === 'user'
              ? await getUserLedgerData(companyId, entityId, entityName, dateRange.from, dateRange.to)
              : await getWorkerLedgerData(companyId, entityId, entityName, dateRange.from, dateRange.to);
        if (!cancelled) setLedgerData(data);
      } catch (e: any) {
        if (!cancelled) {
          console.error('[GenericLedgerView]', e);
          toast.error(e?.message || 'Failed to load ledger');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [companyId, ledgerType, entityId, entityName, dateRange.from, dateRange.to]);

  const displayTransactions = ledgerData
    ? buildTransactionsWithOpeningBalance(ledgerData.openingBalance, ledgerData.transactions, dateRange.from)
    : [];
  const ledgerDataForViews = ledgerData
    ? { ...ledgerData, transactions: displayTransactions }
    : null;
  const labels = TAB_LABELS[ledgerType];

  if (loading && !ledgerData) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  if (!ledgerDataForViews) {
    return (
      <div className="py-8 text-center text-gray-400 text-sm">
        No ledger data. Select an entity above.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <ModernDateFilter dateRange={dateRange} onApply={setDateRange} />
      </div>
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
      {selectedTransaction && (
        <ModernTransactionModal
          transaction={selectedTransaction}
          onClose={() => setSelectedTransaction(null)}
        />
      )}
    </div>
  );
}
