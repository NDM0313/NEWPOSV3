import React, { useState, useEffect, useMemo } from 'react';
import { Printer, Barcode as BarcodeIcon, Loader2, Minus, Plus, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import { Checkbox } from '@/app/components/ui/checkbox';
import { Label } from '@/app/components/ui/label';
import type { BarcodeLabelSettings } from '@/app/services/barcodeLabelSettingsService';
import {
  printProductLabelsBatch,
  flattenLinesToJobs,
  type LabelPrintLine,
} from '@/app/services/barcodeLabelPrint';
import { countSelectedLabels, hasPrintableCode } from '@/app/lib/barcodeLabelLines';
import { cn } from '@/app/components/ui/utils';
import { toast } from 'sonner';

function OptionRow({
  id,
  checked,
  onCheckedChange,
  label,
}: {
  id: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <div className="flex items-start gap-3 w-full text-left">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(c) => onCheckedChange(c === true)}
        className="mt-0.5 shrink-0 border-gray-500 data-[state=checked]:bg-blue-600"
      />
      <Label htmlFor={id} className="flex-1 min-w-0 text-sm font-normal leading-snug text-gray-300 cursor-pointer pt-0.5">
        {label}
      </Label>
    </div>
  );
}

export interface BarcodeLabelPrintDialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  lines: LabelPrintLine[];
  labelSettings: BarcodeLabelSettings;
  companyName?: string;
  branchName?: string;
}

