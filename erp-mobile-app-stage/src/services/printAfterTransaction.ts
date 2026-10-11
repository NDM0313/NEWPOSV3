import { getEffectivePrinterSettings } from '../api/settings';
import { formatPlainReceiptLines, printThermalReceiptLines } from './thermalPrint';
import { printReceiptLines, type PrintResult } from './printService';

export interface AutoPrintPayload {
  title: string;
  transactionNo?: string | null;
  partyName?: string | null;
  amount?: number | null;
  date?: string | null;
  branch?: string | null;
}

export async function maybeAutoPrintAfterTransaction(
  companyId: string | null,
  payload: AutoPrintPayload,
  options?: { mirrorFromCompany?: boolean }
): Promise<PrintResult | null> {
  if (!companyId) return null;
  const { data: settings } = await getEffectivePrinterSettings(companyId, {
    syncFromCompany: options?.mirrorFromCompany,
  });
  if (!settings.autoPrintReceipt) return null;

  const lines = formatPlainReceiptLines({
    title: payload.title,
    transactionNo: payload.transactionNo,
    partyName: payload.partyName,
    amount: payload.amount,
    date: payload.date,
    branch: payload.branch,
  });

  if (settings.mode === 'thermal') {
    return printReceiptLines(lines, {
      mode: settings.mode,
      paperSize: settings.paperSize,
      bluetoothDeviceAddress: settings.bluetoothDeviceAddress,
    });
  }

  return printReceiptLines(lines, {
    mode: 'a4',
    paperSize: settings.paperSize,
    bluetoothDeviceAddress: settings.bluetoothDeviceAddress,
  });
}

export async function manualPrintReceipt(
  companyId: string | null,
  payload: AutoPrintPayload
): Promise<PrintResult> {
  const { data: settings } = await getEffectivePrinterSettings(companyId);
  const lines = formatPlainReceiptLines(payload);
  if (settings.mode === 'thermal') {
    const legacy = await printThermalReceiptLines(lines);
    if (legacy.ok) return { ok: true, backend: 'sunmi' };
  }
  return printReceiptLines(lines, {
    mode: settings.mode,
    paperSize: settings.paperSize,
    bluetoothDeviceAddress: settings.bluetoothDeviceAddress,
  });
}
