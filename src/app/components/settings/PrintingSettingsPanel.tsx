/**
 * Centralized ERP Printing settings.
 * Settings → Printing: two-column layout — Left: settings controls, Right: live document preview.
 */
import React, { useState } from 'react';
import { Printer, FileText, Layout, FileStack, ToggleLeft, Thermometer, FileDown, Save } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import {
  type CompanyPrintingSettings,
  type PageSetup,
  type LayoutEditor,
  type DocumentTemplateId,
  type InvoiceTypeId,
  mergeWithDefaults,
} from '@/app/types/printingSettings';
import { PrintingPreviewPanel } from './PrintingPreviewPanel';

const DOCUMENT_LABELS: Record<DocumentTemplateId, string> = {
  sales_invoice: 'Sales Invoice',
  purchase_invoice: 'Purchase Invoice',
  ledger_statement: 'Ledger Statement',
  payment_receipt: 'Payment Receipt',
  packing_list: 'Packing List',
  delivery_note: 'Delivery Note',
  courier_slip: 'Courier Slip',
};

const INVOICE_TYPE_LABELS: Record<InvoiceTypeId, string> = {
  standard: 'Standard Invoice',
  packing: 'Packing Invoice',
  pieces: 'Pieces Invoice',
  summary: 'Summary Invoice',
  detailed: 'Detailed Invoice',
};

type PrintingSubTab = 'general' | 'documentTemplates' | 'pageSetup' | 'fields' | 'layoutEditor' | 'thermalPrint' | 'pdfExport';

interface PrintingSettingsPanelProps {
  subTabId: string;
  settings: CompanyPrintingSettings | null;
  loading: boolean;
  saving: boolean;
  onSettingsChange: (partial: Partial<CompanyPrintingSettings>) => void;
  onSave: () => void;
}

