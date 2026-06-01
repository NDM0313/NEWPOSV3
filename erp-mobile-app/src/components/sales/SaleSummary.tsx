import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, FileText, Upload, X, Calendar, Loader2 } from 'lucide-react';
import type { SaleData } from './SalesModule';
import { localNowDateString } from '../../utils/localDate';
import type { Branch } from '../../api/branches';
import { WriteBranchPickerField } from '../shared/WriteBranchPickerField';
import { prepareAttachmentFilesForUpload } from '../../utils/imageCompression';
import { MediaSourcePicker } from '../shared/MediaSourcePicker';
import { SaleExtrasPanel } from './SaleExtrasPanel';
import {
  hasInclusiveBespokeParents,
  isStockOnlyBespokeLine,
  saleExtrasPanelActive,
  sumExtraExpenses,
} from '../../lib/saleTotals';

const MAX_SALE_ATTACHMENT_BYTES = 10 * 1024 * 1024;

interface SaleSummaryProps {
  onBack: () => void;
  saleData: SaleData;
  onUpdate: (data: Partial<SaleData>) => void;
  onProceedToPayment: () => void;
  companyId?: string | null;
  needsBranchPicker?: boolean;
  branchPickerBranches?: Branch[];
  pickedBranchId?: string;
  onPickedBranchChange?: (branchId: string) => void;
  branchSelectionError?: string | null;
  branchReady?: boolean;
}

