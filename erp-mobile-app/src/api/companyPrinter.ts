/**
 * Company printer config: thermal / A4, paper size, auto-print.
 * Reads from and writes to companies table (same as web app usePrinterConfig).
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';

export type PrinterMode = 'thermal' | 'a4';
export type PaperSize = '58mm' | '80mm';

export interface CompanyPrinterConfig {
  mode: PrinterMode;
  paperSize: PaperSize;
  defaultPrinterName: string | null;
  autoPrintReceipt: boolean;
}

const DEFAULT_CONFIG: CompanyPrinterConfig = {
  mode: 'a4',
  paperSize: '80mm',
  defaultPrinterName: null,
  autoPrintReceipt: false,
};

export async function getCompanyPrinterConfig(
  companyId: string | null
): Promise<{ data: CompanyPrinterConfig; error: string | null }> {
  if (!isSupabaseConfigured || !companyId) {
    return { data: DEFAULT_CONFIG, error: null };
  }
  const { data, error } = await supabase
    .from('companies')
    .select('printer_mode, paper_size, default_printer_name, print_receipt_auto')
    .eq('id', companyId)
    .maybeSingle();
  if (error) return { data: DEFAULT_CONFIG, error: error.message };
  const raw = (data as Record<string, unknown>) ?? {};
  return {
    data: {
      mode: (raw.printer_mode as PrinterMode) || 'a4',
      paperSize: (raw.paper_size === '58mm' ? '58mm' : '80mm') as PaperSize,
      defaultPrinterName: (raw.default_printer_name as string) ?? null,
      autoPrintReceipt: !!raw.print_receipt_auto,
    },
    error: null,
  };
}

export async function updateCompanyPrinterConfig(
  companyId: string | null,
  payload: Partial<{
    mode: PrinterMode;
    paperSize: PaperSize;
    defaultPrinterName: string | null;
    autoPrintReceipt: boolean;
  }>
): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured || !companyId) return { error: null };
  const update: Record<string, unknown> = {};
  if (payload.mode !== undefined) update.printer_mode = payload.mode;
  if (payload.paperSize !== undefined) update.paper_size = payload.paperSize;
  if (payload.defaultPrinterName !== undefined) update.default_printer_name = payload.defaultPrinterName;
  if (payload.autoPrintReceipt !== undefined) update.print_receipt_auto = payload.autoPrintReceipt;
  if (Object.keys(update).length === 0) return { error: null };
  const { error } = await supabase.from('companies').update(update).eq('id', companyId);
  return { error: error?.message ?? null };
}
