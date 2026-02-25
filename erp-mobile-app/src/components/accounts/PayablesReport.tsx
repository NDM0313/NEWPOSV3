import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Loader2, ChevronRight, FileText } from 'lucide-react';
import * as accountsApi from '../../api/accounts';

interface PayablesReportProps {
  onBack: () => void;
  companyId: string | null;
}

export function PayablesReport({ onBack, companyId }: PayablesReportProps) {
  const [suppliers, setSuppliers] = useState<accountsApi.SupplierWithPayable[]>([]);
  const [loading, setLoading] = useState(!!companyId);
  const [selectedSupplier, setSelectedSupplier] = useState<accountsApi.SupplierWithPayable | null>(null);
  const [purchases, setPurchases] = useState<accountsApi.PurchaseWithDue[]>([]);
  const [purchasesLoading, setPurchasesLoading] = useState(false);

  useEffect(() => {
    if (!companyId) {
      setSuppliers([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    accountsApi.getSuppliersWithPayable(companyId).then(({ data, error }) => {
      if (cancelled) return;
      setLoading(false);
      setSuppliers(error ? [] : data || []);
    });
    return () => { cancelled = true; };
  }, [companyId]);

  const loadPurchases = useCallback(() => {
    if (!companyId || !selectedSupplier) return;
    setPurchasesLoading(true);
    accountsApi.getPurchasesBySupplier(companyId, selectedSupplier.id).then(({ data, error }) => {
      setPurchasesLoading(false);
      setPurchases(error ? [] : data || []);
    });
  }, [companyId, selectedSupplier]);

  useEffect(() => {
    if (selectedSupplier) loadPurchases();
  }, [selectedSupplier, loadPurchases]);

  const totalPayable = suppliers.reduce((s, x) => s + x.totalPayable, 0);

  if (selectedSupplier) {
    const unpaidTotal = purchases.reduce((s, p) => s + p.due_amount, 0);
    return (
      <div className="min-h-screen bg-[#111827] pb-24">
        <div className="bg-[#1F2937] border-b border-[#374151] sticky top-0 z-40">
          <div className="flex items-center gap-3 px-4 h-14">
            <button onClick={() => setSelectedSupplier(null)} className="p-2 hover:bg-[#374151] rounded-lg text-white">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="font-semibold text-base text-white truncate">{selectedSupplier.name}</h1>
              <p className="text-xs text-[#9CA3AF]">Outstanding purchases</p>
            </div>
          </div>
        </div>
        <div className="p-4 space-y-4">
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <p className="text-xs text-[#9CA3AF] mb-1">Total Outstanding</p>
            <p className="text-xl font-bold text-[#F59E0B]">Rs. {(selectedSupplier.totalPayable ?? unpaidTotal).toLocaleString()}</p>
            {selectedSupplier.phone ? (
              <p className="text-sm text-[#9CA3AF] mt-1">{selectedSupplier.phone}</p>
            ) : null}
          </div>
          <h2 className="text-sm font-medium text-[#9CA3AF] flex items-center gap-2">
            <FileText size={16} />
            Invoices with due amount
          </h2>
          {purchasesLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 text-[#F59E0B] animate-spin" />
            </div>
          ) : purchases.length === 0 ? (
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-6 text-center">
              <p className="text-[#9CA3AF] text-sm">No outstanding purchases</p>
            </div>
          ) : (
            <div className="space-y-2">
              {purchases.map((p) => (
                <div
                  key={p.id}
                  className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 flex justify-between items-center"
                >
                  <div>
                    <p className="text-sm font-medium text-white">{p.po_no}</p>
                    <p className="text-xs text-[#9CA3AF]">{p.po_date}</p>
                    <p className="text-xs text-[#6B7280]">Total: Rs. {p.total.toLocaleString()}</p>
                  </div>
                  <span className="font-semibold text-[#F59E0B]">Rs. {p.due_amount.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-[#6B7280] text-center">
            To pay: go to Accounts → Supplier Payment
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#111827] pb-24">
      <div className="bg-gradient-to-br from-[#F59E0B] to-[#D97706] p-4 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-lg text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-semibold text-white">Payables</h1>
            <p className="text-xs text-white/80">Outstanding payables by supplier</p>
          </div>
        </div>
      </div>
      <div className="p-4 space-y-4">
        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-5">
          <p className="text-sm text-[#9CA3AF]">Total Outstanding</p>
          <p className="text-2xl font-bold text-[#F59E0B]">Rs. {totalPayable.toLocaleString()}</p>
          <p className="text-xs text-[#6B7280]">{suppliers.length} supplier(s) with balance</p>
        </div>
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-[#F59E0B] animate-spin" />
          </div>
        ) : (
          <div className="space-y-2">
            <h2 className="text-sm font-medium text-[#9CA3AF]">Suppliers</h2>
            {suppliers.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedSupplier(s)}
                className="w-full bg-[#1F2937] border border-[#374151] rounded-xl p-4 text-left hover:border-[#F59E0B] transition-colors flex items-center justify-between"
              >
                <div>
                  <p className="font-medium text-white">{s.name}</p>
                  {s.phone ? <p className="text-xs text-[#9CA3AF]">{s.phone}</p> : null}
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[#F59E0B]">Rs. {s.totalPayable.toLocaleString()}</span>
                  <ChevronRight className="w-5 h-5 text-[#6B7280]" />
                </div>
              </button>
            ))}
          </div>
        )}
        {!loading && suppliers.length === 0 && (
          <div className="text-center py-12 text-[#9CA3AF]">
            <FileText className="w-16 h-16 mx-auto mb-4 text-[#374151]" />
            <p>No outstanding payables</p>
          </div>
        )}
      </div>
    </div>
  );
}
