/**
 * Load company printing_settings and resolve template options for the unified document engine.
 * Sales → Print (and later Purchase, Ledger, Receipt) use this so layout/fields come from Settings.
 */

import { useState, useEffect, useCallback } from 'react';
import { useSettings } from '@/app/context/SettingsContext';
import { printingSettingsService } from '@/app/services/printingSettingsService';
import { mergeWithDefaults, type CompanyPrintingSettings } from '@/app/types/printingSettings';
import { resolveDocumentOptions, resolveInvoiceTemplateFromSettings } from './resolveOptions';
import type { DocumentKind, ResolvedDocumentOptions } from './types';
import type { ResolvedInvoiceTemplate } from './types';

export interface UseUnifiedDocumentSettingsResult {
  settings: CompanyPrintingSettings | null;
  merged: ReturnType<typeof mergeWithDefaults> | null;
  resolvedInvoice: ResolvedInvoiceTemplate | null;
  resolvedOptions: ResolvedDocumentOptions | null;
  showLogo: boolean;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Load printing_settings for a company and resolve invoice template options.
 * Use in UnifiedSalesInvoiceView and (later) UnifiedPurchaseInvoiceView.
 */
export function useUnifiedDocumentSettings(
  companyId: string | null,
  documentKind: DocumentKind = 'sales_invoice'
): UseUnifiedDocumentSettingsResult {
  const { company } = useSettings();
  const companyLogoUrl = company.logoUrl;
  const [settings, setSettings] = useState<CompanyPrintingSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!companyId) {
      setSettings(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data } = await printingSettingsService.getMerged(companyId);
      setSettings(data ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load printing settings');
      setSettings(null);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    load();
  }, [load]);

  const merged = settings ? mergeWithDefaults(settings) : null;
  const resolvedInvoice = merged
    ? resolveInvoiceTemplateFromSettings(settings, documentKind, companyLogoUrl)
    : null;
  const resolvedOptions = settings
    ? resolveDocumentOptions(settings, documentKind, companyLogoUrl)
    : null;
  const showLogo = merged?.fields.showLogo ?? true;

  return {
    settings,
    merged,
    resolvedInvoice,
    resolvedOptions,
    showLogo,
    loading,
    error,
    refresh: load,
  };
}