export function SaleSummary({
  onBack,
  saleData,
  onUpdate,
  onProceedToPayment,
  companyId = null,
  needsBranchPicker,
  branchPickerBranches = [],
  pickedBranchId = '',
  onPickedBranchChange,
  branchSelectionError,
  branchReady = true,
}: SaleSummaryProps) {
  const [discountType, setDiscountType] = useState<'amount' | 'percent'>('amount');
  const [discountValue, setDiscountValue] = useState(
    saleData.discount ? String(saleData.discount) : ''
  );
  const [notes, setNotes] = useState(saleData.notes || '');
  const [attachments, setAttachments] = useState<File[]>(saleData.attachmentFiles ?? []);
  const [isProcessingAttachments, setIsProcessingAttachments] = useState(false);
  const [attachmentNotice, setAttachmentNotice] = useState<string | null>(null);
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

  const handleAttachmentPick = async (picked: File[]) => {
    if (!picked.length) return;
    setIsProcessingAttachments(true);
    setAttachmentNotice(null);
    try {
      const { files: processed, compressionMessages, skippedMessages } =
        await prepareAttachmentFilesForUpload(picked, MAX_SALE_ATTACHMENT_BYTES);
      const notice = [...skippedMessages, ...compressionMessages].join(' · ');
      if (notice) setAttachmentNotice(notice);
      syncAttachments([...attachments, ...processed].slice(0, 5));
    } finally {
      setIsProcessingAttachments(false);
    }
  };

  const applyDiscount = () => {
    const d = discountType === 'amount' ? parseFloat(discountValue) || 0 : (saleData.subtotal * (parseFloat(discountValue) || 0)) / 100;
    onUpdate({ discount: d });
  };
  const applyNotes = () => onUpdate({ notes });

  const extrasActive = saleExtrasPanelActive(saleData.saleType, saleData.documentStatus);
  const inclusiveBespoke = hasInclusiveBespokeParents(saleData.products);
  const chargeOnBill = saleData.chargeExtrasToCustomer !== false;
  const extraTotal = sumExtraExpenses(saleData.extraExpenses);
  const extraOnBill = chargeOnBill ? extraTotal : 0;
  const shippingTotal = saleData.shippingCharge ?? saleData.shipping ?? 0;

  return (
    <div className="min-h-screen bg-[#111827] pb-32">
      <div className="bg-[#1F2937] border-b border-[#374151] px-4 py-3 sticky top-0 z-10 flow-screen-header flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-[#374151] rounded-lg text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold text-white">Sale Summary</h1>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {needsBranchPicker && onPickedBranchChange && (
          <WriteBranchPickerField
            branches={branchPickerBranches}
            value={pickedBranchId}
            onChange={onPickedBranchChange}
            helperText="This sale will be recorded under the selected branch."
          />
        )}
        {branchSelectionError && (
          <div className="p-3 bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-xl text-sm text-[#FCA5A5]">
            {branchSelectionError}
          </div>
        )}
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
            {saleData.products.map((p, i) => {
              const stockOnly = isStockOnlyBespokeLine(p);
              return (
              <div key={i} className="flex justify-between text-sm">
                <div>
                  <p className="text-white font-medium flex items-center gap-2 flex-wrap">
                    {p.name}
                    {stockOnly && (
                      <span className="text-[10px] font-medium text-[#9CA3AF] bg-[#374151] px-1.5 py-0.5 rounded">
                        Stock only
                      </span>
                    )}
                  </p>
                  {p.variation && <p className="text-xs text-[#9CA3AF]">{p.variation}</p>}
                  <p className="text-xs text-[#9CA3AF]">
                    {p.quantity} × Rs. {p.price.toLocaleString()}
                    {stockOnly ? ' (not on customer bill)' : ''}
                  </p>
                  {p.packingDetails && (p.packingDetails.total_meters ?? 0) > 0 && (
                    <p className="text-xs text-[#3B82F6] mt-0.5">
                      {p.packingDetails.total_boxes ?? 0} Box / {p.packingDetails.total_pieces ?? 0} Pc / {(p.packingDetails.total_meters ?? 0).toFixed(1)} M
                    </p>
                  )}
                </div>
                <p className={`font-semibold ${stockOnly ? 'text-[#9CA3AF]' : 'text-white'}`}>
                  Rs. {p.total.toLocaleString()}
                </p>
              </div>
            );
            })}
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

        <SaleExtrasPanel
          locked={!extrasActive}
          companyId={companyId ?? null}
          chargeExtrasToCustomer={chargeOnBill}
          onChargeExtrasToCustomerChange={(chargeExtrasToCustomer) =>
            onUpdate({ chargeExtrasToCustomer })
          }
          extraExpenses={saleData.extraExpenses ?? []}
          onExtraExpensesChange={(extraExpenses) => onUpdate({ extraExpenses })}
          shippingCharge={shippingTotal}
          onShippingChargeChange={(shippingCharge) => onUpdate({ shippingCharge })}
        />

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

        {saleData.saleType === 'regular' && (
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 space-y-2">
            <label className="text-sm font-medium text-[#9CA3AF] block">Document type</label>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { id: 'draft', label: 'Draft' },
                  { id: 'quotation', label: 'Quotation' },
                  { id: 'order', label: 'Order' },
                  { id: 'final', label: 'Final (invoice)' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onUpdate({ documentStatus: opt.id })}
                  className={`h-10 rounded-lg text-xs font-medium border ${
                    (saleData.documentStatus ?? 'order') === opt.id
                      ? 'border-[#3B82F6] bg-[#3B82F6]/15 text-white'
                      : 'border-[#374151] text-[#9CA3AF]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-[#6B7280]">
              Order / quotation: stock aur payment baad mein. Final: payment abhi.
            </p>
          </div>
        )}

        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
          <label className="text-sm font-medium text-[#9CA3AF] mb-2 block">Attachments (optional)</label>
          <MediaSourcePicker
            accept="image/*,.pdf"
            multiple
            disabled={isProcessingAttachments}
            sheetTitle="Add attachment"
            onFiles={(picked) => void handleAttachmentPick(picked)}
          >
            {(open) => (
          <button
            type="button"
            disabled={isProcessingAttachments}
            onClick={open}
            className="w-full border-2 border-dashed border-[#374151] rounded-lg p-3 flex items-center justify-center gap-2 text-[#9CA3AF] hover:bg-[#374151]/30 hover:border-[#3B82F6]/50 disabled:opacity-60"
          >
            {isProcessingAttachments ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Compressing…
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Camera or upload (max 5)
              </>
            )}
          </button>
            )}
          </MediaSourcePicker>
          {attachmentNotice && (
            <p className="mt-2 text-xs text-[#9CA3AF]">{attachmentNotice}</p>
          )}
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
              <span className="text-[#9CA3AF]">
                {inclusiveBespoke ? 'Customer subtotal' : 'Subtotal'}
              </span>
              <span className="text-white">Rs. {saleData.subtotal.toLocaleString()}</span>
            </div>
            {inclusiveBespoke && (
              <p className="text-[10px] text-[#6B7280]">
                Fabric child lines excluded; dress prices are all-inclusive.
              </p>
            )}
            {saleData.discount > 0 && (
              <div className="flex justify-between">
                <span className="text-[#9CA3AF]">Discount</span>
                <span className="text-[#EF4444]">- Rs. {saleData.discount.toLocaleString()}</span>
              </div>
            )}
            {extraOnBill > 0 && (
              <div className="flex justify-between">
                <span className="text-[#9CA3AF]">Extra expenses (on bill)</span>
                <span className="text-white">Rs. {extraOnBill.toLocaleString()}</span>
              </div>
            )}
            {!chargeOnBill && extraTotal > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-[#6B7280]">Package extras (4120, not on bill)</span>
                <span className="text-[#9CA3AF]">Rs. {extraTotal.toLocaleString()}</span>
              </div>
            )}
            {shippingTotal > 0 && (
              <div className="flex justify-between">
                <span className="text-[#9CA3AF]">Shipping</span>
                <span className="text-white">Rs. {shippingTotal.toLocaleString()}</span>
              </div>
            )}
            {saleData.tax > 0 && (
              <div className="flex justify-between">
                <span className="text-[#9CA3AF]">Tax</span>
                <span className="text-white">Rs. {saleData.tax.toLocaleString()}</span>
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
            disabled={!branchReady}
            className="w-full h-12 bg-[#3B82F6] hover:bg-[#2563EB] disabled:bg-[#374151] disabled:text-[#9CA3AF] rounded-lg font-medium text-white transition-colors"
          >
            {saleData.saleType === 'studio' || (saleData.documentStatus ?? 'order') !== 'final'
              ? 'Save order →'
              : 'Proceed to Payment →'}
          </button>
        </div>,
        document.body
      )}
    </div>
  );
}
