import { CheckCircle2, Share2, FileText, Plus, Home, Printer, List, ArrowLeft } from 'lucide-react';

export type TransactionSuccessType = 'sale' | 'purchase' | 'payment' | 'rental' | 'return' | 'product';

export interface TransactionSuccessData {
  type: TransactionSuccessType;
  /** Display title e.g. "Sale Saved Successfully" */
  title: string;
  /** Transaction number e.g. SL-0023, PUR-0001 */
  transactionNo?: string | null;
  amount?: number | null;
  /** Party name: customer, supplier, etc. */
  partyName?: string | null;
  date?: string | null;
  branch?: string | null;
  /** Entity id for View Details navigation */
  entityId?: string | null;
}

interface TransactionSuccessModalProps {
  isOpen: boolean;
  data: TransactionSuccessData | null;
  onClose: () => void;
  /** Sale: Share Slip, View Invoice, New Sale, Home */
  onShareSlip?: () => void;
  onViewInvoice?: () => void;
  onNewSale?: () => void;
  onHome?: () => void;
  /** Optional: Bluetooth / thermal print (native + plugin). */
  onThermalPrint?: () => void;
  /** Payment: Share Receipt, View Ledger, Back */
  onShareReceipt?: () => void;
  onViewLedger?: () => void;
  onBack?: () => void;
  /** Purchase: View Purchase, Print, Back to List */
  onViewPurchase?: () => void;
  onPrint?: () => void;
  onBackToList?: () => void;
  /** Product: just OK */
  onOk?: () => void;
}