export function BarcodeLabelPrintDialog({
  open,
  onClose,
  title = 'Print barcode labels',
  lines: initialLines,
  labelSettings,
  companyName,
  branchName,
}: BarcodeLabelPrintDialogProps) {
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

  const previewJob = useMemo(() => {
    const first = rows.find((r) => r.selected && hasPrintableCode(r));
    if (!first) return null;
    const jobs = flattenLinesToJobs([first], { companyName, branchName });
    return jobs[0] ?? null;
  }, [rows, companyName, branchName]);

  const updateRow = (lineKey: string, patch: Partial<LabelPrintLine>) => {
    setRows((prev) => prev.map((r) => (r.lineKey === lineKey ? { ...r, ...patch } : r)));
  };

  const toggleAll = (selected: boolean) => {
    setRows((prev) => prev.map((r) => ({ ...r, selected })));
  };

  const handlePrint = () => {
    if (totalLabels === 0 || missingCodeCount > 0) {
      setError(
        missingCodeCount > 0
          ? `${missingCodeCount} selected item(s) need a barcode or SKU.`
          : 'Select at least one product with quantity > 0.',
      );
      return;
    }
    setBusy(true);
    setError(null);
    const settings: BarcodeLabelSettings = {
      ...labelSettings,
      labelLayout: 'a4',
      showName,
      showPrice,
      showVariation,
      showPacking,
      showCompanyName: showCompany,
      showBranchName: showBranch,
      showBusinessName: showCompany,
    };
    const res = printProductLabelsBatch(rows, settings, { companyName, branchName });
    setBusy(false);
    if (!res.ok) {
      setError(res.hint || 'Print failed');
      toast.error(res.hint || 'Print failed');
      return;
    }
    toast.success(`Printing ${res.printedCount} label(s)`);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] bg-gray-900 text-white border-gray-700 p-0 gap-0 flex flex-col overflow-hidden">
        <DialogHeader className="p-4 border-b border-gray-800 shrink-0">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <BarcodeIcon className="text-blue-500 shrink-0" size={22} />
            <span className="truncate">{title}</span>
          </DialogTitle>
          <p className="text-xs text-gray-500 mt-1">
            {totalLabels} label{totalLabels === 1 ? '' : 's'} · {selectedRows.length} product
            {selectedRows.length === 1 ? '' : 's'}
          </p>
        </DialogHeader>

        <div className="flex flex-1 min-h-0 flex-col md:flex-row overflow-hidden">
          <div className="flex-1 min-h-0 flex flex-col border-b md:border-b-0 md:border-r border-gray-800">
            <div className="px-4 py-2 flex gap-2 text-xs shrink-0 border-b border-gray-800">
              <button type="button" onClick={() => toggleAll(true)} className="text-blue-400 font-medium">
                Select all
              </button>
              <span className="text-gray-600">|</span>
              <button type="button" onClick={() => toggleAll(false)} className="text-gray-400">
                Clear
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2 min-h-0">
              {rows.map((row) => {
                const code = (row.barcode || row.sku || '').trim();
                const noCode = row.selected && !code;
                return (
                  <div
                    key={row.lineKey}
                    className={cn(
                      'rounded-lg border p-3 max-w-full',
                      noCode ? 'border-red-500/40 bg-red-500/5' : 'border-gray-700 bg-gray-800/50',
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Checkbox
                        checked={row.selected}
                        onCheckedChange={(c) => updateRow(row.lineKey, { selected: c === true })}
                        className="shrink-0 border-gray-500 data-[state=checked]:bg-blue-600"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{row.productName}</p>
                        <p className="text-xs text-gray-500 font-mono truncate">{code || 'No barcode/SKU'}</p>
                        {row.variationName && (
                          <p className="text-[10px] text-purple-400 truncate">{row.variationName}</p>
                        )}
                        {row.mergedLineCount != null && row.mergedLineCount > 1 && (
                          <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">
                            ×{row.mergedLineCount} PO lines
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() =>
                            updateRow(row.lineKey, { labelCount: Math.max(1, row.labelCount - 1) })
                          }
                        >
                          <Minus size={14} />
                        </Button>
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
                          className="w-11 h-8 text-center rounded bg-gray-950 border border-gray-700 text-white text-sm"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() =>
                            updateRow(row.lineKey, { labelCount: Math.min(500, row.labelCount + 1) })
                          }
                        >
                          <Plus size={14} />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="w-full md:w-72 shrink-0 p-4 space-y-4 overflow-y-auto bg-gray-950/50">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">On each label</p>
              <div className="space-y-2.5">
                <OptionRow id="lbl-name" checked={showName} onCheckedChange={setShowName} label="Show product name" />
                <OptionRow id="lbl-var" checked={showVariation} onCheckedChange={setShowVariation} label="Show variation" />
                <OptionRow id="lbl-price" checked={showPrice} onCheckedChange={setShowPrice} label="Show price" />
                <OptionRow id="lbl-pack" checked={showPacking} onCheckedChange={setShowPacking} label="Show packing details" />
                <OptionRow
                  id="lbl-co"
                  checked={showCompany}
                  onCheckedChange={setShowCompany}
                  label={`Show company name${companyName ? ` (${companyName})` : ''}`}
                />
                <OptionRow
                  id="lbl-br"
                  checked={showBranch}
                  onCheckedChange={setShowBranch}
                  label={`Show branch name${branchName ? ` (${branchName})` : ''}`}
                />
              </div>
            </div>
            {previewJob && (
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Preview</p>
                <div className="bg-white text-black p-3 rounded shadow-lg text-center space-y-1 text-xs">
                  {showCompany && companyName && (
                    <p className="text-[8px] font-bold uppercase text-gray-600">{companyName}</p>
                  )}
                  {showBranch && branchName && <p className="text-[8px] text-gray-500">{branchName}</p>}
                  {showName && <p className="font-bold leading-tight">{previewJob.productName}</p>}
                  {showVariation && previewJob.variationName && (
                    <p className="text-[9px] text-gray-600">{previewJob.variationName}</p>
                  )}
                  <div className="h-8 flex justify-center gap-px my-1">
                    {[...Array(20)].map((_, i) => (
                      <div key={i} className="bg-black" style={{ width: 2, height: '100%' }} />
                    ))}
                  </div>
                  <p className="font-mono tracking-widest">{previewJob.barcode}</p>
                  {showPacking && previewJob.packingSummary && (
                    <p className="text-[9px]">{previewJob.packingSummary}</p>
                  )}
                  {showPrice && previewJob.price != null && (
                    <p className="font-bold">Rs. {Number(previewJob.price).toLocaleString('en-PK')}</p>
                  )}
                </div>
              </div>
            )}
            {error && <p className="text-sm text-red-400">{error}</p>}
          </div>
        </div>

        <DialogFooter className="p-4 border-t border-gray-800 shrink-0 gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy} className="text-gray-400">
            Cancel
          </Button>
          <Button
            onClick={handlePrint}
            disabled={busy || totalLabels === 0}
            className="bg-blue-600 hover:bg-blue-500"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Printer className="w-4 h-4 mr-2" />}
            Print {totalLabels} label{totalLabels === 1 ? '' : 's'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
