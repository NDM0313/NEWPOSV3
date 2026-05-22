import { useState, useEffect, useMemo, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X, Printer, Barcode, Loader2, Minus, Plus, AlertTriangle } from 'lucide-react';
import type { MobileBarcodeLabelSettings, MobilePrinterSettings } from '../../api/settings';
import {
  printProductLabelsBatch,
  type LabelPrintLine,
} from '../../services/barcodeLabelPrint';
import { countSelectedLabels, hasPrintableCode } from '../../lib/barcodeLabelLines';

const CHECKBOX_CLASS =
  'w-4 h-4 shrink-0 mt-0.5 rounded border-[#4B5563] bg-[#374151] text-[#3B82F6] focus:ring-[#3B82F6] focus:ring-offset-0';

function LabelOptionRow({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className="flex items-start gap-3 w-full text-left cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className={CHECKBOX_CLASS}
      />
      <span className="flex-1 min-w-0 text-sm leading-snug text-[#E5E7EB] pt-0.5">{children}</span>
    </label>
  );
}

export interface BarcodeLabelPrintSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  lines: LabelPrintLine[];
  labelSettings: MobileBarcodeLabelSettings;
  printerSettings: MobilePrinterSettings;
  companyName?: string;
  branchName?: string;
  /** @deprecated Use companyName */
  businessName?: string;
}

