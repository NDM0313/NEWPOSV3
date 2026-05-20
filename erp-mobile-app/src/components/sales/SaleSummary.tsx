import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, FileText, Upload, X, Calendar } from 'lucide-react';
import type { SaleData } from './SalesModule';
import { localNowDateString } from '../../utils/localDate';

interface SaleSummaryProps {
  onBack: () => void;
  saleData: SaleData;
  onUpdate: (data: Partial<SaleData>) => void;
  onProceedToPayment: () => void;
}

export function SaleSummary({ onBack, saleData, onUpdate, onProceedToPayment }: SaleSummaryProps) {
  const [discountType, setDiscountType] = useState<'amount' | 'percent'>('amount');
  const [discountValue, setDiscountValue] = useState(
    saleData.discount ? String(saleData.discount) : ''
  );
  const [notes, setNotes] = useState(saleData.notes || '');
  const [attachments, setAttachments] = useState<File[]>(saleData.attachmentFiles ?? []);
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setDiscountValue(saleData.discount ? String(saleData.discount) : '');
  }, [saleData.discount]);

  useEffect(() => {
    setNotes(saleData.notes || '');
  }, [saleData.notes]);

  useEffect(() => {
    setAttachments(saleData.attachmentFiles ?? []);
  }, [saleData.attachmentFiles]);

  const syncAttachments = (files: File[]) => {
    setAttachments(files);
    onUpdate({ attachmentFiles: files });
  };

  const applyDiscount = () => {
    const d = discountType === 'amount' ? parseFloat(discountValue) || 0 : (saleData.subtotal * (parseFloat(discountValue) || 0)) / 100;
    onUpdate({ discount: d });
  };
  const applyNotes = () => onUpdate({ notes });

  return (
    <div className="min-h-screen bg-[#111827] pb-32">
      <div className="bg-[#1F2937] border-b border-[#374151] px-4 py-3 sticky top-0 z-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-[#374151] rounded-lg text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold text-white">Sale Summary</h1>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 bg-[#3B82F6]/10 rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-[#3B82F6]" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-[#9CA3AF] mb-1">Invoice</p>
              <p className="font-semibold text-white">Final Invoice</p>
              <p className="text-xs text-[#10B981] mt-0.5">Invoice # assigned on payment confirmation</p>
              <p className="text-sm text-[#9CA3AF] mt-1">Customer: {saleData.customer?.name}</p>
            </div>
          </div>
        </div>

        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
          <label className="text-sm font-medium text-[#9CA3AF] mb-2 block">Invoice date</label>
          <div className="flex items-center gap-2 bg-[#111827] border border-[#374151] rounded-lg px-3 py-2.5">
            <Calendar className="w-5 h-5 text-[#6B7280] shrink-0" />
            <input
              type="date"
              max={localNowDateString()}
              value={saleData.saleDate ?? localNowDateString()}
              onChange={(e) => onUpdate({ saleDate: e.target.value })}
              className="flex-1 min-w-0 bg-transparent text-white text-sm outline-none"
            />
          </div>
          <p className="text-xs text-[#6B7280] mt-2">Uses your device calendar (not UTC midnight).</p>
        </div>

        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
          <h3 className="text-sm font-medium text-[#9CA3AF] mb-3">Items ({saleData.products.length})</h3>
          <div className="space-y-3">
            {saleData.products.map((p, i) => (
              <div key={i} className="flex justify-between text-sm">
                <div>
                  <p className="text-white font-medium">{p.name}</p>
                  {p.variation && <p className="text-xs text-[#9CA3AF]">{p.variation}</p>}
                  <p className="text-xs text-[#9CA3AF]">{p.quantity} × Rs. {p.price.toLocaleString()}</p>
                  {p.packingDetails && (p.packingDetails.total_meters ?? 0) > 0 && (
                    <p className="text-xs text-[#3B82F6] mt-0.5">
                      {p.packingDetails.total_boxes ?? 0} Box / {p.packingDetails.total_pieces ?? 0} Pc / {(p.packingDetails.total_meters ?? 0).toFixed(1)} M
                    </p>
                  )}
                </div>
                <p className="font-semibold text-white">Rs. {p.total.toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
          <h3 className="text-sm font-medium text-[#9CA3AF] mb-3">Discount</h3>
          <div className="flex gap-2 flex-wrap items-center">
            <button
              onClick={() => setDiscountType('amount')}
              className={`px-3 py-2 rounded-lg text-sm font-medium ${discountType === 'amount' ? 'bg-[#3B82F6] text-white' : 'bg-[#111827] text-[#9CA3AF] border border-[#374151]'}`}
            >
              Rs.
            </button>
            <button
              onClick={() => setDiscountType('percent')}
              className={`px-3 py-2 rounded-lg text-sm font-medium ${discountType === 'percent' ? 'bg-[#3B82F6] text-white' : 'bg-[#111827] text-[#9CA3AF] border border-[#374151]'}`}
            >
              %
            </button>
            <input
              type="number"
              inputMode="decimal"
              pattern="[0-9.]*"
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
              onBlur={applyDiscount}
              placeholder="0"
              className="flex-1 min-w-[80px] h-10 bg-[#111827] border border-[#374151] rounded-lg px-3 text-sm text-white focus:outline-none focus:border-[#3B82F6]"
            />
            <button onClick={applyDiscount} className="px-4 py-2 bg-[#3B82F6] hover:bg-[#2563EB] rounded-lg text-sm font-medium text-white">
              Apply
            </button>
          </div>
        </div>

        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
          <h3 className="text-sm font-medium text-[#9CA3AF] mb-2">Notes</h3>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={applyNotes}
            placeholder="Optional notes..."
            rows={2}
            className="w-full bg-[#111827] border border-[#374151] rounded-lg px-3 py-2 text-sm text-white placeholder-[#6B7280] focus:outline-none focus:border-[#3B82F6] resize-none"
          />
        </div>

        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
          <label className="text-sm font-medium text-[#9CA3AF] mb-2 block">Attachments (optional)</label>
          <input
            ref={attachmentInputRef}
            type="file"
            multiple
            accept="image/*,.pdf"
            className="hidden"
            onChange={(e) => {
              const picked = Array.from(e.target.files || []);
              syncAttachments([...attachments, ...picked].slice(0, 5));
              if (attachmentInputRef.current) attachmentInputRef.current.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => attachmentInputRef.current?.click()}
            className="w-full border-2 border-dashed border-[#374151] rounded-lg p-3 flex items-center justify-center gap-2 text-[#9CA3AF] hover:bg-[#374151]/30 hover:border-[#3B82F6]/50"
          >
            <Upload className="w-4 h-4" />
            Add files (max 5)
          </button>
          {attachments.length > 0 && (
            <div className="mt-2 space-y-1">
              {attachments.map((file, index) => (
                <div
                  key={`${file.name}-${index}`}
                  className="flex items-center justify-between text-xs text-[#D1D5DB] bg-[#111827] rounded px-2 py-1"
                >
                  <span className="truncate">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => syncAttachments(attachments.filter((_, i) => i !== index))}
                    className="text-[#EF4444] shrink-0 ml-2"
                    aria-label={`Remove ${file.name}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
          <div className="space-y-2 text-sm mb-3">
            <div className="flex justify-between">
              <span className="text-[#9CA3AF]">Subtotal</span>
              <span className="text-white">Rs. {saleData.subtotal.toLocaleString()}</span>
            </div>
            {saleData.discount > 0 && (
              <div className="flex justify-between">
                <span className="text-[#9CA3AF]">Discount</span>
                <span className="text-[#EF4444]">- Rs. {saleData.discount.toLocaleString()}</span>
              </div>
            )}
          </div>
          <div className="pt-3 border-t border-[#374151] flex justify-between">
            <span className="font-semibold text-lg text-white">Total</span>
            <span className="font-bold text-2xl text-[#10B981]">Rs. {saleData.total.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {createPortal(
        <div className="fixed left-0 right-0 bottom-0 bg-[#1F2937] border-t border-[#374151] p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0))] z-[60]">
          <button
            onClick={onProceedToPayment}
            className="w-full h-12 bg-[#3B82F6] hover:bg-[#2563EB] rounded-lg font-medium text-white transition-colors"
          >
            Proceed to Payment →
          </button>
        </div>,
        document.body
      )}
    </div>
  );
}
