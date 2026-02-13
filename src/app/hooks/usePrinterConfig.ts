/**
 * Centralized printer config. No hardcoded print styling.
 * Reads from company settings (DB).
 */
import { useCallback, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useSupabase } from '@/app/context/SupabaseContext';

export type PrinterMode = 'thermal' | 'a4';

export interface PrinterConfig {
  mode: PrinterMode;
  defaultPrinterName: string | null;
  autoPrintReceipt: boolean;
}

const DEFAULT_CONFIG: PrinterConfig = {
  mode: 'a4',
  defaultPrinterName: null,
  autoPrintReceipt: false,
};

export function usePrinterConfig(): {
  config: PrinterConfig;
  setMode: (mode: PrinterMode) => Promise<void>;
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
      const { data } = await supabase
        .from('companies')
        .select('printer_mode, default_printer_name, print_receipt_auto')
        .eq('id', companyId)
        .single();

      if (data) {
        setConfig({
          mode: (data.printer_mode as PrinterMode) || 'a4',
          defaultPrinterName: data.default_printer_name ?? null,
          autoPrintReceipt: data.print_receipt_auto ?? false,
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

  const setAutoPrintReceipt = useCallback(
    async (enabled: boolean) => {
      if (!companyId) return;
      await supabase.from('companies').update({ print_receipt_auto: enabled }).eq('id', companyId);
      setConfig((c) => ({ ...c, autoPrintReceipt: enabled }));
    },
    [companyId]
  );

  return { config, setMode, setAutoPrintReceipt, refresh: loadConfig };
}