export function PrintingSettingsPanel({
  subTabId,
  settings,
  loading,
  saving,
  onSettingsChange,
  onSave,
}: PrintingSettingsPanelProps) {
  const merged = mergeWithDefaults(settings);
  const tab: PrintingSubTab = ['general', 'documentTemplates', 'pageSetup', 'fields', 'layoutEditor', 'thermalPrint', 'pdfExport'].includes(subTabId)
    ? (subTabId as PrintingSubTab)
    : 'general';

  const [previewDocument, setPreviewDocument] = useState<DocumentTemplateId>('sales_invoice');

  const update = <K extends keyof CompanyPrintingSettings>(key: K, value: CompanyPrintingSettings[K]) => {
    onSettingsChange({ [key]: value });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-slate-500/10 rounded-lg">
            <Printer className="text-slate-400" size={24} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Printing</h3>
            <p className="text-sm text-gray-400">Loading…</p>
          </div>
        </div>
        <div className="p-8 text-center text-gray-400">Loading printing settings...</div>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 xl:grid-cols-[1fr,minmax(380px,32%)] gap-6 xl:gap-8">
        {/* LEFT: Settings controls */}
        <div className="min-w-0 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-slate-500/10 rounded-lg shrink-0">
                <Printer className="text-slate-400" size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Printing</h3>
                <p className="text-sm text-gray-400">Settings update the live preview on the right.</p>
              </div>
            </div>
            <Button
              className="bg-blue-600 hover:bg-blue-500 text-white gap-2 shrink-0"
              disabled={saving}
              onClick={onSave}
            >
              {saving ? <span className="animate-spin">⟳</span> : <Save size={16} />}
              Save
            </Button>
          </div>
          <div className="space-y-6 overflow-auto pr-1">
      {/* General */}
      {tab === 'general' && (
        <div className="space-y-6">
          <section className="bg-gray-950 border border-gray-800 rounded-lg p-6">
            <h4 className="text-white font-semibold mb-4 flex items-center gap-2">
              <FileText size={18} /> General
            </h4>
            <p className="text-sm text-gray-400 mb-4">
              Default typography: Inter, Roboto, or Arial. Header 16px, table 12px, footer 11px. All documents use the same layout engine.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-300">Default invoice type</Label>
                <select
                  value={merged.defaultInvoiceType}
                  onChange={(e) => update('defaultInvoiceType', e.target.value as InvoiceTypeId)}
                  className="mt-1 w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2"
                >
                  {(Object.keys(INVOICE_TYPE_LABELS) as InvoiceTypeId[]).map((id) => (
                    <option key={id} value={id}>{INVOICE_TYPE_LABELS[id]}</option>
                  ))}
                </select>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* Document Templates */}
      {tab === 'documentTemplates' && (
        <div className="space-y-6">
          <section className="bg-gray-950 border border-gray-800 rounded-lg p-6">
            <h4 className="text-white font-semibold mb-4 flex items-center gap-2">
              <FileStack size={18} /> Document Templates
            </h4>
            <p className="text-sm text-gray-400 mb-4">
              Documents that use this printing engine. Same typography and layout for all.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(Object.keys(DOCUMENT_LABELS) as DocumentTemplateId[]).map((id) => (
                <label key={id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-800 hover:bg-gray-800/50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={merged.documentTemplates.includes(id)}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...merged.documentTemplates, id]
                        : merged.documentTemplates.filter((x) => x !== id);
                      update('documentTemplates', next);
                    }}
                    className="rounded border-gray-600 bg-gray-800 text-blue-500"
                  />
                  <span className="text-white">{DOCUMENT_LABELS[id]}</span>
                </label>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* Page Setup */}
      {tab === 'pageSetup' && (
        <div className="space-y-6">
          <section className="bg-gray-950 border border-gray-800 rounded-lg p-6 space-y-4">
            <h4 className="text-white font-semibold flex items-center gap-2">
              <Layout size={18} /> Page Setup
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-300">Page size</Label>
                <select
                  value={merged.pageSetup.pageSize}
                  onChange={(e) => update('pageSetup', { ...merged.pageSetup, pageSize: e.target.value as PageSetup['pageSize'] })}
                  className="mt-1 w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2"
                >
                  <option value="A4">A4</option>
                  <option value="Legal">Legal</option>
                  <option value="Letter">Letter</option>
                  <option value="Thermal58mm">Thermal 58mm</option>
                  <option value="Thermal80mm">Thermal 80mm</option>
                </select>
              </div>
              <div>
                <Label className="text-gray-300">Orientation</Label>
                <select
                  value={merged.pageSetup.orientation}
                  onChange={(e) => update('pageSetup', { ...merged.pageSetup, orientation: e.target.value as PageSetup['orientation'] })}
                  className="mt-1 w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2"
                >
                  <option value="portrait">Portrait</option>
                  <option value="landscape">Landscape</option>
                </select>
              </div>
            </div>
            <div>
              <Label className="text-gray-300 mb-2 block">Margins (mm)</Label>
              <div className="grid grid-cols-4 gap-2">
                {(['top', 'bottom', 'left', 'right'] as const).map((side) => (
                  <div key={side}>
                    <Label className="text-xs text-gray-500 capitalize">{side}</Label>
                    <Input
                      type="number"
                      min={0}
                      value={merged.pageSetup.margins[side]}
                      onChange={(e) =>
                        update('pageSetup', {
                          ...merged.pageSetup,
                          margins: { ...merged.pageSetup.margins, [side]: Number(e.target.value) || 0 },
                        })
                      }
                      className="mt-0.5 bg-gray-800 border-gray-700 text-white"
                    />
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      )}

      {/* Fields */}
      {tab === 'fields' && (
        <div className="space-y-6">
          <section className="bg-gray-950 border border-gray-800 rounded-lg p-6">
            <h4 className="text-white font-semibold mb-4 flex items-center gap-2">
              <ToggleLeft size={18} /> Fields configuration
            </h4>
            <p className="text-sm text-gray-400 mb-4">
              Choose which fields appear on printed documents.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {([
                'showLogo', 'showCompanyAddress', 'showPhone', 'showEmail', 'showCustomerAddress',
                'showSku', 'showDiscount', 'showTax', 'showBarcode', 'showQRCode',
                'showSignature', 'showTerms', 'showNotes', 'showStudioCost',
              ] as const).map((key) => (
                <div key={key} className="flex items-center justify-between">
                  <Label className="text-gray-300 capitalize">
                    {key.replace(/^show/, '').replace(/([A-Z])/g, ' $1').trim()}
                  </Label>
                  <Switch
                    checked={merged.fields[key] ?? false}
                    onCheckedChange={(v) => update('fields', { ...merged.fields, [key]: v })}
                  />
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* Layout Editor */}
      {tab === 'layoutEditor' && (
        <div className="space-y-6">
          <section className="bg-gray-950 border border-gray-800 rounded-lg p-6 space-y-6">
            <h4 className="text-white font-semibold flex items-center gap-2">
              <Layout size={18} /> Layout editor
            </h4>
            <p className="text-sm text-gray-400">
              Header, table, and footer positions. Manual customization for logo, company details, and signature.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-gray-300">Logo position</Label>
                <select
                  value={merged.layout.header.logoPosition}
                  onChange={(e) =>
                    update('layout', {
                      ...merged.layout,
                      header: { ...merged.layout.header, logoPosition: e.target.value as LayoutEditor['header']['logoPosition'] },
                    })
                  }
                  className="mt-1 w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2"
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </div>
              <div>
                <Label className="text-gray-300">Company details position</Label>
                <select
                  value={merged.layout.header.companyDetailsPosition}
                  onChange={(e) =>
                    update('layout', {
                      ...merged.layout,
                      header: { ...merged.layout.header, companyDetailsPosition: e.target.value as LayoutEditor['header']['companyDetailsPosition'] },
                    })
                  }
                  className="mt-1 w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2"
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </div>
              <div>
                <Label className="text-gray-300">Invoice title position</Label>
                <select
                  value={merged.layout.header.invoiceTitlePosition}
                  onChange={(e) =>
                    update('layout', {
                      ...merged.layout,
                      header: { ...merged.layout.header, invoiceTitlePosition: e.target.value as LayoutEditor['header']['invoiceTitlePosition'] },
                    })
                  }
                  className="mt-1 w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2"
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </div>
            </div>
            <div>
              <Label className="text-gray-300">Table alignment</Label>
              <select
                value={merged.layout.table.alignment}
                onChange={(e) =>
                  update('layout', {
                    ...merged.layout,
                    table: { ...merged.layout.table, alignment: e.target.value as LayoutEditor['table']['alignment'] },
                  })
                }
                className="mt-1 w-full max-w-xs bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2"
              >
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-gray-300">Signature position</Label>
                <select
                  value={merged.layout.footer.signaturePosition}
                  onChange={(e) =>
                    update('layout', {
                      ...merged.layout,
                      footer: { ...merged.layout.footer, signaturePosition: e.target.value as LayoutEditor['footer']['signaturePosition'] },
                    })
                  }
                  className="mt-1 w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2"
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </div>
              <div>
                <Label className="text-gray-300">Terms position</Label>
                <select
                  value={merged.layout.footer.termsPosition}
                  onChange={(e) =>
                    update('layout', {
                      ...merged.layout,
                      footer: { ...merged.layout.footer, termsPosition: e.target.value as LayoutEditor['footer']['termsPosition'] },
                    })
                  }
                  className="mt-1 w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2"
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </div>
              <div>
                <Label className="text-gray-300">Notes position</Label>
                <select
                  value={merged.layout.footer.notesPosition}
                  onChange={(e) =>
                    update('layout', {
                      ...merged.layout,
                      footer: { ...merged.layout.footer, notesPosition: e.target.value as LayoutEditor['footer']['notesPosition'] },
                    })
                  }
                  className="mt-1 w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2"
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* Thermal Print */}
      {tab === 'thermalPrint' && (
        <div className="space-y-6">
          <section className="bg-gray-950 border border-gray-800 rounded-lg p-6">
            <h4 className="text-white font-semibold mb-4 flex items-center gap-2">
              <Thermometer size={18} /> Thermal print (58mm / 80mm)
            </h4>
            <p className="text-sm text-gray-400 mb-4">
              POS receipt and thermal printer options.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(['showLogo', 'showQR', 'showCashier', 'compactMode'] as const).map((key) => (
                <div key={key} className="flex items-center justify-between">
                  <Label className="text-gray-300">
                    {key === 'showQR' ? 'Show QR' : key === 'showCashier' ? 'Show Cashier' : key === 'compactMode' ? 'Compact mode' : 'Show Logo'}
                  </Label>
                  <Switch
                    checked={merged.thermal[key]}
                    onCheckedChange={(v) => update('thermal', { ...merged.thermal, [key]: v })}
                  />
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* PDF Export */}
      {tab === 'pdfExport' && (
        <div className="space-y-6">
          <section className="bg-gray-950 border border-gray-800 rounded-lg p-6">
            <h4 className="text-white font-semibold mb-4 flex items-center gap-2">
              <FileDown size={18} /> PDF export
            </h4>
            <p className="text-sm text-gray-400 mb-4">
              Font and size for PDF generation. Recommended: Inter, Roboto, Arial.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-300">Font family</Label>
                <select
                  value={merged.pdf.fontFamily}
                  onChange={(e) => update('pdf', { ...merged.pdf, fontFamily: e.target.value })}
                  className="mt-1 w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2"
                >
                  <option value="Inter">Inter</option>
                  <option value="Roboto">Roboto</option>
                  <option value="Arial">Arial</option>
                </select>
              </div>
              <div>
                <Label className="text-gray-300">Font size (px)</Label>
                <Input
                  type="number"
                  min={10}
                  max={14}
                  value={merged.pdf.fontSize}
                  onChange={(e) => update('pdf', { ...merged.pdf, fontSize: Number(e.target.value) || 12 })}
                  className="mt-1 bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div className="flex items-center justify-between col-span-2">
                <Label className="text-gray-300">Include watermark</Label>
                <Switch
                  checked={merged.pdf.includeWatermark}
                  onCheckedChange={(v) => update('pdf', { ...merged.pdf, includeWatermark: v })}
                />
              </div>
            </div>
          </section>
        </div>
      )}
          </div>
        </div>

        {/* RIGHT: Live document preview (sticky so it stays visible while scrolling left panel) */}
        <div className="xl:sticky xl:top-24 xl:self-start xl:min-h-[560px] flex flex-col min-w-0 border border-gray-800 rounded-xl bg-gray-900/50 overflow-hidden">
          <PrintingPreviewPanel
            settings={settings}
            previewDocument={previewDocument}
            onPreviewDocumentChange={setPreviewDocument}
          />
        </div>
      </div>
    </>
  );
}
