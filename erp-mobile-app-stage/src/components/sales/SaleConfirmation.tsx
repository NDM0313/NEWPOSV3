import { CheckCircle2, Plus, Home } from 'lucide-react';
import type { SaleData } from './SalesModule';

interface SaleConfirmationProps {
  saleData: SaleData;
  invoiceNo?: string | null;
  onNewSale: () => void;
  onBackToHome: () => void;
}

export function SaleConfirmation({ saleData, invoiceNo, onNewSale, onBackToHome }: SaleConfirmationProps) {
  const date = new Date().toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div className="min-h-screen bg-[#111827] p-6 pb-24">
      <div className="flex flex-col items-center text-center py-8">
        <div className="w-20 h-20 bg-[#10B981]/20 rounded-full flex items-center justify-center mb-4">
          <CheckCircle2 className="w-12 h-12 text-[#10B981]" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Sale Complete!</h1>
        <p className="text-[#9CA3AF]">Thank you for your business</p>
      </div>

      <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 mb-6">
        <p className="text-xs text-[#9CA3AF] mb-1">{invoiceNo ? `Invoice ${invoiceNo}` : 'Invoice'} • {date}</p>
        <p className="font-semibold text-white mb-2">Customer: {saleData.customer?.name}</p>
        <div className="space-y-1 text-sm">
          {saleData.products.map((p, i) => (
            <div key={i} className="flex justify-between">
              <div>
                <span className="text-[#9CA3AF]">{p.name} × {p.quantity}</span>
                {p.packingDetails && (p.packingDetails.total_meters ?? 0) > 0 && (
                  <span className="block text-xs text-[#3B82F6]">
                    {p.packingDetails.total_boxes ?? 0} Box / {p.packingDetails.total_pieces ?? 0} Pc / {(p.packingDetails.total_meters ?? 0).toFixed(1)} M
                  </span>
                )}
              </div>
              <span className="text-white">Rs. {p.total.toLocaleString()}</span>
            </div>
          ))}
        </div>
        <div className="pt-3 mt-3 border-t border-[#374151] flex justify-between">
          <span className="font-semibold text-white">Total</span>
          <span className="font-bold text-[#10B981]">Rs. {saleData.total.toLocaleString()}</span>
        </div>
      </div>

      <div className="space-y-3">
        <button
          onClick={onNewSale}
          className="w-full h-12 bg-[#3B82F6] hover:bg-[#2563EB] rounded-lg font-medium text-white flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" />
          New Sale
        </button>
        <button
          onClick={onBackToHome}
          className="w-full h-12 border border-[#374151] hover:bg-[#374151] rounded-lg font-medium text-white flex items-center justify-center gap-2"
        >
          <Home className="w-5 h-5" />
          Back to Home
        </button>
      </div>
    </div>
  );
}