const formatAmount = (n: number) => `Rs. ${Number(n).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatDate = (d: string | null | undefined) => (d ? new Date(d).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' }) : new Date().toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' }));

export function TransactionSuccessModal({
  isOpen,
  data,
  onClose,
  onShareSlip,
  onViewInvoice,
  onNewSale,
  onHome,
  onThermalPrint,
  onShareReceipt,
  onViewLedger,
  onBack,
  onViewPurchase,
  onPrint,
  onBackToList,
  onOk,
}: TransactionSuccessModalProps) {
  if (!isOpen || !data) return null;

  const triggerHaptic = () => {
    if (typeof navigator !== 'undefined' && (navigator as any).vibrate) {
      (navigator as any).vibrate(50);
    }
  };

  const handleAction = (fn?: () => void) => {
    triggerHaptic();
    fn?.();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        aria-hidden
      />
      {/* Bottom sheet */}
      <div
        className="relative bg-[#111827] rounded-t-2xl shadow-2xl max-h-[90vh] overflow-y-auto flex flex-col transaction-success-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="transaction-success-title"
      >
        <div className="p-6 pb-8">
          {/* Success icon */}
          <div className="flex justify-center mb-4">
            <div
              className="w-20 h-20 bg-[#10B981]/20 rounded-full flex items-center justify-center ring-4 ring-[#10B981]/30"
              style={{
                animation: 'successPop 0.4s ease-out',
              }}
            >
              <CheckCircle2 className="w-12 h-12 text-[#10B981]" strokeWidth={2.5} />
            </div>
          </div>
          <h2 id="transaction-success-title" className="text-xl font-bold text-white text-center mb-6">
            {data.title}
          </h2>

          {/* Details card */}
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 mb-6 space-y-2">
            {data.transactionNo && (
              <div className="flex justify-between text-sm">
                <span className="text-[#9CA3AF]">Transaction No</span>
                <span className="font-medium text-white">{data.transactionNo}</span>
              </div>
            )}
            {data.amount != null && data.amount !== undefined && (
              <div className="flex justify-between text-sm">
                <span className="text-[#9CA3AF]">Amount</span>
                <span className="font-semibold text-[#10B981]">{formatAmount(data.amount)}</span>
              </div>
            )}
            {data.partyName && (
              <div className="flex justify-between text-sm">
                <span className="text-[#9CA3AF]">{data.type === 'purchase' ? 'Supplier' : data.type === 'payment' ? 'Party' : 'Customer'}</span>
                <span className="text-white">{data.partyName}</span>
              </div>
            )}
            {data.branch && (
              <div className="flex justify-between text-sm">
                <span className="text-[#9CA3AF]">Branch</span>
                <span className="text-white">{data.branch}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-[#9CA3AF]">Date</span>
              <span className="text-white">{formatDate(data.date)}</span>
            </div>
          </div>

          {/* Action buttons by type */}
          <div className="space-y-3">
            {data.type === 'sale' && (
              <>
                {onShareSlip && (
                  <button
                    onClick={() => handleAction(onShareSlip)}
                    className="w-full h-12 bg-[#3B82F6] hover:bg-[#2563EB] rounded-xl font-medium text-white flex items-center justify-center gap-2"
                  >
                    <Share2 className="w-5 h-5" />
                    Share Slip
                  </button>
                )}
                {onViewInvoice && (
                  <button
                    onClick={() => handleAction(onViewInvoice)}
                    className="w-full h-12 bg-[#1F2937] border border-[#374151] hover:bg-[#374151] rounded-xl font-medium text-white flex items-center justify-center gap-2"
                  >
                    <FileText className="w-5 h-5" />
                    View Invoice
                  </button>
                )}
                {onThermalPrint && (
                  <button
                    type="button"
                    onClick={() => handleAction(onThermalPrint)}
                    className="w-full h-12 bg-[#111827] border border-[#10B981]/50 text-[#10B981] hover:bg-[#10B981]/10 rounded-xl font-medium flex items-center justify-center gap-2"
                  >
                    <Printer className="w-5 h-5" />
                    Thermal print (Bluetooth)
                  </button>
                )}
                {onNewSale && (
                  <button
                    onClick={() => handleAction(onNewSale)}
                    className="w-full h-12 bg-[#10B981]/20 border border-[#10B981]/50 text-[#10B981] hover:bg-[#10B981]/30 rounded-xl font-medium flex items-center justify-center gap-2"
                  >
                    <Plus className="w-5 h-5" />
                    New Sale
                  </button>
                )}
                {onHome && (
                  <button
                    onClick={() => handleAction(onHome)}
                    className="w-full h-12 border border-[#374151] hover:bg-[#374151] rounded-xl font-medium text-white flex items-center justify-center gap-2"
                  >
                    <Home className="w-5 h-5" />
                    Home
                  </button>
                )}
              </>
            )}

            {data.type === 'payment' && (
              <>
                {onShareReceipt && (
                  <button
                    onClick={() => handleAction(onShareReceipt)}
                    className="w-full h-12 bg-[#3B82F6] hover:bg-[#2563EB] rounded-xl font-medium text-white flex items-center justify-center gap-2"
                  >
                    <Share2 className="w-5 h-5" />
                    Share Receipt
                  </button>
                )}
                {onViewLedger && (
                  <button
                    onClick={() => handleAction(onViewLedger)}
                    className="w-full h-12 bg-[#1F2937] border border-[#374151] hover:bg-[#374151] rounded-xl font-medium text-white flex items-center justify-center gap-2"
                  >
                    <FileText className="w-5 h-5" />
                    View Ledger
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleAction(onBack ?? onClose)}
                  className="w-full h-12 border border-[#374151] hover:bg-[#374151] rounded-xl font-medium text-white flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="w-5 h-5" />
                  Back
                </button>
              </>
            )}

            {data.type === 'purchase' && (
              <>
                {onViewPurchase && (
                  <button
                    onClick={() => handleAction(onViewPurchase)}
                    className="w-full h-12 bg-[#3B82F6] hover:bg-[#2563EB] rounded-xl font-medium text-white flex items-center justify-center gap-2"
                  >
                    <FileText className="w-5 h-5" />
                    View Purchase
                  </button>
                )}
                {onPrint && (
                  <button
                    onClick={() => handleAction(onPrint)}
                    className="w-full h-12 bg-[#1F2937] border border-[#374151] hover:bg-[#374151] rounded-xl font-medium text-white flex items-center justify-center gap-2"
                  >
                    <Printer className="w-5 h-5" />
                    Print
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleAction(onBackToList ?? onClose)}
                  className="w-full h-12 border border-[#374151] hover:bg-[#374151] rounded-xl font-medium text-white flex items-center justify-center gap-2"
                >
                  <List className="w-5 h-5" />
                  Back to List
                </button>
              </>
            )}

            {data.type === 'rental' && (
              <>
                {(onViewInvoice || onViewPurchase) && (
                  <button
                    onClick={() => handleAction(onViewInvoice ?? onViewPurchase)}
                    className="w-full h-12 bg-[#3B82F6] hover:bg-[#2563EB] rounded-xl font-medium text-white flex items-center justify-center gap-2"
                  >
                    <FileText className="w-5 h-5" />
                    View Booking
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleAction(onBackToList ?? onHome ?? onClose)}
                  className="w-full h-12 border border-[#374151] hover:bg-[#374151] rounded-xl font-medium text-white flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="w-5 h-5" />
                  Back
                </button>
              </>
            )}

            {data.type === 'return' && (
              <>
                <button
                  type="button"
                  onClick={() => handleAction(onBack ?? onClose)}
                  className="w-full h-12 bg-[#3B82F6] hover:bg-[#2563EB] rounded-xl font-medium text-white flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="w-5 h-5" />
                  Back
                </button>
              </>
            )}

            {data.type === 'product' && (
              onOk && (
                <button
                  onClick={() => handleAction(onOk)}
                  className="w-full h-12 bg-[#3B82F6] hover:bg-[#2563EB] rounded-xl font-medium text-white flex items-center justify-center gap-2"
                >
                  OK
                </button>
              )
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes successPop {
          0% { transform: scale(0.6); opacity: 0; }
          50% { transform: scale(1.08); }
          100% { transform: scale(1); opacity: 1; }
        }
        .transaction-success-sheet {
          animation: slideUp 0.3s ease-out;
        }
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0.6; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
