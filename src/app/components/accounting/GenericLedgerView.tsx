/**
 * Same UI as Customer Ledger (summary cards + tabs) for Supplier, User, Worker.
 * Data from ledgerDataAdapters; labels per type: Purchases/Expenses/Jobs, Payments, Aging (Payables).
 */

import { useState, useEffect, useCallback } from 'react';
import { useSupabase } from '@/app/context/SupabaseContext';
import { ModernDateFilter } from '@/app/components/customer-ledger-test/modern-original/ModernDateFilter';
import { getTodayYYYYMMDD } from '@/app/components/ui/utils';
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
import { RefreshCw, Banknote } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { UnifiedPaymentDialog } from '@/app/components/shared/UnifiedPaymentDialog';

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
  const [dateRange, setDateRange] = useState(() => {
    const to = getTodayYYYYMMDD();
    const fromD = new Date(to + 'T12:00:00');
    fromD.setDate(fromD.getDate() - 30);
    const from = fromD.toISOString().split('T')[0];
    return { from, to };
  });
  const [ledgerData, setLedgerData] = useState<LedgerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [workerPaymentDialogOpen, setWorkerPaymentDialogOpen] = useState(false);

  // Load ledger data
  const loadLedger = useCallback(async () => {
    if (!companyId || !entityId) {
      setLedgerData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data =
        ledgerType === 'supplier'
          ? await getSupplierLedgerData(companyId, entityId, entityName, dateRange.from, dateRange.to)
          : ledgerType === 'user'
            ? await getUserLedgerData(companyId, entityId, entityName, dateRange.from, dateRange.to)
            : await getWorkerLedgerData(companyId, entityId, entityName, dateRange.from, dateRange.to);
      setLedgerData(data);
    } catch (e: any) {
      console.error('[GenericLedgerView]', e);
      toast.error(e?.message || 'Failed to load ledger');
    } finally {
      setLoading(false);
    }
  }, [companyId, entityId, entityName, ledgerType, dateRange.from, dateRange.to]);

  useEffect(() => {
    loadLedger();
  }, [loadLedger]);

  // CRITICAL: Listen for ledger-updating events to refresh (same pattern as customer ledger)
  useEffect(() => {
    const handlePurchaseDelete = () => {
      if (ledgerType === 'supplier') loadLedger();
    };
    const handleSaleDelete = () => {
      if (ledgerType === 'supplier') loadLedger();
    };
    const handleLedgerUpdated = (e: CustomEvent<{ ledgerType?: string; entityId?: string }>) => {
      const d = e?.detail;
      if (!d || d.ledgerType !== ledgerType) return;
      if (d.entityId && d.entityId !== entityId) return;
      loadLedger();
    };
    const handleStudioProductionSaved = () => {
      if (ledgerType === 'worker') loadLedger();
    };
    const handlePurchaseSaved = () => {
      if (ledgerType === 'supplier') loadLedger();
    };
    const handlePaymentAdded = () => {
      if (ledgerType === 'supplier' || ledgerType === 'worker') loadLedger();
    };

    window.addEventListener('purchaseDeleted', handlePurchaseDelete);
    window.addEventListener('saleDeleted', handleSaleDelete);
    window.addEventListener('ledgerUpdated', handleLedgerUpdated as EventListener);
    window.addEventListener('studio-production-saved', handleStudioProductionSaved);
    window.addEventListener('purchaseSaved', handlePurchaseSaved);
    window.addEventListener('paymentAdded', handlePaymentAdded);

    return () => {
      window.removeEventListener('purchaseDeleted', handlePurchaseDelete);
      window.removeEventListener('saleDeleted', handleSaleDelete);
      window.removeEventListener('ledgerUpdated', handleLedgerUpdated as EventListener);
      window.removeEventListener('studio-production-saved', handleStudioProductionSaved);
      window.removeEventListener('purchaseSaved', handlePurchaseSaved);
      window.removeEventListener('paymentAdded', handlePaymentAdded);
    };
  }, [loadLedger, ledgerType, entityId]);

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
      <div className="flex items-center gap-4 flex-wrap">
        <ModernDateFilter dateRange={dateRange} onApply={setDateRange} />
        <button
          onClick={() => loadLedger()}
          disabled={loading}
          className="p-3 rounded-lg transition-colors flex items-center justify-center bg-gray-900 border border-gray-700 text-gray-400 hover:bg-gray-800 hover:text-white disabled:opacity-50"
          title="Refresh ledger"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
        {ledgerType === 'worker' && (
          <Button
            onClick={() => setWorkerPaymentDialogOpen(true)}
            className="bg-green-600 hover:bg-green-500 text-white"
          >
            <Banknote className="w-4 h-4 mr-2" />
            Pay Worker
          </Button>
        )}
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
      {ledgerType === 'worker' && (
        <UnifiedPaymentDialog
          isOpen={workerPaymentDialogOpen}
          onClose={() => setWorkerPaymentDialogOpen(false)}
          context="worker"
          entityName={entityName}
          entityId={entityId}
          outstandingAmount={ledgerDataForViews?.invoicesSummary?.pendingAmount ?? 0}
          onSuccess={() => {
            setWorkerPaymentDialogOpen(false);
            loadLedger();
          }}
        />
      )}
    </div>
  );
}
