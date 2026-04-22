import { useState, useEffect } from 'react';
import { ArrowLeft, Check, Search } from 'lucide-react';
import type { User } from '../../types';
import {
  getSuppliersWithPayable,
  getPurchasesBySupplier,
  type SupplierWithPayable,
} from '../../api/accounts';
import { UnifiedPaymentSheet } from '../shared/UnifiedPaymentSheet';

interface SupplierPaymentFlowProps {
  onBack: () => void;
  onComplete: () => void;
  user: User;
  companyId?: string | null;
  branchId?: string | null;
  onViewLedger?: (info: { paymentId: string | null; partyName: string | null }) => void;
}

export function SupplierPaymentFlow({ onBack, onComplete, user, companyId, branchId, onViewLedger }: SupplierPaymentFlowProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [suppliers, setSuppliers] = useState<SupplierWithPayable[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierWithPayable | null>(null);

  useEffect(() => {
    if (!companyId) return;
    getSuppliersWithPayable(companyId).then((sRes) => {
      if (sRes.data) setSuppliers(sRes.data.filter((s) => s.totalPayable > 0));
    });
  }, [companyId]);

  const filteredSuppliers = suppliers.filter(
    (s) => s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.phone.includes(searchQuery),
  );

  const [resolvedPurchaseId, setResolvedPurchaseId] = useState<string | null>(null);
  useEffect(() => {
    if (!companyId || !selectedSupplier) { setResolvedPurchaseId(null); return; }
    let cancelled = false;
    getPurchasesBySupplier(companyId, selectedSupplier.id).then(({ data }) => {
      if (cancelled) return;
      setResolvedPurchaseId(data?.[0]?.id ?? null);
    });
    return () => { cancelled = true; };
  }, [companyId, selectedSupplier]);

  if (selectedSupplier && companyId && branchId) {
    if (!resolvedPurchaseId) {
      return (
        <div className="min-h-screen bg-[#111827] flex items-center justify-center">
          <p className="text-[#9CA3AF] text-sm">Loading outstanding purchase…</p>
        </div>
      );
    }
    return (
      <UnifiedPaymentSheet
        kind="purchase"
        referenceId={resolvedPurchaseId}
        referenceNo={selectedSupplier.phone || null}
        companyId={companyId}
        branchId={branchId}
        userId={user.id}
        partyName={selectedSupplier.name}
        partyId={selectedSupplier.id}
        totalAmount={selectedSupplier.totalPayable}
        outstandingAmount={selectedSupplier.totalPayable}
        onClose={() => setSelectedSupplier(null)}
        onSuccess={onComplete}
        onViewLedger={onViewLedger}
      />
    );
  }

  return (
    <div className="min-h-screen pb-40 bg-[#111827]">
      <div className="bg-gradient-to-br from-[#F59E0B] to-[#D97706] p-4 sticky top-0 z-10">
        <div className="flex items-center gap-3 mb-2">
          <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-semibold text-white">Supplier Payment</h1>
            <p className="text-xs text-white/80">Select a supplier to pay</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" size={18} />
          <input
            type="text"
            placeholder="Search suppliers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-[#1F2937] border border-[#374151] rounded-xl text-white placeholder-[#6B7280] focus:outline-none focus:border-[#F59E0B]"
          />
        </div>
        <div className="space-y-2">
          {filteredSuppliers.length === 0 ? (
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-8 text-center">
              <p className="text-sm text-[#9CA3AF]">No suppliers with outstanding balance</p>
            </div>
          ) : (
            filteredSuppliers.map((supplier) => (
              <button
                key={supplier.id}
                onClick={() => setSelectedSupplier(supplier)}
                className="w-full p-4 rounded-xl border-2 text-left transition-all bg-[#1F2937] border-[#374151] hover:border-[#F59E0B]/50"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{supplier.name}</p>
                    <p className="text-xs text-[#9CA3AF] truncate">{supplier.phone}</p>
                  </div>
                  <Check className="text-[#F59E0B] opacity-0" size={20} />
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-[#374151]">
                  <span className="text-xs text-[#9CA3AF]">Outstanding Balance</span>
                  <span className={`text-sm font-bold ${supplier.totalPayable > 0 ? 'text-[#EF4444]' : 'text-[#10B981]'}`}>
                    Rs. {supplier.totalPayable.toLocaleString()}
                  </span>
                </div>
                {supplier.lastPayment && (
                  <p className="text-xs text-[#6B7280] mt-1">Last payment: {supplier.lastPayment}</p>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
