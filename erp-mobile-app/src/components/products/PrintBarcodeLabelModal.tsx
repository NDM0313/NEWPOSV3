import { useState, useEffect } from 'react';
import { X, Printer, Barcode } from 'lucide-react';
import type { MobileBarcodeLabelSettings } from '../../api/settings';
import { printProductLabels, type LabelPrintJob } from '../../services/barcodeLabelPrint';
import type { MobilePrinterSettings } from '../../api/settings';

interface PrintBarcodeLabelModalProps {
  open: boolean;
  onClose: () => void;
  productName: string;
  sku: string;
  barcode: string;
  price?: number;
  businessName?: string;
  labelSettings: MobileBarcodeLabelSettings;
  printerSettings: MobilePrinterSettings;
}

export function PrintBarcodeLabelModal({
  open,
  onClose,
  productName,
  sku,
  barcode,
  price,
  businessName,
  labelSettings,
  printerSettings,
}: PrintBarcodeLabelModalProps) {
  const [quantity, setQuantity] = useState(String(labelSettings.defaultQuantity));
  const [showName, setShowName] = useState(labelSettings.showName);
  const [showPrice, setShowPrice] = useState(labelSettings.showPrice);
  const [showBusiness, setShowBusiness] = useState(labelSettings.showBusinessName);
  const [labelLayout, setLabelLayout] = useState<'thermal' | 'a4'>(labelSettings.labelLayout);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setQuantity(String(labelSettings.defaultQuantity));
    setShowName(labelSettings.showName);
    setShowPrice(labelSettings.showPrice);
    setShowBusiness(labelSettings.showBusinessName);
    setLabelLayout(labelSettings.labelLayout);
    setError(null);
  }, [open, labelSettings]);

  if (!open) return null;

  const code = (barcode || sku || '').trim();
  if (!code) {
    return (
      <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/60 p-4">
        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 max-w-md w-full">
          <p className="text-red-400 text-sm">Product needs a barcode or SKU before printing labels.</p>
          <button type="button" onClick={onClose} className="mt-4 w-full py-2 rounded-lg bg-[#374151] text-white">
            Close
          </button>
        </div>
      </div>
    );
  }

  const handlePrint = async () => {
    setBusy(true);
    setError(null);
    const job: LabelPrintJob = {
      productName,
      sku,
      barcode: code,
      price,
      businessName,
      quantity: Math.max(1, parseInt(quantity, 10) || 1),
    };
    const res = await printProductLabels(
      job,
      { labelLayout, showName, showPrice, showBusinessName: showBusiness, defaultQuantity: job.quantity },
      printerSettings
    );
    setBusy(false);
    if (!res.ok) {
      setError(res.hint || 'Print failed');
      return;
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/60">
      <div className="bg-[#1F2937] border border-[#374151] rounded-t-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-[#374151]">
          <div className="flex items-center gap-2 text-white font-medium">
            <Barcode className="w-5 h-5 text-[#3B82F6]" />
            Print labels
          </div>
          <button type="button" onClick={onClose} className="p-2 text-[#9CA3AF] hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <p className="text-sm text-[#9CA3AF]">
            <span className="text-white font-medium">{productName}</span> · {code}
          </p>
          <div>
            <label className="text-xs text-[#9CA3AF] block mb-1">Label layout</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setLabelLayout('thermal')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                  labelLayout === 'thermal' ? 'bg-[#3B82F6] text-white' : 'bg-[#374151] text-[#9CA3AF]'
                }`}
              >
                Thermal (38×25)
              </button>
              <button
                type="button"
                onClick={() => setLabelLayout('a4')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                  labelLayout === 'a4' ? 'bg-[#3B82F6] text-white' : 'bg-[#374151] text-[#9CA3AF]'
                }`}
              >
                A4 sheet
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs text-[#9CA3AF] block mb-1">Quantity</label>
            <input
              type="number"
              min={1}
              max={500}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full bg-[#111827] border border-[#374151] rounded-lg px-3 py-2 text-white"
            />
          </div>
          <div className="space-y-2 text-sm text-[#E5E7EB]">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={showName} onChange={(e) => setShowName(e.target.checked)} />
              Show product name
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={showPrice} onChange={(e) => setShowPrice(e.target.checked)} />
              Show price
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={showBusiness} onChange={(e) => setShowBusiness(e.target.checked)} />
              Show business name
            </label>
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="button"
            disabled={busy}
            onClick={() => void handlePrint()}
            className="w-full py-3 rounded-xl bg-[#3B82F6] text-white font-medium flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Printer className="w-5 h-5" />
            {busy ? 'Printing…' : `Print ${quantity} label(s)`}
          </button>
        </div>
      </div>
    </div>
  );
}
