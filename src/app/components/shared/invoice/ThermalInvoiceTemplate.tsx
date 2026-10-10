/**
 * Thermal (58mm/80mm) invoice — uses shared ThermalReceiptLayout (not ClassicPrintBase).
 */
import React from 'react';
import { useSettings } from '@/app/context/SettingsContext';
import { useCompanyLogoDisplayUrl } from '@/app/hooks/useCompanyLogoDisplayUrl';
import type { InvoiceDocument, InvoiceTemplate } from '@/app/types/invoiceDocument';
import type { ThermalSettings } from '@/app/types/printingSettings';
import { DEFAULT_THERMAL } from '@/app/types/printingSettings';
import {
  ThermalReceiptLayout,
  type ThermalPaperSize,
  type ThermalReceiptLineItem,
  type ThermalReceiptTotalRow,
} from './ThermalReceiptLayout';
import { formatPackingFromItem } from './formatPackingFromDocument';
import { BespokeInstructionBullets } from '@/app/components/bespoke/BespokeInstructionBullets';

export type PaperSize = ThermalPaperSize;

export interface ThermalInvoiceTemplateProps {
  document: InvoiceDocument;
  template: InvoiceTemplate;
  formatCurrency: (n: number) => string;
  paperSize?: PaperSize;
  thermal?: ThermalSettings;
  onPrint?: () => void;
  onClose?: () => void;
  actionChildren?: React.ReactNode;
  contentRef?: React.RefObject<HTMLDivElement | null>;
  showLogo?: boolean;
}

export const ThermalInvoiceTemplate: React.FC<ThermalInvoiceTemplateProps> = ({
  document: doc,
  template,
  formatCurrency,
  paperSize = '58mm',
  thermal = DEFAULT_THERMAL,
  actionChildren,
  contentRef,
  showLogo = true,
}) => {
  const { inventorySettings, businessSettings, company } = useSettings();
  const logoDisplay = useCompanyLogoDisplayUrl(showLogo && thermal.showLogo ? template.logo_url : undefined);
  const enableBespoke = businessSettings.enableBespokeOrders;
  const enablePacking = inventorySettings.enablePacking ?? false;

  const lineItems: ThermalReceiptLineItem[] = doc.items.map((item, index) => ({
    key: item.id || String(index),
    name: item.product_name,
    sku: template.show_sku && item.sku ? item.sku : null,
    qty: Number(item.quantity).toFixed(2),
    amount: formatCurrency(item.total),
    subLines: (
      <>
        {enablePacking ? (
          <div style={{ fontSize: '8px', color: '#6b7280' }}>{formatPackingFromItem(item)}</div>
        ) : null}
        {enableBespoke && !item.bespoke_parent_item_id ? (
          <BespokeInstructionBullets variant="print" customizationDetails={item.customization_details} />
        ) : null}
      </>
    ),
  }));

  const totalRows: ThermalReceiptTotalRow[] = [];

  if (template.show_studio && doc.totals.studio_charges > 0) {
    totalRows.push({
      label: 'Production Cost:',
      value: formatCurrency(doc.totals.studio_charges),
    });
  }
  totalRows.push({ label: 'Subtotal:', value: formatCurrency(doc.totals.subtotal) });
  if (template.show_discount && doc.totals.discount > 0) {
    totalRows.push({ label: 'Discount:', value: `- ${formatCurrency(doc.totals.discount)}` });
  }
  if (template.show_studio && doc.totals.studio_charges > 0) {
    totalRows.push({
      label: 'Grand Total:',
      value: formatCurrency(doc.totals.grand_total),
      bold: true,
    });
  } else {
    totalRows.push({
      label: 'Total:',
      value: formatCurrency(doc.totals.total),
      bold: true,
    });
  }
  totalRows.push({
    label: 'Paid:',
    value: formatCurrency(doc.totals.paid),
    valueColor: '#059669',
  });
  if (doc.totals.due > 0) {
    totalRows.push({
      label: 'Due:',
      value: formatCurrency(doc.totals.due),
      valueColor: '#dc2626',
      bold: true,
    });
  }

  const statusLabel =
    doc.meta.payment_status === 'paid'
      ? 'Paid'
      : doc.meta.payment_status === 'partial'
        ? 'Partial'
        : 'Unpaid';

  return (
    <ThermalReceiptLayout
      contentRef={contentRef}
      paperSize={paperSize}
      thermal={{ ...thermal, showLogo: showLogo && thermal.showLogo }}
      companyName={doc.company.name || company.name || 'Company'}
      companyAddress={doc.company.address ?? company.address}
      companyPhone={company.phone}
      logoUrl={logoDisplay || undefined}
      invoiceNo={doc.meta.invoice_no}
      invoiceDate={new Date(doc.meta.invoice_date).toLocaleDateString()}
      customerName={doc.customer.name}
      customerPhone={doc.customer.contact_number}
      lineItems={lineItems}
      totalRows={totalRows}
      statusLabel={statusLabel}
      footerNote={template.footer_note}
      actions={actionChildren}
    />
  );
};
