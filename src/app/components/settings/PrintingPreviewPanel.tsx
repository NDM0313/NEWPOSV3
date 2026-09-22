/**
 * Live document preview for Printing settings.
 * Uses same printing_settings (fields, layout, pageSetup) as the unified document engine.
 * Toggles (Show SKU, Discount, Tax, etc.) reflect in real time.
 * Supports: Sales Invoice, Purchase Invoice, Ledger Statement, Payment Receipt, Packing List.
 */
import React, { useMemo } from 'react';
import type { DocumentTemplateId } from '@/app/types/printingSettings';
import type { CompanyPrintingSettings } from '@/app/types/printingSettings';
import { mergeWithDefaults } from '@/app/types/printingSettings';
import { useSettings } from '@/app/context/SettingsContext';
import { useCompanyLogoDisplayUrl } from '@/app/hooks/useCompanyLogoDisplayUrl';
import { resolveLedgerPrintOptions } from '@/app/components/reports/shared/resolveLedgerPrintOptions';
import { ReportExportPreviewPanel } from './printing/ReportExportPreviewPanel';
import type { CompanyBrand } from '@/app/services/companyBrandService';

const PREVIEW_DOCUMENT_OPTIONS: { id: DocumentTemplateId; label: string }[] = [
  { id: 'sales_invoice', label: 'Sales Invoice' },
  { id: 'purchase_invoice', label: 'Purchase Invoice' },
  { id: 'ledger_statement', label: 'Ledger Statement' },
  { id: 'payment_receipt', label: 'Payment Receipt' },
  { id: 'packing_list', label: 'Packing List' },
];

const MOCK_INVOICE = {
  companyName: 'Din Collection',
  address: '123 Main St, Lahore, Pakistan',
  phone: '+92 300 1234567',
  email: 'info@dincollection.com',
  customer: 'Ali Khan',
  customerAddress: '45 Mall Road, Lahore',
  invoiceNo: 'INV-00034',
  date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
  items: [
    { product: 'Silk Fabric', sku: 'SF-001', qty: 2, rate: 2500, discount: 200, tax: 460, amount: 5000, studioCost: 0 },
    { product: 'Cotton Lawn', sku: 'CL-002', qty: 1, rate: 1800, discount: 0, tax: 270, amount: 1800, studioCost: 150 },
  ],
  subtotal: 6800,
  discount: 200,
  tax: 730,
  total: 7330,
  notes: 'Thank you for your business.',
};

function buildPreviewBrand(company: ReturnType<typeof useSettings>['company'], logoUrl: string): CompanyBrand {
  return {
    name: company.businessName || 'Your Company',
    address: company.businessAddress || '',
    phone: company.businessPhone || null,
    email: company.businessEmail || null,
    website: null,
    taxNumber: company.taxId || null,
    logoUrl: logoUrl || null,
    city: '',
    country: '',
  };
}

const MOCK_RECEIPT = {
  receiptNo: 'RCP-00892',
  date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
  customer: 'Ali Khan',
  amount: 10000,
  method: 'Bank Transfer',
  reference: 'TXN-XXX',
  notes: 'Payment against INV-00034',
};

const MOCK_PACKING = {
  orderNo: 'INV-00034',
  date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
  items: [
    { product: 'Silk Fabric', sku: 'SF-001', pieces: 24, cartons: 2, weight: '4.5 kg' },
    { product: 'Cotton Lawn', sku: 'CL-002', pieces: 12, cartons: 1, weight: '2.0 kg' },
  ],
  totalPieces: 36,
  totalCartons: 3,
  totalWeight: '6.5 kg',
};

interface PrintingPreviewPanelProps {
  settings: CompanyPrintingSettings | null;
  previewDocument: DocumentTemplateId;
  onPreviewDocumentChange: (id: DocumentTemplateId) => void;
}

function flexPosition(pos: 'left' | 'center' | 'right') {
  return pos === 'left' ? 'justify-start text-left' : pos === 'center' ? 'justify-center text-center' : 'justify-end text-right';
}

