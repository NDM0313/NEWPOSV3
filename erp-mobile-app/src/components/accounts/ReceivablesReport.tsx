import { useState, useEffect } from 'react';
import { ArrowLeft, Loader2, Receipt, Share2, FileDown, X } from 'lucide-react';
import * as reportsApi from '../../api/reports';

interface ReceivablesReportProps {
  onBack: () => void;
  companyId: string | null;
  branchId: string | null;
}

function formatDisplayDate(iso: string): string {
  if (!iso || iso === '—') return iso;
  try {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}

export function ReceivablesReport({ onBack, companyId, branchId }: ReceivablesReportProps) {
  const [total, setTotal] = useState(0);
  const [list, setList] = useState<reportsApi.ReceivableItem[]>([]);
  const [loading, setLoading] = useState(!!companyId);
  const [selectedInv, setSelectedInv] = useState<reportsApi.ReceivableItem | null>(null);

  useEffect(() => {
    if (!companyId) {
      setTotal(0);
      setList([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.all([
      reportsApi.getReceivables(companyId, branchId),
      reportsApi.getReceivablesList(companyId, branchId),
    ]).then(([totRes, listRes]) => {
      if (cancelled) return;
      setLoading(false);
      setTotal(totRes.error ? 0 : totRes.data ?? 0);
      setList(listRes.error ? [] : listRes.data ?? []);
    });
    return () => { cancelled = true; };
  }, [companyId, branchId]);

  const handleShare = () => {
    const text = `Receivables: Rs. ${total.toLocaleString()} · ${list.length} invoice(s) with balance.`;
    if (navigator.share) {
      navigator.share({ title: 'Receivables Report', text }).catch(() => {});
    }
  };

  const handlePrint = () => {
    window.print?.();
  };

  return (
    <div className="min-h-screen bg-[#111827] pb-24">
      <div className="bg-gradient-to-br from-[#8B5CF6] to-[#7C3AED] p-4 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-lg text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold text-white">Receivables</h1>
            <p className="text-xs text-white/80">Outstanding from customers</p>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={handleShare} className="p-2 hover:bg-white/10 rounded-lg text-white" title="Share">
              <Share2 className="w-5 h-5" />
            </button>
            <button onClick={handlePrint} className="p-2 hover:bg-white/10 rounded-lg text-white" title="Export / Print">
              <FileDown className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
      <div className="p-4 space-y-4">
        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-5 flex items-center gap-4">
          <div className="w-14 h-14 bg-[#8B5CF6]/20 rounded-xl flex items-center justify-center">
            <Receipt className="w-8 h-8 text-[#8B5CF6]" />
          </div>
          <div>
            <p className="text-sm text-[#9CA3AF]">Total Due (Receivables)</p>
            <p className="text-2xl font-bold text-white">Rs. {total.toLocaleString()}</p>
            <p className="text-xs text-[#6B7280]">{list.length} invoice(s) with balance</p>
          </div>
        </div>
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-[#8B5CF6] animate-spin" />
          </div>
        ) : (
          <div className="space-y-2">
            <h2 className="text-sm font-medium text-[#9CA3AF]">Invoices with due amount</h2>
            {list.map((inv) => {
              const paidAmount = inv.total - inv.due_amount;
              return (
                <button
                  key={inv.id}
                  type="button"
                  onClick={() => setSelectedInv(inv)}
                  className="w-full text-left bg-[#1F2937] border border-[#374151] rounded-xl p-4 flex justify-between items-start hover:border-[#8B5CF6]/50 active:bg-[#374151]/50 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white">{inv.invoice_no}</p>
                    <p className="text-xs text-[#9CA3AF] truncate">{inv.customer_name}</p>
                    <p className="text-xs text-[#6B7280]">{formatDisplayDate(inv.invoice_date)} · Total: Rs. {inv.total.toLocaleString()}</p>
                    {paidAmount > 0 && (
                      <p className="text-xs text-[#10B981] mt-0.5">Paid: Rs. {paidAmount.toLocaleString()}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <span className="font-semibold text-[#8B5CF6] block">Rs. {inv.due_amount.toLocaleString()}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      inv.payment_status === 'partial' ? 'bg-[#F59E0B]/20 text-[#F59E0B]' : 'bg-[#EF4444]/20 text-[#EF4444]'
                    }`}>
                      {inv.payment_status}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
        {!loading && list.length === 0 && (
          <div className="text-center py-12 text-[#9CA3AF]">
            <Receipt className="w-16 h-16 mx-auto mb-4 text-[#374151]" />
            <p>No outstanding receivables</p>
          </div>
        )}
      </div>

      {selectedInv && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-[#1F2937] border border-[#374151] rounded-t-2xl sm:rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto">
            <div className="sticky top-0 bg-[#1F2937] border-b border-[#374151] p-4 flex items-center justify-between">
              <h3 className="font-semibold text-white">Invoice detail</h3>
              <button onClick={() => setSelectedInv(null)} className="p-2 hover:bg-[#374151] rounded-lg text-[#9CA3AF]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-[#9CA3AF]">Invoice No</p>
                  <p className="font-medium text-white">{selectedInv.invoice_no}</p>
                </div>
                <div>
                  <p className="text-[#9CA3AF]">Date</p>
                  <p className="text-white">{formatDisplayDate(selectedInv.invoice_date)}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-[#9CA3AF]">Customer</p>
                  <p className="text-white">{selectedInv.customer_name}</p>
                </div>
                <div>
                  <p className="text-[#9CA3AF]">Total</p>
                  <p className="font-semibold text-white">Rs. {selectedInv.total.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[#9CA3AF]">Paid</p>
                  <p className="text-[#10B981]">Rs. {(selectedInv.total - selectedInv.due_amount).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[#9CA3AF]">Due</p>
                  <p className="font-semibold text-[#8B5CF6]">Rs. {selectedInv.due_amount.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[#9CA3AF]">Status</p>
                  <span className={`text-xs px-2 py-1 rounded ${
                    selectedInv.payment_status === 'partial' ? 'bg-[#F59E0B]/20 text-[#F59E0B]' : 'bg-[#EF4444]/20 text-[#EF4444]'
                  }`}>
                    {selectedInv.payment_status}
                  </span>
                </div>
              </div>
              <p className="text-xs text-[#6B7280]">View in Sales → Invoice for payment history and to record payments.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
