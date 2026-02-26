/**
 * Phase A: Single source for invoice document + template data.
 * Used by A4/Thermal templates and Print/PDF/Share flows.
 */
import { useState, useEffect, useCallback } from 'react';
import { invoiceDocumentService } from '@/app/services/invoiceDocumentService';
import type { InvoiceDocument, InvoiceTemplate, InvoiceTemplateType } from '@/app/types/invoiceDocument';

export interface UseInvoiceDocumentResult {
  document: InvoiceDocument | null;
  template: InvoiceTemplate | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useInvoiceDocument(
  saleId: string | null,
  companyId: string | null,
  templateType: InvoiceTemplateType
): UseInvoiceDocumentResult {
  const [document, setDocument] = useState<InvoiceDocument | null>(null);
  const [template, setTemplate] = useState<InvoiceTemplate | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!saleId || !companyId) {
      setDocument(null);
      setTemplate(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [docRes, tplRes] = await Promise.all([
        invoiceDocumentService.getDocument(saleId),
        invoiceDocumentService.getTemplate(companyId, templateType),
      ]);
      if (docRes.error) {
        setError(docRes.error);
        setDocument(null);
      } else {
        setDocument(docRes.data);
      }
      if (tplRes.error) {
        setTemplate(null);
        if (!docRes.error) setError(tplRes.error);
      } else {
        setTemplate(tplRes.data);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load invoice');
      setDocument(null);
      setTemplate(null);
    } finally {
      setLoading(false);
    }
  }, [saleId, companyId, templateType]);

  useEffect(() => {
    load();
  }, [load]);

  return { document, template, loading, error, refresh: load };
}