function PreviewHeader({
  merged,
  title,
  showLogo,
  logoDisplayUrl,
}: {
  merged: ReturnType<typeof mergeWithDefaults>;
  title: string;
  showLogo: boolean;
  logoDisplayUrl: string;
}) {
  const { layout, fields } = merged;
  return (
    <header className="border-b border-gray-300 pb-3 mb-3">
      <div className={`flex ${flexPosition(layout.header.logoPosition)} gap-4 flex-wrap`}>
        {showLogo && fields.showLogo && (
          logoDisplayUrl ? (
            <img
              src={logoDisplayUrl}
              alt="Company logo"
              className="w-14 h-14 object-contain shrink-0 rounded"
            />
          ) : (
            <div className="w-14 h-14 bg-gray-200 rounded flex items-center justify-center text-[10px] text-muted-foreground shrink-0">
              LOGO
            </div>
          )
        )}
        <div className={`flex-1 min-w-0 ${flexPosition(layout.header.companyDetailsPosition)}`}>
          {fields.showCompanyAddress && <div className="font-semibold text-base" style={{ fontSize: '16px' }}>{MOCK_INVOICE.companyName}</div>}
          {fields.showCompanyAddress && <div className="text-muted-foreground text-xs mt-0.5">{MOCK_INVOICE.address}</div>}
          {fields.showPhone && <div className="text-muted-foreground text-xs">{MOCK_INVOICE.phone}</div>}
          {fields.showEmail && <div className="text-muted-foreground text-xs">{MOCK_INVOICE.email}</div>}
        </div>
      </div>
      <div className={`flex mt-2 ${flexPosition(layout.header.invoiceTitlePosition)}`}>
        <h1 className="font-bold text-lg" style={{ fontSize: '16px' }}>{title}</h1>
      </div>
    </header>
  );
}

