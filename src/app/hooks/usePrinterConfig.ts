/**
 * Centralized printer config. No hardcoded print styling.
 * Reads from company settings (DB).
 */
import { useCallback, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useSupabase } from '@/app/context/SupabaseContext';

export type PrinterMode = 'thermal' | 'a4';
export type PaperSize = '58mm' | '80mm';

export interface PrinterConfig {
  mode: PrinterMode;
  paperSize: PaperSize;
  defaultPrinterName: string | null;
  autoPrintReceipt: boolean;
}

const DEFAULT_CONFIG: PrinterConfig = {
  mode: 'a4',
  paperSize: '80mm',
  defaultPrinterName: null,
  autoPrintReceipt: false,
};

export function usePrinterConfig(): {
  config: PrinterConfig;
  setMode: (mode: PrinterMode) => Promise<void>;
  setPaperSize: (size: PaperSize) => Promise<void>;
  setAutoPrintReceipt: (enabled: boolean) => Promise<void>;
  refresh: () => Promise<void>;
} {
  const { companyId } = useSupabase();
  const [config, setConfig] = useState<PrinterConfig>(DEFAULT_CONFIG);

  const loadConfig = useCallback(async () => {
    if (!companyId) {
      setConfig(DEFAULT_CONFIG);
      return;
    }
    try {
      // Try with paper_size first (migration 54); fallback if column not yet added
      let { data, error } = await supabase
        .from('companies')
        .select('printer_mode, paper_size, default_printer_name, print_receipt_auto')
        .eq('id', companyId)
        .single();

      if (error) {
        const fallback = await supabase
          .from('companies')
          .select('printer_mode, default_printer_name, print_receipt_auto')
          .eq('id', companyId)
          .single();
        data = fallback.data;
        error = fallback.error;
      }

      if (data && !error) {
        const raw = data as Record<string, unknown>;
        setConfig({
          mode: (raw.printer_mode as PrinterMode) || 'a4',
          paperSize: (raw.paper_size === '58mm' ? '58mm' : '80mm') as PaperSize,
          defaultPrinterName: (raw.default_printer_name as string) ?? null,
          autoPrintReceipt: !!raw.print_receipt_auto,
        });
      }
    } catch {
      setConfig(DEFAULT_CONFIG);
    }
  }, [companyId]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const setMode = useCallback(
    async (mode: PrinterMode) => {
      if (!companyId) return;
      await supabase.from('companies').update({ printer_mode: mode }).eq('id', companyId);
      setConfig((c) => ({ ...c, mode }));
    },
    [companyId]
  );

  const setPaperSize = useCallback(
    async (paperSize: PaperSize) => {
      if (!companyId) return;
      await supabase.from('companies').update({ paper_size: paperSize }).eq('id', companyId);
      setConfig((c) => ({ ...c, paperSize }));
    },
    [companyId]
  );

  const setAutoPrintReceipt = useCallback(
    async (enabled: boolean) => {
      if (!companyId) return;
      await supabase.from('companies').update({ print_receipt_auto: enabled }).eq('id', companyId);
      setConfig((c) => ({ ...c, autoPrintReceipt: enabled }));
    },
    [companyId]
  );

  return { config, setMode, setPaperSize, setAutoPrintReceipt, refresh: loadConfig };
}
