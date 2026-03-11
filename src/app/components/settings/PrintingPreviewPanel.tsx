/**
 * Live document preview for Printing settings.
 * A4 ratio, mock data, updates when settings change (fields, page setup, layout).
 */
import React from 'react';
import type { DocumentTemplateId } from '@/app/types/printingSettings';
import type { CompanyPrintingSettings } from '@/app/types/printingSettings';
import { mergeWithDefaults } from '@/app/types/printingSettings';

const PREVIEW_DOCUMENT_OPTIONS: { id: DocumentTemplateId; label: string }[] = [
  { id: 'sales_invoice', label: 'Sales Invoice' },
  { id: 'purchase_invoice', label: 'Purchase Invoice' },
  { id: 'ledger_statement', label: 'Ledger Statement' },
  { id: 'payment_receipt', label: 'Payment Receipt' },
  { id: 'packing_list', label: 'Packing List' },
];

const MOCK = {
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

interface PrintingPreviewPanelProps {
  settings: CompanyPrintingSettings | null;
  previewDocument: DocumentTemplateId;
  onPreviewDocumentChange: (id: DocumentTemplateId) => void;
}

function flexPosition(pos: 'left' | 'center' | 'right') {
  return pos === 'left' ? 'justify-start text-left' : pos === 'center' ? 'justify-center text-center' : 'justify-end text-right';
}

export function PrintingPreviewPanel({
  settings,
  previewDocument,
  onPreviewDocumentChange,
}: PrintingPreviewPanelProps) {
  const merged = mergeWithDefaults(settings);
  const { pageSetup, fields, layout, pdf } = merged;
  const isLandscape = pageSetup.orientation === 'landscape';
  const m = pageSetup.margins;
  const fontFamily = pdf.fontFamily || 'Inter';

  return (
    <div className="flex flex-col h-full min-h-0 rounded-xl border border-gray-700 bg-gray-900">
      <div className="p-3 border-b border-gray-800 shrink-0">
        <label className="text-xs font-medium text-gray-400 uppercase tracking-wider block mb-1.5">
          Document preview
        </label>
        <select
          value={previewDocument}
          onChange={(e) => onPreviewDocumentChange(e.target.value as DocumentTemplateId)}
          className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm"
        >
          {PREVIEW_DOCUMENT_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>{opt.label}</option>
          ))}
        </select>
      </div>
      <div className="flex-1 min-h-0 p-4 overflow-auto flex items-start justify-center">
        {/* A4 ratio: 210×297 portrait. Scale ~75%: max 520px width */}
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
            {/* Header */}
            <header className="border-b border-gray-300 pb-3 mb-3">
              <div className={`flex ${flexPosition(layout.header.logoPosition)} gap-4 flex-wrap`}>
                {fields.showLogo && (
                  <div className="w-14 h-14 bg-gray-200 rounded flex items-center justify-center text-[10px] text-gray-500 shrink-0">
                    LOGO
                  </div>
                )}
                <div className={`flex-1 min-w-0 ${flexPosition(layout.header.companyDetailsPosition)}`}>
                  {fields.showCompanyAddress && <div className="font-semibold text-base" style={{ fontSize: '16px' }}>{MOCK.companyName}</div>}
                  {fields.showCompanyAddress && <div className="text-gray-600 text-xs mt-0.5">{MOCK.address}</div>}
                  {fields.showPhone && <div className="text-gray-600 text-xs">{MOCK.phone}</div>}
                  {fields.showEmail && <div className="text-gray-600 text-xs">{MOCK.email}</div>}
                </div>
              </div>
              <div className={`flex mt-2 ${flexPosition(layout.header.invoiceTitlePosition)}`}>
                <h1 className="font-bold text-lg" style={{ fontSize: '16px' }}>
                  {PREVIEW_DOCUMENT_OPTIONS.find((o) => o.id === previewDocument)?.label ?? 'Invoice'}
                </h1>
              </div>
            </header>

            {/* Meta + Customer */}
            <div className="grid grid-cols-2 gap-4 mb-3 text-xs">
              <div>
                <span className="text-gray-500">Invoice No</span>
                <span className="ml-2">{MOCK.invoiceNo}</span>
              </div>
              <div className="text-right">
                <span className="text-gray-500">Date</span>
                <span className="ml-2">{MOCK.date}</span>
              </div>
              {fields.showCustomerAddress && (
                <>
                  <div className="col-span-2">
                    <span className="text-gray-500">Customer</span>
                    <span className="ml-2">{MOCK.customer}</span>
                  </div>
                  <div className="col-span-2 text-gray-600">{MOCK.customerAddress}</div>
                </>
              )}
            </div>

            {/* Table */}
            <div className="flex-1 min-h-0 overflow-hidden">
              <table className="w-full border-collapse text-xs" style={{ fontSize: '12px' }}>
                <thead>
                  <tr className="border-b-2 border-gray-800">
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
                  {MOCK.items.map((row, i) => (
                    <tr key={i} className="border-b border-gray-200">
                      <td className="py-1">{row.product}</td>
                      {fields.showSku && <td className="py-1 text-gray-600">{row.sku}</td>}
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

            {/* Totals */}
            <div className={`flex ${flexPosition(layout.table.alignment)} mt-2 text-xs`}>
              <div className="text-right space-y-0.5">
                <div className="flex justify-end gap-6"><span className="text-gray-500">Subtotal</span><span>{MOCK.subtotal.toLocaleString()}</span></div>
                {fields.showDiscount && <div className="flex justify-end gap-6"><span className="text-gray-500">Discount</span><span>{MOCK.discount.toLocaleString()}</span></div>}
                {fields.showTax && <div className="flex justify-end gap-6"><span className="text-gray-500">Tax</span><span>{MOCK.tax.toLocaleString()}</span></div>}
                <div className="flex justify-end gap-6 font-semibold border-t border-gray-300 pt-1 mt-1"><span>Total</span><span>{MOCK.total.toLocaleString()}</span></div>
              </div>
            </div>

            {/* Footer */}
            <footer className="mt-4 pt-3 border-t border-gray-300 text-xs text-gray-600">
              {fields.showNotes && (
                <div className={`flex ${flexPosition(layout.footer.notesPosition)} mb-2`}>
                  <span>{MOCK.notes}</span>
                </div>
              )}
              {fields.showSignature && (
                <div className={`flex ${flexPosition(layout.footer.signaturePosition)} mt-2`}>
                  <span className="border-t border-gray-400 pt-1">Signature</span>
                </div>
              )}
            </footer>
          </div>
        </div>
      </div>
      <div className="px-3 py-2 border-t border-gray-800 text-[11px] text-gray-500 shrink-0">
        A4 {pageSetup.orientation} · Live preview
      </div>
    </div>
  );
}
