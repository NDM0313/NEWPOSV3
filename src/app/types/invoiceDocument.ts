/**
 * Types for Phase A: Controlled Standard Invoice Template System.
 * Matches RPC generate_invoice_document(sale_id) and invoice_templates table.
 */

export interface InvoiceDocumentCompany {
  id: string;
  name: string;
  address?: string | null;
}

export interface InvoiceDocumentCustomer {
  id: string;
  name: string;
  contact_number: string;
  address?: string | null;
}

export interface InvoiceDocumentItem {
  id: string;
  product_name: string;
  sku: string;
  quantity: number;
  unit: string;
  unit_price: number;
  discount_amount: number;
  tax_amount: number;
  total: number;
  packing_details?: Record<string, unknown> | null;
}

export interface InvoiceDocumentPayment {
  id: string;
  amount: number;
  payment_method: string;
  payment_date: string;
  reference_number?: string | null;
}

export interface InvoiceDocumentTotals {
  subtotal: number;
  discount: number;
  tax: number;
  expenses: number;
  total: number;
  studio_charges: number;
  grand_total: number;
  paid: number;
  due: number;
}

export interface InvoiceDocumentMeta {
  sale_id: string;
  invoice_no: string;
  invoice_date: string;
  fiscal_period: string | null;
  status: string;
  type: string;
  payment_status: string;
  notes?: string | null;
  branch_id: string;
}

export interface InvoiceDocument {
  company: InvoiceDocumentCompany;
  customer: InvoiceDocumentCustomer;
  items: InvoiceDocumentItem[];
  studio_cost: number;
  payments: InvoiceDocumentPayment[];
  totals: InvoiceDocumentTotals;
  meta: InvoiceDocumentMeta;
}

export interface InvoiceTemplate {
  id: string;
  company_id: string;
  template_type: 'A4' | 'Thermal';
  show_sku: boolean;
  show_discount: boolean;
  show_tax: boolean;
  show_studio: boolean;
  show_signature: boolean;
  logo_url: string | null;
  footer_note: string | null;
}

export type InvoiceTemplateType = 'A4' | 'Thermal';