export function PrintingPreviewPanel({
  settings,
  previewDocument,
  onPreviewDocumentChange,
}: PrintingPreviewPanelProps) {
  const { company } = useSettings();
  const logoDisplayUrl = useCompanyLogoDisplayUrl(company.logoUrl);
  const merged = mergeWithDefaults(settings);
  const ledgerPrintOptions = useMemo(() => resolveLedgerPrintOptions(settings), [settings]);
  const previewBrand = useMemo(
    () => buildPreviewBrand(company, logoDisplayUrl),
    [company, logoDisplayUrl],
  );
  const { pageSetup, fields, layout, pdf } = merged;
  const isLandscape = pageSetup.orientation === 'landscape';
  const m = pageSetup.margins;
  const fontFamily = pdf.fontFamily || 'Inter';
  const title = PREVIEW_DOCUMENT_OPTIONS.find((o) => o.id === previewDocument)?.label ?? 'Document';

  const renderInvoiceTable = () => (
    <>
      <div className="grid grid-cols-2 gap-4 mb-3 text-xs">
        <div>
          <span className="text-muted-foreground">Invoice No</span>
          <span className="ml-2">{MOCK_INVOICE.invoiceNo}</span>
        </div>
        <div className="text-right">
          <span className="text-muted-foreground">Date</span>
          <span className="ml-2">{MOCK_INVOICE.date}</span>
        </div>
        {fields.showCustomerAddress && (
          <>
            <div className="col-span-2">
              <span className="text-muted-foreground">Customer</span>
              <span className="ml-2">{MOCK_INVOICE.customer}</span>
            </div>
            <div className="col-span-2 text-muted-foreground">{MOCK_INVOICE.customerAddress}</div>
          </>
        )}
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        <table className="w-full border-collapse text-xs" style={{ fontSize: '12px' }}>
          <thead>
            <tr className="border-b-2 border-border">
              <th className={`${layout.table.alignment === 'left' ? 'text-left' : layout.table.alignment === 'center' ? 'text-center' : 'text-right'} py-1.5 font-semibold`}>Product</th>
              {fields.showSku && <th className="text-left py-1.5 font-semibold">SKU</th>}
              <th className="text-right py-1.5 font-semibold">Qty</th>
              <th className="text-right py-1.5 font-semibold">Rate</th>
              {fields.showDiscount && <th className="text-right py-1.5 font-semibold">Discount</th>}
              {fields.showTax && <th className="text-right py-1.5 font-semibold">Tax</th>}
              {fields.showStudioCost && <th className="text-right py-1.5 font-semibold">Studio</th>}
              <th className="text-right py-1.5 font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_INVOICE.items.map((row, i) => (
              <tr key={i} className="border-b border-gray-200">
                <td className="py-1">{row.product}</td>
                {fields.showSku && <td className="py-1 text-muted-foreground">{row.sku}</td>}
                <td className="text-right py-1">{row.qty}</td>
                <td className="text-right py-1">{row.rate.toLocaleString()}</td>
                {fields.showDiscount && <td className="text-right py-1">{row.discount > 0 ? row.discount : '—'}</td>}
                {fields.showTax && <td className="text-right py-1">{row.tax.toLocaleString()}</td>}
                {fields.showStudioCost && <td className="text-right py-1">{row.studioCost > 0 ? row.studioCost : '—'}</td>}
                <td className="text-right py-1 font-medium">{row.amount.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={`flex ${flexPosition(layout.table.alignment)} mt-2 text-xs`}>
        <div className="text-right space-y-0.5">
          <div className="flex justify-end gap-6"><span className="text-muted-foreground">Subtotal</span><span>{MOCK_INVOICE.subtotal.toLocaleString()}</span></div>
          {fields.showDiscount && <div className="flex justify-end gap-6"><span className="text-muted-foreground">Discount</span><span>{MOCK_INVOICE.discount.toLocaleString()}</span></div>}
          {fields.showTax && <div className="flex justify-end gap-6"><span className="text-muted-foreground">Tax</span><span>{MOCK_INVOICE.tax.toLocaleString()}</span></div>}
          <div className="flex justify-end gap-6 font-semibold border-t border-gray-300 pt-1 mt-1"><span>Total</span><span>{MOCK_INVOICE.total.toLocaleString()}</span></div>
        </div>
      </div>
    </>
  );

  const renderReceipt = () => (
    <>
      <div className="space-y-2 mb-4 text-xs">
        <div className="flex justify-between"><span className="text-muted-foreground">Receipt No</span><span>{MOCK_RECEIPT.receiptNo}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Date</span><span>{MOCK_RECEIPT.date}</span></div>
        {fields.showCustomerAddress && (
          <>
            <div className="flex justify-between"><span className="text-muted-foreground">Customer</span><span>{MOCK_RECEIPT.customer}</span></div>
          </>
        )}
        <div className="flex justify-between font-semibold text-base pt-2 border-t border-gray-200">
          <span>Amount</span><span>{MOCK_RECEIPT.amount.toLocaleString()}</span>
        </div>
        <div className="flex justify-between"><span className="text-muted-foreground">Method</span><span>{MOCK_RECEIPT.method}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Reference</span><span>{MOCK_RECEIPT.reference}</span></div>
      </div>
      {fields.showNotes && (
        <div className="pt-2 border-t border-gray-200 text-xs text-muted-foreground">{MOCK_RECEIPT.notes}</div>
      )}
      {fields.showSignature && (
        <div className={`flex ${flexPosition(layout.footer.signaturePosition)} mt-4 pt-2 border-t border-gray-200`}>
          <span className="text-xs text-muted-foreground">Authorized Signature</span>
        </div>
      )}
    </>
  );

  const renderPackingList = () => (
    <>
      <div className="grid grid-cols-2 gap-4 mb-3 text-xs">
        <div>
          <span className="text-muted-foreground">Order / Invoice</span>
          <span className="ml-2">{MOCK_PACKING.orderNo}</span>
        </div>
        <div className="text-right">
          <span className="text-muted-foreground">Date</span>
          <span className="ml-2">{MOCK_PACKING.date}</span>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        <table className="w-full border-collapse text-xs" style={{ fontSize: '12px' }}>
          <thead>
            <tr className="border-b-2 border-border">
              <th className="text-left py-1.5 font-semibold">Product</th>
              {fields.showSku && <th className="text-left py-1.5 font-semibold">SKU</th>}
              <th className="text-right py-1.5 font-semibold">Pieces</th>
              <th className="text-right py-1.5 font-semibold">Cartons</th>
              <th className="text-right py-1.5 font-semibold">Weight</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_PACKING.items.map((row, i) => (
              <tr key={i} className="border-b border-gray-200">
                <td className="py-1">{row.product}</td>
                {fields.showSku && <td className="py-1 text-muted-foreground">{row.sku}</td>}
                <td className="text-right py-1">{row.pieces}</td>
                <td className="text-right py-1">{row.cartons}</td>
                <td className="text-right py-1">{row.weight}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end gap-6 mt-2 text-xs border-t border-gray-300 pt-2">
        <span><strong>Total Pieces</strong> {MOCK_PACKING.totalPieces}</span>
        <span><strong>Cartons</strong> {MOCK_PACKING.totalCartons}</span>
        <span><strong>Weight</strong> {MOCK_PACKING.totalWeight}</span>
      </div>
    </>
  );

  const renderContent = () => {
    switch (previewDocument) {
      case 'sales_invoice':
      case 'purchase_invoice':
      case 'delivery_note':
      case 'courier_slip':
        return renderInvoiceTable();
      case 'payment_receipt':
        return renderReceipt();
      case 'packing_list':
        return renderPackingList();
      default:
        return renderInvoiceTable();
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0 rounded-xl border border-border bg-card">
      <div className="p-3 border-b border-border shrink-0">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1.5">
          Document preview
        </label>
        <select
          value={previewDocument}
          onChange={(e) => onPreviewDocumentChange(e.target.value as DocumentTemplateId)}
          className="w-full bg-muted border border-border text-foreground rounded-lg px-3 py-2 text-sm"
        >
          {PREVIEW_DOCUMENT_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>{opt.label}</option>
          ))}
        </select>
        <p className="text-[11px] text-muted-foreground mt-1.5">
          {previewDocument === 'ledger_statement'
            ? 'Same 7-column layout as Account Statements PDF. Orientation: Reports & Export tab.'
            : 'Toggles (e.g. Show SKU) update this preview live.'}
        </p>
      </div>
      {previewDocument === 'ledger_statement' ? (
        <div className="flex-1 min-h-0 p-3 overflow-auto">
          <ReportExportPreviewPanel brand={previewBrand} ledgerOptions={ledgerPrintOptions} />
        </div>
      ) : (
      <div className="flex-1 min-h-0 p-4 overflow-auto flex items-start justify-center">
        <div
          className="bg-white text-black shadow-xl rounded-sm overflow-hidden shrink-0"
          style={{
            width: isLandscape ? 'min(100%, 700px)' : 'min(100%, 520px)',
            aspectRatio: isLandscape ? '297/210' : '210/297',
            maxHeight: '85vh',
            fontFamily,
            fontSize: pdf.fontSize ? `${pdf.fontSize}px` : '12px',
          }}
        >
          <div
            className="h-full flex flex-col p-4"
            style={{
              paddingTop: Math.max(8, m.top * 0.5),
              paddingBottom: Math.max(8, m.bottom * 0.5),
              paddingLeft: Math.max(8, m.left * 0.5),
              paddingRight: Math.max(8, m.right * 0.5),
            }}
          >
            <PreviewHeader
              merged={merged}
              title={title}
              showLogo={previewDocument !== 'payment_receipt'}
              logoDisplayUrl={logoDisplayUrl}
            />
            {renderContent()}
            {/* Footer for invoice-type and packing */}
            {(previewDocument === 'sales_invoice' || previewDocument === 'purchase_invoice' || previewDocument === 'packing_list') && (
              <footer className="mt-4 pt-3 border-t border-gray-300 text-xs text-muted-foreground">
                {fields.showNotes && previewDocument !== 'packing_list' && (
                  <div className={`flex ${flexPosition(layout.footer.notesPosition)} mb-2`}>
                    <span>{MOCK_INVOICE.notes}</span>
                  </div>
                )}
                {fields.showSignature && (
                  <div className={`flex ${flexPosition(layout.footer.signaturePosition)} mt-2`}>
                    <span className="border-t border-gray-400 pt-1">Signature</span>
                  </div>
                )}
              </footer>
            )}
          </div>
        </div>
      </div>
      )}
      <div className="px-3 py-2 border-t border-border text-[11px] text-muted-foreground shrink-0">
        A4 {previewDocument === 'ledger_statement' ? ledgerPrintOptions.orientation : pageSetup.orientation} · Live preview (matches print)
      </div>
    </div>
  );
}
