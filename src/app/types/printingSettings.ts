/**
 * Centralized ERP printing settings.
 * Used by Settings → Printing. Same engine for Sales, Purchases, Ledger, PDF, etc.
 */

export type PageSize = 'A4' | 'Legal' | 'Letter' | 'Thermal58mm' | 'Thermal80mm';
export type Orientation = 'portrait' | 'landscape';
export type InvoiceTypeId = 'standard' | 'packing' | 'pieces' | 'summary' | 'detailed';

export interface PageMargins {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface PageSetup {
  pageSize: PageSize;
  orientation: Orientation;
  margins: PageMargins;
}

export interface FieldsConfig {
  showLogo: boolean;
  showCompanyAddress: boolean;
  showPhone: boolean;
  showEmail: boolean;
  showCustomerAddress: boolean;
  showSku: boolean;
  showDiscount: boolean;
  showTax: boolean;
  showBarcode: boolean;
  showQRCode: boolean;
  showSignature: boolean;
  showTerms: boolean;
  showNotes: boolean;
  showStudioCost?: boolean;
}

export interface LayoutHeader {
  logoPosition: 'left' | 'center' | 'right';
  companyDetailsPosition: 'left' | 'center' | 'right';
  invoiceTitlePosition: 'left' | 'center' | 'right';
}

export interface LayoutTable {
  columns: string[];
  columnWidths: Record<string, string>;
  alignment: 'left' | 'center' | 'right';
}

export interface LayoutFooter {
  signaturePosition: 'left' | 'center' | 'right';
  termsPosition: 'left' | 'center' | 'right';
  notesPosition: 'left' | 'center' | 'right';
}

export interface LayoutEditor {
  header: LayoutHeader;
  table: LayoutTable;
  footer: LayoutFooter;
}

export interface ThermalSettings {
  showLogo: boolean;
  showQR: boolean;
  showCashier: boolean;
  compactMode: boolean;
}

export interface PdfExportSettings {
  fontSize: number;
  fontFamily: string;
  includeWatermark: boolean;
}

export type DocumentTemplateId =
  | 'sales_invoice'
  | 'purchase_invoice'
  | 'ledger_statement'
  | 'payment_receipt'
  | 'packing_list'
  | 'delivery_note'
  | 'courier_slip'
  | 'quotation'
  | 'proforma_invoice';

export interface CompanyPrintingSettings {
  pageSetup?: PageSetup;
  fields?: FieldsConfig;
  layout?: LayoutEditor;
  thermal?: ThermalSettings;
  pdf?: PdfExportSettings;
  documentTemplates?: DocumentTemplateId[];
  defaultInvoiceType?: InvoiceTypeId;
}

const DEFAULT_MARGINS: PageMargins = { top: 16, bottom: 16, left: 16, right: 16 };

export const DEFAULT_PAGE_SETUP: PageSetup = {
  pageSize: 'A4',
  orientation: 'portrait',
  margins: DEFAULT_MARGINS,
};

export const DEFAULT_FIELDS: FieldsConfig = {
  showLogo: true,
  showCompanyAddress: true,
  showPhone: true,
  showEmail: true,
  showCustomerAddress: true,
  showSku: true,
  showDiscount: true,
  showTax: true,
  showBarcode: false,
  showQRCode: false,
  showSignature: false,
  showTerms: false,
  showNotes: true,
  showStudioCost: true,
};

export const DEFAULT_LAYOUT: LayoutEditor = {
  header: {
    logoPosition: 'left',
    companyDetailsPosition: 'left',
    invoiceTitlePosition: 'center',
  },
  table: {
    columns: ['product', 'qty', 'rate', 'amount'],
    columnWidths: {},
    alignment: 'left',
  },
  footer: {
    signaturePosition: 'right',
    termsPosition: 'left',
    notesPosition: 'left',
  },
};

export const DEFAULT_THERMAL: ThermalSettings = {
  showLogo: true,
  showQR: false,
  showCashier: true,
  compactMode: true,
};

export const DEFAULT_PDF: PdfExportSettings = {
  fontSize: 12,
  fontFamily: 'Inter',
  includeWatermark: false,
};

export const DEFAULT_DOCUMENT_TEMPLATES: DocumentTemplateId[] = [
  'sales_invoice',
  'purchase_invoice',
  'ledger_statement',
  'payment_receipt',
  'packing_list',
  'delivery_note',
  'courier_slip',
];

export function mergeWithDefaults(partial: CompanyPrintingSettings | null | undefined): Required<Omit<CompanyPrintingSettings, 'documentTemplates'>> & { documentTemplates: DocumentTemplateId[] } {
  return {
    pageSetup: { ...DEFAULT_PAGE_SETUP, ...partial?.pageSetup },
    fields: { ...DEFAULT_FIELDS, ...partial?.fields },
    layout: { ...DEFAULT_LAYOUT, ...partial?.layout },
    thermal: { ...DEFAULT_THERMAL, ...partial?.thermal },
    pdf: { ...DEFAULT_PDF, ...partial?.pdf },
    documentTemplates: partial?.documentTemplates?.length ? partial.documentTemplates : DEFAULT_DOCUMENT_TEMPLATES,
    defaultInvoiceType: partial?.defaultInvoiceType ?? 'standard',
  };
}
