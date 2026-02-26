/**
 * Phase A: Invoice document and template API.
 * Single source for document data (RPC) and template options (invoice_templates).
 */
import { supabase } from '@/lib/supabase';
import type { InvoiceDocument, InvoiceTemplate, InvoiceTemplateType } from '@/app/types/invoiceDocument';

export const invoiceDocumentService = {
  /**
   * Fetch structured invoice document for a sale (company, customer, items, studio_cost, payments, totals, meta).
   * Uses RPC generate_invoice_document(sale_id). Fiscal period included when fiscal_calendar has a matching row.
   */
  async getDocument(saleId: string): Promise<{ data: InvoiceDocument | null; error: string | null }> {
    const { data, error } = await supabase.rpc('generate_invoice_document', { p_sale_id: saleId });
    if (error) {
      return { data: null, error: error.message };
    }
    const raw = data as unknown;
    if (raw && typeof raw === 'object' && 'error' in raw && typeof (raw as { error: string }).error === 'string') {
      return { data: null, error: (raw as { error: string }).error };
    }
    return { data: raw as InvoiceDocument, error: null };
  },

  /**
   * Fetch invoice template for company and type (A4 or Thermal).
   * Returns default flags when no row exists (backward compatibility).
   */
  async getTemplate(
    companyId: string,
    templateType: InvoiceTemplateType
  ): Promise<{ data: InvoiceTemplate | null; error: string | null }> {
    const { data, error } = await supabase
      .from('invoice_templates')
      .select('*')
      .eq('company_id', companyId)
      .eq('template_type', templateType)
      .maybeSingle();

    if (error) {
      return { data: null, error: error.message };
    }

    if (data) {
      return {
        data: {
          id: data.id,
          company_id: data.company_id,
          template_type: data.template_type as InvoiceTemplateType,
          show_sku: data.show_sku ?? true,
          show_discount: data.show_discount ?? true,
          show_tax: data.show_tax ?? true,
          show_studio: data.show_studio ?? true,
          show_signature: data.show_signature ?? false,
          logo_url: data.logo_url ?? null,
          footer_note: data.footer_note ?? null,
        },
        error: null,
      };
    }

    // No row: return defaults (backward compatibility)
    return {
      data: {
        id: '',
        company_id: companyId,
        template_type: templateType,
        show_sku: true,
        show_discount: true,
        show_tax: true,
        show_studio: true,
        show_signature: false,
        logo_url: null,
        footer_note: null,
      },
      error: null,
    };
  },

  /**
   * Phase B: Upsert invoice template for company and type (A4 or Thermal).
   */
  async upsertTemplate(
    companyId: string,
    templateType: InvoiceTemplateType,
    payload: {
      show_sku: boolean;
      show_discount: boolean;
      show_tax: boolean;
      show_studio: boolean;
      show_signature: boolean;
      logo_url: string | null;
      footer_note: string | null;
    }
  ): Promise<{ error: string | null }> {
    const { error } = await supabase
      .from('invoice_templates')
      .upsert(
        {
          company_id: companyId,
          template_type: templateType,
          show_sku: payload.show_sku,
          show_discount: payload.show_discount,
          show_tax: payload.show_tax,
          show_studio: payload.show_studio,
          show_signature: payload.show_signature,
          logo_url: payload.logo_url || null,
          footer_note: payload.footer_note || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'company_id,template_type' }
      );
    return { error: error?.message ?? null };
  },
};