export function BarcodeLabelPrintSheet({
  open,
  onClose,
  title = 'Print barcode labels',
  lines: initialLines,
  labelSettings,
  printerSettings,
  companyName,
  branchName,
  businessName,
}: BarcodeLabelPrintSheetProps) {
  const resolvedCompany = companyName ?? businessName;
  const [rows, setRows] = useState<LabelPrintLine[]>([]);
  const [showName, setShowName] = useState(labelSettings.showName);
  const [showPrice, setShowPrice] = useState(labelSettings.showPrice);
  const [showVariation, setShowVariation] = useState(labelSettings.showVariation);
  const [showPacking, setShowPacking] = useState(labelSettings.showPacking);
  const [showCompany, setShowCompany] = useState(labelSettings.showCompanyName);
  const [showBranch, setShowBranch] = useState(labelSettings.showBranchName);
  const [labelLayout, setLabelLayout] = useState<'thermal' | 'a4'>(labelSettings.labelLayout);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setRows(initialLines.map((l) => ({ ...l })));
    setShowName(labelSettings.showName);
    setShowPrice(labelSettings.showPrice);
    setShowVariation(labelSettings.showVariation);
    setShowPacking(labelSettings.showPacking);
    setShowCompany(labelSettings.showCompanyName);
    setShowBranch(labelSettings.showBranchName);
    setLabelLayout(labelSettings.labelLayout);
    setError(null);
  }, [open, initialLines, labelSettings]);

  const totalLabels = useMemo(() => countSelectedLabels(rows), [rows]);
  const selectedRows = rows.filter((r) => r.selected);
  const missingCodeCount = selectedRows.filter((r) => !hasPrintableCode(r)).length;

  const updateRow = (lineKey: string, patch: Partial<LabelPrintLine>) => {
    setRows((prev) => prev.map((r) => (r.lineKey === lineKey ? { ...r, ...patch } : r)));
  };

  const toggleAll = (selected: boolean) => {
    setRows((prev) => prev.map((r) => ({ ...r, selected })));
  };

  const handlePrint = async () => {
    if (totalLabels === 0 || missingCodeCount > 0) {
      setError(
        missingCodeCount > 0
          ? `${missingCodeCount} selected item(s) need a barcode or SKU on the product.`
          : 'Select at least one product with quantity > 0.',
      );
      return;
    }
    setBusy(true);
    setError(null);
    const settings: MobileBarcodeLabelSettings = {
      ...labelSettings,
      labelLayout,
      showName,
      showPrice,
      showVariation,
      showPacking,
      showCompanyName: showCompany,
      showBranchName: showBranch,
      showBusinessName: showCompany,
    };
    const res = await printProductLabelsBatch(rows, settings, printerSettings, {
      companyName: resolvedCompany,
      branchName,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.hint || 'Print failed');
      return;
    }
    onClose();
  };

  if (!open) return null;

  const sheet = (
    <div className="fixed inset-0 z-[120] flex flex-col bg-[#111827] max-h-[100dvh] w-full max-w-[100vw] overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-[#374151] bg-[#1F2937] shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Barcode className="w-6 h-6 text-[#3B82F6] shrink-0" />
          <div className="min-w-0">
            <h1 className="font-semibold text-white text-lg truncate">{title}</h1>
            <p className="text-xs text-[#9CA3AF]">
              {totalLabels} label{totalLabels === 1 ? '' : 's'} · {selectedRows.length} product
              {selectedRows.length === 1 ? '' : 's'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="p-2 rounded-lg text-[#9CA3AF] hover:bg-[#374151] hover:text-white shrink-0"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="px-4 py-3 border-b border-[#374151] bg-[#1F2937]/80 shrink-0 space-y-3">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setLabelLayout('thermal')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium ${
              labelLayout === 'thermal' ? 'bg-[#3B82F6] text-white' : 'bg-[#374151] text-[#9CA3AF]'
            }`}
          >
            Thermal (38×25)
          </button>
          <button
            type="button"
            onClick={() => setLabelLayout('a4')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium ${
              labelLayout === 'a4' ? 'bg-[#3B82F6] text-white' : 'bg-[#374151] text-[#9CA3AF]'
            }`}
          >
            A4 sheet ({labelSettings.a4Columns} col)
          </button>
        </div>
        <div className="flex gap-2 text-xs">
          <button type="button" onClick={() => toggleAll(true)} className="text-[#3B82F6] font-medium">
            Select all
          </button>
          <span className="text-[#4B5563]">|</span>
          <button type="button" onClick={() => toggleAll(false)} className="text-[#9CA3AF]">
            Clear
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain p-4 space-y-3 pb-24 max-w-full">
        {rows.map((row) => {
          const code = (row.barcode || row.sku || '').trim();
          const noCode = row.selected && !code;
          return (
            <div
              key={row.lineKey}
              className={`rounded-xl border p-3 max-w-full ${
                noCode ? 'border-[#EF4444]/50 bg-[#EF4444]/5' : 'border-[#374151] bg-[#1F2937]'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <input
                  type="checkbox"
                  checked={row.selected}
                  onChange={(e) => updateRow(row.lineKey, { selected: e.target.checked })}
                  className={CHECKBOX_CLASS}
                  aria-label={`Include ${row.productName}`}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate leading-tight">{row.productName}</p>
                  <p className="text-xs text-[#9CA3AF] font-mono truncate">{code || 'No barcode/SKU'}</p>
                  {row.variationName && (
                    <p className="text-[10px] text-[#A78BFA] truncate mt-0.5">{row.variationName}</p>
                  )}
                  {row.mergedLineCount != null && row.mergedLineCount > 1 && (
                    <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded bg-[#F59E0B]/20 text-[#FBBF24]">
                      ×{row.mergedLineCount} PO lines
                    </span>
                  )}
                  {noCode && (
                    <p className="text-xs text-[#FCA5A5] mt-1 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 shrink-0" /> Add barcode on product first
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-1">
                  <button
                    type="button"
                    onClick={() =>
                      updateRow(row.lineKey, { labelCount: Math.max(1, row.labelCount - 1) })
                    }
                    className="p-1 rounded-lg bg-[#374151] text-white"
                    aria-label="Decrease quantity"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={row.labelCount}
                    onChange={(e) =>
                      updateRow(row.lineKey, {
                        labelCount: Math.max(1, Math.min(500, parseInt(e.target.value, 10) || 1)),
                      })
                    }
                    className="w-11 h-8 text-center rounded-lg bg-[#111827] border border-[#374151] text-white text-sm"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      updateRow(row.lineKey, { labelCount: Math.min(500, row.labelCount + 1) })
                    }
                    className="p-1 rounded-lg bg-[#374151] text-white"
                    aria-label="Increase quantity"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        {rows.length === 0 && (
          <p className="text-center text-[#6B7280] py-8 text-sm">No products to print.</p>
        )}

        <div className="rounded-xl border border-[#374151] bg-[#1F2937] p-4 space-y-3 max-w-full">
          <p className="text-xs text-[#6B7280] font-medium uppercase tracking-wide">On each label</p>
          <div className="space-y-2.5">
            <LabelOptionRow checked={showName} onChange={setShowName}>
              Show product name
            </LabelOptionRow>
            <LabelOptionRow checked={showVariation} onChange={setShowVariation}>
              Show variation
            </LabelOptionRow>
            <LabelOptionRow checked={showPrice} onChange={setShowPrice}>
              Show price
            </LabelOptionRow>
            <LabelOptionRow checked={showPacking} onChange={setShowPacking}>
              Show packing details
            </LabelOptionRow>
            <LabelOptionRow checked={showCompany} onChange={setShowCompany}>
              Show company name{resolvedCompany ? ` (${resolvedCompany})` : ''}
            </LabelOptionRow>
            <LabelOptionRow checked={showBranch} onChange={setShowBranch}>
              Show branch name{branchName ? ` (${branchName})` : ''}
            </LabelOptionRow>
          </div>
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-4 bg-[#111827] border-t border-[#374151] flex gap-3 z-[10]">
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="flex-1 py-3 rounded-lg border border-[#374151] text-[#9CA3AF] font-medium"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={busy || totalLabels === 0}
          onClick={() => void handlePrint()}
          className="flex-1 py-3 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] text-white font-medium inline-flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Printer className="w-5 h-5" />}
          {busy ? 'Printing…' : `Print ${totalLabels} label${totalLabels === 1 ? '' : 's'}`}
        </button>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return sheet;
  return createPortal(sheet, document.body);
}
