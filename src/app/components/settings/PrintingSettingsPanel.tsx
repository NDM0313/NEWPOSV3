/**
 * Centralized ERP Printing settings — simplified 4-mode layout.
 * A4 Documents | Thermal Receipts | Reports & Export | Advanced
 */
import React, { useState } from 'react';
import {
  Printer, FileText, Layout, FileStack, ToggleLeft, Thermometer, FileDown, Save, ChevronDown, BarChart3,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import {
  type CompanyPrintingSettings,
  type LayoutEditor,
  type DocumentTemplateId,
  type InvoiceTypeId,
  type PageSetup,
  mergeWithDefaults,
} from '@/app/types/printingSettings';
import { resolveLedgerPrintOptions } from '@/app/components/reports/shared/resolveLedgerPrintOptions';
import { resolveAccountingReportPrintOptions } from '@/app/components/reports/shared/resolveAccountingReportPrintOptions';
import { POS_SILENT_PRINT_GUIDE, getPosPrintAutomationHint } from '@/app/services/printingSettingsService';
import { PrintingPreviewPanel } from './PrintingPreviewPanel';
import { AppliesToBanner } from './printing/AppliesToBanner';
import { ReportExportPreviewPanel } from './printing/ReportExportPreviewPanel';
import { ThermalReceiptPreviewPanel } from './printing/ThermalReceiptPreviewPanel';
import { InvoiceTemplatesSettingsSection, type InvoiceTemplatesSettingsSectionProps } from './printing/InvoiceTemplatesSettingsSection';
import { LegacyPrinterSettingsSection } from './printing/LegacyPrinterSettingsSection';
import type { usePrinterConfig } from '@/app/hooks/usePrinterConfig';

const DOCUMENT_LABELS: Record<DocumentTemplateId, string> = {
  sales_invoice: 'Sales Invoice',
  purchase_invoice: 'Purchase Invoice',
  ledger_statement: 'Ledger Statement',
  payment_receipt: 'Payment Receipt',
  packing_list: 'Packing List',
  delivery_note: 'Delivery Note',
  courier_slip: 'Courier Slip',
  quotation: 'Quotation',
  proforma_invoice: 'Proforma Invoice',
};

const INVOICE_TYPE_LABELS: Record<InvoiceTypeId, string> = {
  standard: 'Standard Invoice',
  packing: 'Packing Invoice',
  pieces: 'Pieces Invoice',
  summary: 'Summary Invoice',
  detailed: 'Detailed Invoice',
};

const A4_PAGE_SIZES: PageSetup['pageSize'][] = ['A4', 'Legal', 'Letter'];

const REPORT_FIELD_KEYS = ['showLogo', 'showCompanyAddress', 'showPhone', 'showEmail'] as const;

type PrintingMode = 'a4Documents' | 'thermalReceipts' | 'reportsExport' | 'advanced';

type PrinterHook = ReturnType<typeof usePrinterConfig>;

interface PrintingSettingsPanelProps {
  subTabId: string;
  settings: CompanyPrintingSettings | null;
  loading: boolean;
  saving: boolean;
  onSettingsChange: (partial: Partial<CompanyPrintingSettings>) => void;
  onSave: () => void;
  printer?: PrinterHook;
  invoiceTemplates?: Omit<InvoiceTemplatesSettingsSectionProps, 'loading' | 'saving'> & {
    loading: boolean;
    saving: boolean;
  };
}

function resolveTab(subTabId: string): PrintingMode {
  const map: Record<string, PrintingMode> = {
    a4Documents: 'a4Documents',
    thermalReceipts: 'thermalReceipts',
    reportsExport: 'reportsExport',
    advanced: 'advanced',
    // legacy hash routes → redirect mentally to closest tab
    general: 'a4Documents',
    documentTemplates: 'advanced',
    pageSetup: 'a4Documents',
    fields: 'a4Documents',
    layoutEditor: 'a4Documents',
    thermalPrint: 'thermalReceipts',
    pdfExport: 'a4Documents',
  };
  return map[subTabId] ?? 'a4Documents';
}

function SectionCard({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="bg-input-background border border-border rounded-lg p-5 space-y-4">
      <h4 className="text-foreground font-semibold flex items-center gap-2">{icon}{title}</h4>
      {children}
    </section>
  );
}

export function PrintingSettingsPanel({
  subTabId,
  settings,
  loading,
  saving,
  onSettingsChange,
  onSave,
  printer,
  invoiceTemplates,
}: PrintingSettingsPanelProps) {
  const merged = mergeWithDefaults(settings);
  const tab = resolveTab(subTabId);
  const ledgerPrintOptions = resolveLedgerPrintOptions(settings);
  const roznamchaPrintOptions = resolveAccountingReportPrintOptions(settings, 'roznamcha');
  const [previewDocument, setPreviewDocument] = useState<DocumentTemplateId>('sales_invoice');
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const update = <K extends keyof CompanyPrintingSettings>(key: K, value: CompanyPrintingSettings[K]) => {
    onSettingsChange({ [key]: value });
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-muted-foreground">Loading printing settings…</div>
    );
  }

  const headerBlock = (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-slate-500/10 rounded-lg shrink-0">
          <Printer className="text-slate-400" size={24} />
        </div>
        <div>
          <h3 className="text-xl font-bold text-foreground">Documents & Printing</h3>
          <p className="text-sm text-muted-foreground">
            A4 invoices alag, Thermal receipts alag, Reports alag — Save ke baad apply hota hai.
          </p>
        </div>
      </div>
      <Button className="bg-blue-600 hover:bg-blue-500 text-white gap-2 shrink-0" disabled={saving} onClick={onSave}>
        {saving ? <span className="animate-spin">⟳</span> : <Save size={16} />}
        Save
      </Button>
    </div>
  );

  const showA4Preview = tab === 'a4Documents';
  const showThermalPreview = tab === 'thermalReceipts';
  const showReportPreview = tab === 'reportsExport';

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr,minmax(340px,34%)] gap-6 xl:gap-8">
      <div className="min-w-0 flex flex-col">
        {headerBlock}
        <div className="space-y-5 overflow-auto pr-1 pb-4">

          {/* ─── A4 DOCUMENTS ─── */}
          {tab === 'a4Documents' && (
            <>
              <AppliesToBanner targets="Sales/Purchase Invoice, Ledger, Receipt, Quotation, Proforma, Packing, Courier — unified A4 engine." />
              <p className="text-xs text-muted-foreground -mt-3">
                Ledger PDF orientation and report header/footer: use <strong className="text-muted-foreground">Reports &amp; Export</strong> tab.
                A4 page orientation here applies to invoices; ledger uses report export orientation (A4 orientation as fallback).
              </p>

              <SectionCard title="Page setup" icon={<Layout size={18} />}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Page size (A4 only)</Label>
                    <select
                      value={A4_PAGE_SIZES.includes(merged.pageSetup.pageSize) ? merged.pageSetup.pageSize : 'A4'}
                      onChange={(e) =>
                        update('pageSetup', { ...merged.pageSetup, pageSize: e.target.value as PageSetup['pageSize'] })
                      }
                      className="mt-1 w-full bg-muted border border-border text-foreground rounded-lg px-3 py-2"
                    >
                      {A4_PAGE_SIZES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Orientation</Label>
                    <select
                      value={merged.pageSetup.orientation}
                      onChange={(e) =>
                        update('pageSetup', { ...merged.pageSetup, orientation: e.target.value as PageSetup['orientation'] })
                      }
                      className="mt-1 w-full bg-muted border border-border text-foreground rounded-lg px-3 py-2"
                    >
                      <option value="portrait">Portrait</option>
                      <option value="landscape">Landscape</option>
                    </select>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground mb-2 block">Margins (mm)</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {(['top', 'bottom', 'left', 'right'] as const).map((side) => (
                      <div key={side}>
                        <Label className="text-xs text-muted-foreground capitalize">{side}</Label>
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
                          className="mt-0.5 bg-muted border-border text-foreground"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </SectionCard>

              <SectionCard title="Header & footer fields" icon={<ToggleLeft size={18} />}>
                <p className="text-xs text-muted-foreground -mt-2">Company logo/address also used on tabular reports (Reports tab).</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {([
                    ['showLogo', 'Logo'],
                    ['showCompanyAddress', 'Company address'],
                    ['showPhone', 'Phone'],
                    ['showEmail', 'Email'],
                    ['showCustomerAddress', 'Customer address'],
                    ['showSku', 'SKU'],
                    ['showDiscount', 'Discount'],
                    ['showTax', 'Tax'],
                    ['showBarcode', 'Barcode'],
                    ['showQRCode', 'QR code'],
                    ['showSignature', 'Signature'],
                    ['showTerms', 'Terms'],
                    ['showNotes', 'Notes'],
                    ['showStudioCost', 'Studio cost'],
                  ] as const).map(([key, label]) => (
                    <div key={key} className="flex items-center justify-between">
                      <Label className="text-muted-foreground text-sm">{label}</Label>
                      <Switch
                        checked={merged.fields[key] ?? false}
                        onCheckedChange={(v) => update('fields', { ...merged.fields, [key]: v })}
                      />
                    </div>
                  ))}
                </div>
              </SectionCard>

              <SectionCard title="Layout" icon={<Layout size={18} />}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {([
                    ['logoPosition', 'Logo position', merged.layout.header.logoPosition],
                    ['companyDetailsPosition', 'Company details', merged.layout.header.companyDetailsPosition],
                    ['invoiceTitlePosition', 'Invoice title', merged.layout.header.invoiceTitlePosition],
                  ] as const).map(([key, label, val]) => (
                    <div key={key}>
                      <Label className="text-muted-foreground text-sm">{label}</Label>
                      <select
                        value={val}
                        onChange={(e) =>
                          update('layout', {
                            ...merged.layout,
                            header: { ...merged.layout.header, [key]: e.target.value },
                          })
                        }
                        className="mt-1 w-full bg-muted border border-border text-foreground rounded-lg px-3 py-2 text-sm"
                      >
                        <option value="left">Left</option>
                        <option value="center">Center</option>
                        <option value="right">Right</option>
                      </select>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {([
                    ['signaturePosition', 'Signature'],
                    ['termsPosition', 'Terms'],
                    ['notesPosition', 'Notes'],
                  ] as const).map(([key, label]) => (
                    <div key={key}>
                      <Label className="text-muted-foreground text-sm">{label} position</Label>
                      <select
                        value={merged.layout.footer[key]}
                        onChange={(e) =>
                          update('layout', {
                            ...merged.layout,
                            footer: { ...merged.layout.footer, [key]: e.target.value },
                          })
                        }
                        className="mt-1 w-full bg-muted border border-border text-foreground rounded-lg px-3 py-2 text-sm"
                      >
                        <option value="left">Left</option>
                        <option value="center">Center</option>
                        <option value="right">Right</option>
                      </select>
                    </div>
                  ))}
                </div>
              </SectionCard>

              <SectionCard title="Invoice PDF export" icon={<FileDown size={18} />}>
                <AppliesToBanner targets="Invoice PDF download only — not tabular Stock/Product Sell reports." className="mb-2" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Font family</Label>
                    <select
                      value={merged.pdf.fontFamily}
                      onChange={(e) => update('pdf', { ...merged.pdf, fontFamily: e.target.value })}
                      className="mt-1 w-full bg-muted border border-border text-foreground rounded-lg px-3 py-2"
                    >
                      <option value="Inter">Inter</option>
                      <option value="Roboto">Roboto</option>
                      <option value="Arial">Arial</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Font size (px)</Label>
                    <Input
                      type="number"
                      min={10}
                      max={14}
                      value={merged.pdf.fontSize}
                      onChange={(e) => update('pdf', { ...merged.pdf, fontSize: Number(e.target.value) || 12 })}
                      className="mt-1 bg-muted border-border text-foreground"
                    />
                  </div>
                  <div className="flex items-center justify-between col-span-2">
                    <Label className="text-muted-foreground">Include watermark</Label>
                    <Switch
                      checked={merged.pdf.includeWatermark}
                      onCheckedChange={(v) => update('pdf', { ...merged.pdf, includeWatermark: v })}
                    />
                  </div>
                </div>
              </SectionCard>

              <SectionCard title="Defaults" icon={<FileText size={18} />}>
                <div>
                  <Label className="text-muted-foreground">Default invoice type</Label>
                  <select
                    value={merged.defaultInvoiceType}
                    onChange={(e) => update('defaultInvoiceType', e.target.value as InvoiceTypeId)}
                    className="mt-1 w-full max-w-md bg-muted border border-border text-foreground rounded-lg px-3 py-2"
                  >
                    {(Object.keys(INVOICE_TYPE_LABELS) as InvoiceTypeId[]).map((id) => (
                      <option key={id} value={id}>{INVOICE_TYPE_LABELS[id]}</option>
                    ))}
                  </select>
                </div>
              </SectionCard>
            </>
          )}

          {/* ─── THERMAL ─── */}
          {tab === 'thermalReceipts' && (
            <>
              <AppliesToBanner targets="POS receipt, thermal sale print — NOT tabular reports or A4 invoices." />
              <p className="text-xs text-muted-foreground">
                Company logo and address come from Settings → Company profile.
              </p>

              <SectionCard title="Thermal paper" icon={<Thermometer size={18} />}>
                <div>
                  <Label className="text-muted-foreground">Roll width</Label>
                  <select
                    value={merged.thermal.paperSize ?? '58mm'}
                    onChange={(e) =>
                      update('thermal', { ...merged.thermal, paperSize: e.target.value as '58mm' | '80mm' })
                    }
                    className="mt-1 w-full max-w-xs bg-muted border border-border text-foreground rounded-lg px-3 py-2"
                  >
                    <option value="58mm">58mm</option>
                    <option value="80mm">80mm</option>
                  </select>
                </div>
              </SectionCard>

              <SectionCard title="Receipt options" icon={<Thermometer size={18} />}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {(['showLogo', 'showQR', 'showCashier', 'compactMode'] as const).map((key) => (
                    <div key={key} className="flex items-center justify-between">
                      <Label className="text-muted-foreground">
                        {key === 'showQR' ? 'Show QR' : key === 'showCashier' ? 'Show cashier' : key === 'compactMode' ? 'Compact mode' : 'Show logo'}
                      </Label>
                      <Switch
                        checked={merged.thermal[key]}
                        onCheckedChange={(v) => update('thermal', { ...merged.thermal, [key]: v })}
                      />
                    </div>
                  ))}
                </div>
              </SectionCard>

              <SectionCard title="POS automation (silent print)" icon={<Printer size={18} />}>
                <p className="text-xs text-muted-foreground">
                  {getPosPrintAutomationHint(merged.thermal)}
                </p>
                <div className="space-y-3 mt-3">
                  <div>
                    <Label className="text-muted-foreground">Preferred POS printer name</Label>
                    <Input
                      value={merged.thermal.posPrinterDeviceName ?? POS_SILENT_PRINT_GUIDE.suggestedDeviceName}
                      onChange={(e) =>
                        update('thermal', { ...merged.thermal, posPrinterDeviceName: e.target.value })
                      }
                      placeholder={POS_SILENT_PRINT_GUIDE.suggestedDeviceName}
                      className="mt-1 bg-muted border-border text-foreground max-w-md"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Set this as the Windows default printer. Chrome/Edge shortcut flag:{' '}
                      <code className="text-muted-foreground">{POS_SILENT_PRINT_GUIDE.chromeFlag}</code>
                    </p>
                  </div>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={merged.thermal.kioskPrintingHintAcknowledged ?? false}
                      onChange={(e) =>
                        update('thermal', {
                          ...merged.thermal,
                          kioskPrintingHintAcknowledged: e.target.checked,
                        })
                      }
                      className="mt-1 rounded border-gray-600 bg-muted text-blue-500"
                    />
                    <span className="text-sm text-muted-foreground">
                      I understand silent print requires launching the browser with{' '}
                      <code className="text-muted-foreground">{POS_SILENT_PRINT_GUIDE.chromeFlag}</code> — not
                      controllable from this web app alone.
                    </span>
                  </label>
                </div>
              </SectionCard>

              {printer ? (
                <p className="text-xs text-muted-foreground">
                  Current legacy printer_mode: <strong className="text-muted-foreground">{printer.config.mode}</strong>
                  {printer.config.mode === 'thermal' ? ` · ${printer.config.paperSize}` : ''}
                  — synced when you Save on this tab.
                </p>
              ) : null}
            </>
          )}

          {/* ─── REPORTS & EXPORT ─── */}
          {tab === 'reportsExport' && (
            <>
              <AppliesToBanner targets="Stock Report, Product Sell, Account Statements, Roznamcha, Cash Flow, Day Book, Trial Balance, P&L, Balance Sheet — PDF, Print, CSV, Excel exports." />

              <SectionCard title="Report layout" icon={<Layout size={18} />}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-muted-foreground text-sm">Show report header</Label>
                    <Switch
                      checked={merged.reportExport.showReportHeader !== false}
                      onCheckedChange={(v) =>
                        update('reportExport', { ...merged.reportExport, showReportHeader: v })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-muted-foreground text-sm">Show report footer (page numbers)</Label>
                    <Switch
                      checked={merged.reportExport.showReportFooter !== false}
                      onCheckedChange={(v) =>
                        update('reportExport', { ...merged.reportExport, showReportFooter: v })
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-sm">Report font size (px)</Label>
                    <Input
                      type="number"
                      min={9}
                      max={14}
                      value={merged.reportExport.reportFontSize ?? 11}
                      onChange={(e) =>
                        update('reportExport', {
                          ...merged.reportExport,
                          reportFontSize: Number(e.target.value) || 11,
                        })
                      }
                      className="mt-1 bg-muted border-border text-foreground max-w-[120px]"
                    />
                  </div>
                </div>
              </SectionCard>

              <SectionCard title="Report header fields" icon={<BarChart3 size={18} />}>
                <p className="text-xs text-muted-foreground -mt-2">
                  Logo, address, phone, email — only when header is on. Brand data from Company profile.
                </p>
                <div
                  className={`grid grid-cols-1 sm:grid-cols-2 gap-3 ${
                    merged.reportExport.showReportHeader === false ? 'opacity-50 pointer-events-none' : ''
                  }`}
                >
                  {REPORT_FIELD_KEYS.map((key) => (
                    <div key={key} className="flex items-center justify-between">
                      <Label className="text-muted-foreground text-sm">
                        {key.replace(/^show/, '').replace(/([A-Z])/g, ' $1').trim()}
                      </Label>
                      <Switch
                        checked={merged.fields[key] ?? true}
                        onCheckedChange={(v) => update('fields', { ...merged.fields, [key]: v })}
                      />
                    </div>
                  ))}
                </div>
              </SectionCard>

              <SectionCard title="Default orientation" icon={<Layout size={18} />}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Stock Report</Label>
                    <select
                      value={merged.reportExport.stockReportOrientation}
                      onChange={(e) =>
                        update('reportExport', {
                          ...merged.reportExport,
                          stockReportOrientation: e.target.value as 'portrait' | 'landscape',
                        })
                      }
                      className="mt-1 w-full bg-muted border border-border text-foreground rounded-lg px-3 py-2"
                    >
                      <option value="landscape">Landscape (recommended)</option>
                      <option value="portrait">Portrait</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Ledger Statement (V2)</Label>
                    <select
                      value={merged.reportExport.ledgerReportOrientation ?? 'portrait'}
                      onChange={(e) =>
                        update('reportExport', {
                          ...merged.reportExport,
                          ledgerReportOrientation: e.target.value as 'portrait' | 'landscape',
                        })
                      }
                      className="mt-1 w-full bg-muted border border-border text-foreground rounded-lg px-3 py-2"
                    >
                      <option value="portrait">Portrait (recommended)</option>
                      <option value="landscape">Landscape</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Product Sell Report</Label>
                    <select
                      value={merged.reportExport.productSellOrientation}
                      onChange={(e) =>
                        update('reportExport', {
                          ...merged.reportExport,
                          productSellOrientation: e.target.value as 'portrait' | 'landscape',
                        })
                      }
                      className="mt-1 w-full bg-muted border border-border text-foreground rounded-lg px-3 py-2"
                    >
                      <option value="portrait">Portrait</option>
                      <option value="landscape">Landscape</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Roznamcha (Daily Cash Book)</Label>
                    <select
                      value={merged.reportExport.roznamchaOrientation ?? 'landscape'}
                      onChange={(e) =>
                        update('reportExport', {
                          ...merged.reportExport,
                          roznamchaOrientation: e.target.value as 'portrait' | 'landscape',
                        })
                      }
                      className="mt-1 w-full bg-muted border border-border text-foreground rounded-lg px-3 py-2"
                    >
                      <option value="landscape">Landscape (recommended)</option>
                      <option value="portrait">Portrait</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Cash Flow</Label>
                    <select
                      value={merged.reportExport.cashFlowOrientation ?? 'landscape'}
                      onChange={(e) =>
                        update('reportExport', {
                          ...merged.reportExport,
                          cashFlowOrientation: e.target.value as 'portrait' | 'landscape',
                        })
                      }
                      className="mt-1 w-full bg-muted border border-border text-foreground rounded-lg px-3 py-2"
                    >
                      <option value="landscape">Landscape (recommended)</option>
                      <option value="portrait">Portrait</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Journal Day Book</Label>
                    <select
                      value={merged.reportExport.dayBookOrientation ?? 'landscape'}
                      onChange={(e) =>
                        update('reportExport', {
                          ...merged.reportExport,
                          dayBookOrientation: e.target.value as 'portrait' | 'landscape',
                        })
                      }
                      className="mt-1 w-full bg-muted border border-border text-foreground rounded-lg px-3 py-2"
                    >
                      <option value="landscape">Landscape (recommended)</option>
                      <option value="portrait">Portrait</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Financial reports (TB / P&L / BS)</Label>
                    <select
                      value={merged.reportExport.financialReportOrientation ?? 'portrait'}
                      onChange={(e) =>
                        update('reportExport', {
                          ...merged.reportExport,
                          financialReportOrientation: e.target.value as 'portrait' | 'landscape',
                        })
                      }
                      className="mt-1 w-full bg-muted border border-border text-foreground rounded-lg px-3 py-2"
                    >
                      <option value="portrait">Portrait (recommended)</option>
                      <option value="landscape">Landscape</option>
                    </select>
                  </div>
                </div>
              </SectionCard>

              <SectionCard title="CSV & Excel" icon={<FileDown size={18} />}>
                <p className="text-sm text-muted-foreground">
                  Export columns match what you show in the report table (column picker). Hidden columns are excluded automatically.
                </p>
              </SectionCard>
            </>
          )}

          {/* ─── ADVANCED (collapsed) ─── */}
          {tab === 'advanced' && (
            <>
              <button
                type="button"
                onClick={() => setAdvancedOpen((o) => !o)}
                className="w-full flex items-center justify-between bg-input-background border border-border rounded-lg px-4 py-3 text-left text-foreground hover:bg-card"
              >
                <span className="font-medium text-sm">Power-user options</span>
                <ChevronDown size={18} className={`transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
              </button>

              {advancedOpen && (
                <div className="space-y-6 pl-1">
                  <SectionCard title="Enabled document types" icon={<FileStack size={18} />}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {(Object.keys(DOCUMENT_LABELS) as DocumentTemplateId[]).map((id) => (
                        <label
                          key={id}
                          className="flex items-center gap-2 p-2 rounded-lg border border-border hover:bg-muted/50 cursor-pointer text-sm"
                        >
                          <input
                            type="checkbox"
                            checked={merged.documentTemplates.includes(id)}
                            onChange={(e) => {
                              const next = e.target.checked
                                ? [...merged.documentTemplates, id]
                                : merged.documentTemplates.filter((x) => x !== id);
                              update('documentTemplates', next);
                            }}
                            className="rounded border-gray-600 bg-muted text-blue-500"
                          />
                          <span className="text-foreground">{DOCUMENT_LABELS[id]}</span>
                        </label>
                      ))}
                    </div>
                  </SectionCard>

                  {invoiceTemplates ? (
                    <SectionCard title="Invoice Templates (legacy DB)" icon={<FileText size={18} />}>
                      <InvoiceTemplatesSettingsSection
                        loading={invoiceTemplates.loading}
                        saving={invoiceTemplates.saving}
                        invoiceTemplateA4={invoiceTemplates.invoiceTemplateA4}
                        invoiceTemplateThermal={invoiceTemplates.invoiceTemplateThermal}
                        onA4Change={invoiceTemplates.onA4Change}
                        onThermalChange={invoiceTemplates.onThermalChange}
                        onSave={invoiceTemplates.onSave}
                      />
                    </SectionCard>
                  ) : null}

                  {printer ? (
                    <SectionCard title="Legacy printer config" icon={<Printer size={18} />}>
                      <LegacyPrinterSettingsSection printer={printer} />
                    </SectionCard>
                  ) : null}
                </div>
              )}

              {!advancedOpen && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Expand above for document type toggles, legacy invoice templates, and old printer config.
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {/* RIGHT: Preview */}
      {(showA4Preview || showReportPreview || showThermalPreview) && (
        <div className="xl:sticky xl:top-24 xl:self-start min-w-0 flex flex-col border border-border rounded-xl bg-muted/40 overflow-hidden">
          {showA4Preview && (
            <PrintingPreviewPanel
              settings={settings}
              previewDocument={previewDocument}
              onPreviewDocumentChange={setPreviewDocument}
            />
          )}
          {showThermalPreview && (
            <div className="p-3">
              <ThermalReceiptPreviewPanel thermal={merged.thermal} />
            </div>
          )}
          {showReportPreview && (
            <div className="p-3">
              <ReportExportPreviewPanel
                ledgerOptions={ledgerPrintOptions}
                roznamchaOptions={roznamchaPrintOptions}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
