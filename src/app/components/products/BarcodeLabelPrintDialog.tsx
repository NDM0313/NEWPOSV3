import React, { useState, useEffect, useMemo } from 'react';
import { Printer, Barcode as BarcodeIcon, Loader2, Minus, Plus, Eye, Search, Settings2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import { Checkbox } from '@/app/components/ui/checkbox';
import { Input } from '@/app/components/ui/input';
import type { BarcodeLabelSettings } from '@/app/services/barcodeLabelSettingsService';
import { setBarcodeLabelSettings } from '@/app/services/barcodeLabelSettingsService';
import {
  printProductLabelsBatch,
  flattenLinesToJobs,
  buildA4SheetHtml,
  previewLabelsInBrowser,
  type LabelPrintLine,
} from '@/app/services/barcodeLabelPrint';
import { countSelectedLabels, hasPrintableCode } from '@/app/lib/barcodeLabelLines';
import { presetIdFromLayout, type BarcodeLabelPresetId } from '@/app/lib/barcodeLabelPresets';
import { cn } from '@/app/components/ui/utils';
import { toast } from 'sonner';
import { BarcodeLabelPreviewCard, A4SheetMiniPreview } from './barcodeLabelPreview';
import { BarcodeLabelContentFields, BarcodeLabelSheetLayoutFields } from './BarcodeLabelLayoutFields';
import { useNavigation } from '@/app/context/NavigationContext';
import { useSettings } from '@/app/context/SettingsContext';
import { writeSettingsHash } from '@/app/components/settings/settingsNavigation';

export interface BarcodeLabelPrintDialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  lines: LabelPrintLine[];
  labelSettings: BarcodeLabelSettings;
  companyName?: string;
  branchName?: string;
  companyId?: string;
}

