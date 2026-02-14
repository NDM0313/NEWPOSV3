import { useState } from 'react';
import { ArrowLeft, FileText } from 'lucide-react';
import { SaleData } from './SalesModule';

interface SaleSummaryProps {
  onBack: () => void;
  saleData: SaleData;
  onUpdate: (data: Partial<SaleData>) => void;
  onProceedToPayment: () => void;
}

export function SaleSummary({ onBack, saleData, onUpdate, onProceedToPayment }: SaleSummaryProps) {
  const [discountType, setDiscountType] = useState<'amount' | 'percent'>('amount');
  const [discountValue, setDiscountValue] = useState(saleData.discount.toString());
  const [shipping, setShipping] = useState(saleData.shipping.toString());
  const [notes, setNotes] = useState(saleData.notes);

  const handleApplyDiscount = () => {
    let discountAmount = 0;
    if (discountType === 'amount') {
      discountAmount = parseFloat(discountValue) || 0;
    } else {
      const percent = parseFloat(discountValue) || 0;
      discountAmount = (saleData.subtotal * percent) / 100;
    }
    onUpdate({ discount: discountAmount });
  };

  const handleShippingChange = () => {
    const shippingAmount = parseFloat(shipping) || 0;
    onUpdate({ shipping: shippingAmount });
  };

  const handleNotesChange = () => {
    onUpdate({ notes });
  };

  const handleSaveDraft = () => {
    // In real app, would save to backend
    alert('Draft saved successfully!');
  };

  return (
    <div className="min-h-screen bg-[#111827] pb-32">
      {/* Header */}
      <div className="bg-[#1F2937] border-b border-[#374151] px-4 py-3 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 hover:bg-[#374151] rounded-lg transition-colors active:scale-95"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-semibold">Sale Summary</h1>
          </div>
          <button
            onClick={handleSaveDraft}
            className="px-4 py-2 border border-[#374151] hover:bg-[#374151] rounded-lg text-sm font-medium transition-colors"
          >
            Save
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Invoice Info */}
        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 bg-[#3B82F6]/10 rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-[#3B82F6]" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-[#9CA3AF] mb-1">Invoice</p>
              <p className="font-semibold text-[#F9FAFB]">INV-0046 (Draft)</p>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-[#9CA3AF]">Customer:</span>
              <span className="text-[#F9FAFB] font-medium">{saleData.customer?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#9CA3AF]">Date:</span>
              <span className="text-[#F9FAFB]">Jan 18, 2026</span>
            </div>
          </div>
        </div>

        {/* Items List */}
        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
          <h3 className="text-sm font-medium text-[#9CA3AF] mb-3">
            Items ({saleData.products.length})
          </h3>
          <div className="space-y-3">
            {saleData.products.map((product, index) => (
              <div key={index} className="flex justify-between text-sm">
                <div className="flex-1">
                  <p className="text-[#F9FAFB] font-medium">{product.name}</p>
                  <p className="text-xs text-[#9CA3AF]">
                    {product.quantity} × Rs. {product.price.toLocaleString()}
                  </p>
                </div>
                <p className="font-semibold text-[#F9FAFB]">
                  Rs. {product.total.toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Discount */}
        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
          <h3 className="text-sm font-medium text-[#9CA3AF] mb-3">Discount</h3>
          <div className="flex gap-2 mb-3">
            <div className="flex gap-2">
              <button
                onClick={() => setDiscountType('amount')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  discountType === 'amount'
                    ? 'bg-[#3B82F6] text-white'
                    : 'bg-[#111827] text-[#9CA3AF] border border-[#374151]'
                }`}
              >
                Rs.
              </button>
              <button
                onClick={() => setDiscountType('percent')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  discountType === 'percent'
                    ? 'bg-[#3B82F6] text-white'
                    : 'bg-[#111827] text-[#9CA3AF] border border-[#374151]'
                }`}
              >
                %
              </button>
            </div>
            <input
              type="number"
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
              onBlur={handleApplyDiscount}
              placeholder="0"
              className="flex-1 h-10 bg-[#111827] border border-[#374151] rounded-lg px-3 text-sm focus:outline-none focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20"
            />
            <button
              onClick={handleApplyDiscount}
              className="px-4 py-2 bg-[#3B82F6] hover:bg-[#2563EB] rounded-lg text-sm font-medium transition-colors"
            >
              Apply
            </button>
          </div>
          {saleData.discount > 0 && (
            <p className="text-sm text-[#10B981]">
              Discount applied: Rs. {saleData.discount.toLocaleString()}
            </p>
          )}
        </div>

        {/* Shipping */}
        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
          <h3 className="text-sm font-medium text-[#9CA3AF] mb-3">Shipping</h3>
          <input
            type="number"
            value={shipping}
            onChange={(e) => setShipping(e.target.value)}
            onBlur={handleShippingChange}
            placeholder="0"
            className="w-full h-10 bg-[#111827] border border-[#374151] rounded-lg px-3 text-sm focus:outline-none focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20"
          />
        </div>

        {/* Notes */}
        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
          <h3 className="text-sm font-medium text-[#9CA3AF] mb-3">Notes (Optional)</h3>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={handleNotesChange}
            placeholder="Add notes..."
            rows={3}
            className="w-full bg-[#111827] border border-[#374151] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20 resize-none"
          />
        </div>

        {/* Total Summary */}
        <div className="bg-gradient-to-br from-[#1F2937] to-[#111827] border border-[#374151] rounded-xl p-4">
          <div className="space-y-2 text-sm mb-3">
            <div className="flex justify-between">
              <span className="text-[#9CA3AF]">Subtotal</span>
              <span className="text-[#F9FAFB]">Rs. {saleData.subtotal.toLocaleString()}</span>
            </div>
            {saleData.discount > 0 && (
              <div className="flex justify-between">
                <span className="text-[#9CA3AF]">Discount</span>
                <span className="text-[#EF4444]">- Rs. {saleData.discount.toLocaleString()}</span>
              </div>
            )}
            {saleData.shipping > 0 && (
              <div className="flex justify-between">
                <span className="text-[#9CA3AF]">Shipping</span>
                <span className="text-[#F9FAFB]">Rs. {saleData.shipping.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-[#9CA3AF]">Tax</span>
              <span className="text-[#F9FAFB]">Rs. {saleData.tax.toLocaleString()}</span>
            </div>
          </div>
          <div className="pt-3 border-t border-[#374151] flex justify-between">
            <span className="font-semibold text-lg">Total</span>
            <span className="font-bold text-2xl text-[#10B981]">
              Rs. {saleData.total.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#1F2937] border-t border-[#374151] p-4 space-y-2">
        <button
          onClick={onProceedToPayment}
          className="w-full h-12 bg-[#3B82F6] hover:bg-[#2563EB] rounded-lg font-medium transition-colors active:scale-[0.98] flex items-center justify-center gap-2"
        >
          Proceed to Payment →
        </button>
        <button
          onClick={handleSaveDraft}
          className="w-full h-12 border border-[#374151] hover:bg-[#374151] rounded-lg font-medium transition-colors"
        >
          Save Draft
        </button>
      </div>
    </div>
  );
}