export function BarcodeLabelPrintDialog({
  open,
  onClose,
  title = 'Print barcode labels',
  lines: initialLines,
  labelSettings,
  companyName,
  branchName,
  companyId,
}: BarcodeLabelPrintDialogProps) {
  const { setCurrentView } = useNavigation();
  const { company } = useSettings();
  const labelPrintCtx = useMemo(
    () => ({
      companyName,
      branchName,
      currency: company.currency,
      decimalPrecision: company.decimalPrecision,
      showCurrencySymbol: company.showCurrencySymbol,
      currencySymbol: company.currencySymbol,
    }),
    [companyName, branchName, company.currency, company.decimalPrecision, company.showCurrencySymbol, company.currencySymbol],
  );
  const [rows, setRows] = useState<LabelPrintLine[]>([]);
  const [showName, setShowName] = useState(labelSettings.showName);
  const [showPrice, setShowPrice] = useState(labelSettings.showPrice);
  const [showVariation, setShowVariation] = useState(labelSettings.showVariation);
  const [showPacking, setShowPacking] = useState(labelSettings.showPacking);
  const [showCompany, setShowCompany] = useState(labelSettings.showCompanyName);
  const [showBranch, setShowBranch] = useState(labelSettings.showBranchName);
  const [a4Columns, setA4Columns] = useState(labelSettings.a4Columns);
  const [maxLabelsPerSheet, setMaxLabelsPerSheet] = useState(labelSettings.maxLabelsPerSheet);
  const [presetId, setPresetId] = useState<BarcodeLabelPresetId>(() =>
    presetIdFromLayout(labelSettings.a4Columns, labelSettings.maxLabelsPerSheet)
  );
  const [previewLineKey, setPreviewLineKey] = useState<string | null>(null);
  const [productFilter, setProductFilter] = useState('');
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
    setA4Columns(labelSettings.a4Columns);
    setMaxLabelsPerSheet(labelSettings.maxLabelsPerSheet);
    setPresetId(presetIdFromLayout(labelSettings.a4Columns, labelSettings.maxLabelsPerSheet));
    const first =
      initialLines.find((l) => l.selected && hasPrintableCode(l)) ??
      initialLines.find(hasPrintableCode);
    setPreviewLineKey(first?.lineKey ?? initialLines[0]?.lineKey ?? null);
    setProductFilter('');
    setError(null);
  }, [open, initialLines, labelSettings]);

  const totalLabels = useMemo(() => countSelectedLabels(rows), [rows]);
  const selectedRows = rows.filter((r) => r.selected);
  const missingCodeCount = selectedRows.filter((r) => !hasPrintableCode(r)).length;

  const displayOptions = useMemo(
    () => ({
      showName,
      showPrice,
      showVariation,
      showPacking,
      showCompany,
      showBranch,
    }),
    [showName, showPrice, showVariation, showPacking, showCompany, showBranch]
  );

  const fieldOptions = displayOptions;

  const filteredRows = useMemo(() => {
    const q = productFilter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const name = r.productName.toLowerCase();
      const sku = (r.sku || r.barcode || '').toLowerCase();
      return name.includes(q) || sku.includes(q);
    });
  }, [rows, productFilter]);

  const buildSettings = (): BarcodeLabelSettings => ({
    ...labelSettings,
    labelLayout: 'a4',
    a4Columns,
    maxLabelsPerSheet,
    showName,
    showPrice,
    showVariation,
    showPacking,
    showCompanyName: showCompany,
    showBranchName: showBranch,
    showBusinessName: showCompany,
  });

  const previewLine = useMemo(() => {
    if (previewLineKey) {
      const hit = rows.find((r) => r.lineKey === previewLineKey);
      if (hit) return hit;
    }
    return (
      rows.find((r) => r.selected && hasPrintableCode(r)) ??
      rows.find(hasPrintableCode) ??
      rows[0] ??
      null
    );
  }, [rows, previewLineKey]);

  const previewJob = useMemo(() => {
    if (!previewLine) return null;
    const jobs = flattenLinesToJobs(
      [{ ...previewLine, selected: true, labelCount: 1 }],
      { companyName, branchName }
    );
    return jobs[0] ?? null;
  }, [previewLine, companyName, branchName]);

  const printablePreviewLines = useMemo(() => rows.filter((r) => hasPrintableCode(r)), [rows]);

  const updateRow = (lineKey: string, patch: Partial<LabelPrintLine>) => {
    setRows((prev) => prev.map((r) => (r.lineKey === lineKey ? { ...r, ...patch } : r)));
  };

  const toggleAll = (selected: boolean) => {
    setRows((prev) => prev.map((r) => ({ ...r, selected })));
  };

  const validateBeforePrint = (): boolean => {
    if (totalLabels === 0 || missingCodeCount > 0) {
      setError(
        missingCodeCount > 0
          ? `${missingCodeCount} selected item(s) need a barcode or SKU.`
          : 'Select at least one product with quantity > 0.'
      );
      return false;
    }
    return true;
  };

  const handlePreviewSheet = () => {
    if (!validateBeforePrint()) return;
    setError(null);
    try {
      const settings = buildSettings();
      const jobs = flattenLinesToJobs(rows, labelPrintCtx);
      previewLabelsInBrowser(buildA4SheetHtml(jobs, settings, labelPrintCtx));
      toast.success('Sheet preview opened in a new tab');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Preview failed';
      setError(msg);
      toast.error(msg);
    }
  };

  const handlePrint = async () => {
    if (!validateBeforePrint()) return;
    setBusy(true);
    setError(null);
    const settings = buildSettings();
    const res = printProductLabelsBatch(rows, settings, labelPrintCtx);
    setBusy(false);
    if (!res.ok) {
      setError(res.hint || 'Print failed');
      toast.error(res.hint || 'Print failed');
      return;
    }
    if (companyId) {
      try {
        await setBarcodeLabelSettings(companyId, settings);
      } catch {
        /* non-blocking */
      }
    }
    toast.success(`Printing ${res.printedCount} label(s)`);
    onClose();
  };

  const openInventoryLabelSettings = () => {
    writeSettingsHash('operations', 'inventoryGeneral');
    setCurrentView('settings');
    onClose();
    toast.info('Open Inventory → Barcode label printing below');
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className={cn(
          'p-0 gap-0 flex flex-col overflow-hidden',
          'w-[min(96vw,1400px)] max-w-[96vw] sm:max-w-[96vw]',
          'h-[min(92vh,920px)] max-h-[92vh] min-h-[min(720px,85vh)]',
          'bg-gray-900 text-white border-gray-700'
        )}
      >
        <DialogHeader className="p-4 border-b border-gray-800 shrink-0 text-left">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <BarcodeIcon className="text-blue-500 shrink-0" size={22} />
            <span className="truncate">{title}</span>
          </DialogTitle>
          <p className="text-xs text-gray-500 mt-0.5">
            {totalLabels} label{totalLabels === 1 ? '' : 's'} · {selectedRows.length} product
            {selectedRows.length === 1 ? '' : 's'} · A4 print
          </p>
          <p className="text-xs text-gray-400">Configure labels and preview before printing</p>
        </DialogHeader>

        <div className="flex flex-1 min-h-0 flex-col lg:flex-row overflow-hidden">
          {/* Products */}
          <div className="flex-1 min-w-0 flex flex-col border-b lg:border-b-0 lg:border-r border-gray-800 min-h-[240px] lg:min-h-0">
            <div className="px-4 py-3 border-b border-gray-800 shrink-0 space-y-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Products to print</p>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <Input
                  value={productFilter}
                  onChange={(e) => setProductFilter(e.target.value)}
                  placeholder="Filter by name or SKU…"
                  className="pl-9 h-9 bg-gray-950 border-gray-700 text-white text-sm"
                />
              </div>
              <div className="flex gap-2 text-xs">
                <button type="button" onClick={() => toggleAll(true)} className="text-blue-400 font-medium">
                  Select all
                </button>
                <span className="text-gray-600">|</span>
                <button type="button" onClick={() => toggleAll(false)} className="text-gray-400">
                  Clear
                </button>
              </div>
            </div>
            <div className="hidden sm:grid grid-cols-[auto_1fr_auto_auto] gap-2 px-4 py-2 text-[10px] uppercase tracking-wide text-gray-500 border-b border-gray-800 shrink-0">
              <span />
              <span>Product</span>
              <span className="text-center">Labels</span>
              <span>SKU</span>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
              {filteredRows.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">No products match filter</p>
              ) : (
                filteredRows.map((row) => {
                  const code = (row.barcode || row.sku || '').trim();
                  const noCode = row.selected && !code;
                  return (
                    <div
                      key={row.lineKey}
                      className={cn(
                        'rounded-lg border p-3',
                        noCode ? 'border-red-500/40 bg-red-500/5' : 'border-gray-700 bg-gray-800/50',
                        previewLineKey === row.lineKey && 'ring-1 ring-blue-500/50'
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Checkbox
                          checked={row.selected}
                          onCheckedChange={(c) => updateRow(row.lineKey, { selected: c === true })}
                          className="shrink-0 border-gray-500 data-[state=checked]:bg-blue-600"
                        />
                        <button
                          type="button"
                          className="flex-1 min-w-0 text-left"
                          onClick={() => setPreviewLineKey(row.lineKey)}
                        >
                          <p className="text-sm font-medium text-white truncate">{row.productName}</p>
                          {row.variationName && (
                            <p className="text-[10px] text-purple-400 truncate">{row.variationName}</p>
                          )}
                        </button>
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
                        <p className="hidden sm:block text-xs text-gray-500 font-mono w-24 truncate shrink-0">
                          {code || '—'}
                        </p>
                      </div>
                      <p className="sm:hidden text-xs text-gray-500 font-mono mt-1 truncate">{code || 'No SKU'}</p>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Settings */}
          <div className="w-full lg:w-80 shrink-0 p-4 space-y-4 overflow-y-auto border-b lg:border-b-0 lg:border-r border-gray-800 bg-gray-950/40 max-h-[50vh] lg:max-h-none">
            <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4 space-y-3">
              <p className="text-xs text-gray-500 uppercase tracking-wide">On each label</p>
              <BarcodeLabelContentFields
                idPrefix="dlg"
                options={fieldOptions}
                onChange={(patch) => {
                  if (patch.showName !== undefined) setShowName(patch.showName);
                  if (patch.showPrice !== undefined) setShowPrice(patch.showPrice);
                  if (patch.showVariation !== undefined) setShowVariation(patch.showVariation);
                  if (patch.showPacking !== undefined) setShowPacking(patch.showPacking);
                  if (patch.showCompany !== undefined) setShowCompany(patch.showCompany);
                  if (patch.showBranch !== undefined) setShowBranch(patch.showBranch);
                }}
                companyName={companyName}
                branchName={branchName}
              />
            </div>
            <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4 space-y-3">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Sheet layout</p>
              <BarcodeLabelSheetLayoutFields
                presetId={presetId}
                onPresetChange={setPresetId}
                a4Columns={a4Columns}
                onA4ColumnsChange={(n) => {
                  setA4Columns(n);
                  setPresetId(presetIdFromLayout(n, maxLabelsPerSheet));
                }}
                maxLabelsPerSheet={maxLabelsPerSheet}
                onMaxLabelsPerSheetChange={(n) => {
                  setMaxLabelsPerSheet(n);
                  setPresetId(presetIdFromLayout(a4Columns, n));
                }}
              />
            </div>
            <button
              type="button"
              onClick={openInventoryLabelSettings}
              className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1.5"
            >
              <Settings2 size={14} />
              Edit company defaults in Settings → Inventory
            </button>
          </div>

          {/* Preview */}
          <div className="w-full lg:w-[360px] shrink-0 p-4 space-y-4 overflow-y-auto bg-gray-950/60 lg:sticky lg:top-0 lg:self-start max-h-[50vh] lg:max-h-full">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Label preview</p>
              <p className="text-[10px] text-gray-500 mb-3">Updates as you change options</p>
              {printablePreviewLines.length > 1 && (
                <select
                  value={previewLineKey ?? ''}
                  onChange={(e) => setPreviewLineKey(e.target.value)}
                  className="w-full mb-3 h-9 rounded bg-gray-950 border border-gray-700 text-white text-sm px-2"
                >
                  {printablePreviewLines.map((r) => (
                    <option key={r.lineKey} value={r.lineKey}>
                      {r.productName}
                    </option>
                  ))}
                </select>
              )}
              <BarcodeLabelPreviewCard
                job={previewJob}
                companyName={companyName}
                branchName={branchName}
                {...displayOptions}
                large
                className="w-full"
              />
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Sheet preview</p>
              <A4SheetMiniPreview
                totalLabels={totalLabels}
                maxLabelsPerSheet={maxLabelsPerSheet}
                a4Columns={a4Columns}
                firstLabel={previewJob}
                display={displayOptions}
                companyName={companyName}
                branchName={branchName}
                largeSheet
              />
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
          </div>
        </div>

        <DialogFooter className="p-4 border-t border-gray-800 shrink-0 gap-2 flex-wrap sm:flex-nowrap">
          <Button variant="ghost" onClick={onClose} disabled={busy} className="text-gray-400">
            Cancel
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handlePreviewSheet}
            disabled={busy || totalLabels === 0}
            className="border-gray-600 text-gray-200 gap-2"
          >
            <Eye size={16} />
            Preview sheet
          </Button>
          <Button
            onClick={() => void handlePrint()}
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
