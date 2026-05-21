/**
 * Unified print: Sunmi built-in → Bluetooth ESC/POS → browser print (A4 / dev).
 */

import { Capacitor } from '@capacitor/core';
import type { MobilePrinterMode, MobilePrinterPaperSize } from '../api/settings';
import {
  getNativePrinterCapabilities,
  nativePrintBluetooth,
  nativePrintRaw,
  type PrinterBackend,
} from '../lib/erpPrinterNative';
import { encodeEscPosUtf8 } from './thermalPrint';

export interface PrintResult {
  ok: boolean;
  backend?: PrinterBackend;
  hint?: string;
}

export interface PrintReceiptOptions {
  mode: MobilePrinterMode;
  paperSize: MobilePrinterPaperSize;
  bluetoothDeviceAddress?: string | null;
}

let cachedBackend: PrinterBackend | null = null;

export async function probePrinterBackend(
  bluetoothAddress?: string | null
): Promise<PrinterBackend> {
  const caps = await getNativePrinterCapabilities();
  if (caps.sunmi) {
    cachedBackend = 'sunmi';
    return 'sunmi';
  }
  if (caps.bluetooth && bluetoothAddress) {
    cachedBackend = 'bluetooth';
    return 'bluetooth';
  }
  if (Capacitor.getPlatform() === 'web') {
    cachedBackend = 'browser';
    return 'browser';
  }
  cachedBackend = 'none';
  return 'none';
}

export function getCachedPrinterBackendLabel(): string {
  switch (cachedBackend) {
    case 'sunmi':
      return 'Sunmi built-in';
    case 'bluetooth':
      return 'Bluetooth';
    case 'browser':
      return 'Browser';
    default:
      return Capacitor.isNativePlatform() ? 'Not connected' : 'Browser';
  }
}

export async function printReceiptLines(
  lines: string[],
  options: PrintReceiptOptions
): Promise<PrintResult> {
  if (options.mode === 'a4') {
    return printHtmlDocument(buildReceiptHtml(lines), 'Receipt');
  }

  const bytes = encodeEscPosUtf8(lines, options.paperSize);
  const backend = await probePrinterBackend(options.bluetoothDeviceAddress);

  if (backend === 'sunmi') {
    const ok = await nativePrintRaw(bytes);
    if (ok) return { ok: true, backend: 'sunmi' };
  }

  if (backend === 'bluetooth' && options.bluetoothDeviceAddress) {
    const ok = await nativePrintBluetooth(options.bluetoothDeviceAddress, bytes);
    if (ok) return { ok: true, backend: 'bluetooth' };
  }

  const bridge = (window as unknown as { ThermalPrinter?: { write?: (b: Uint8Array) => Promise<void> } })
    .ThermalPrinter;
  if (bridge?.write) {
    try {
      await bridge.write(bytes);
      return { ok: true, backend: 'bluetooth' };
    } catch (e) {
      return { ok: false, hint: e instanceof Error ? e.message : 'Printer write failed' };
    }
  }

  return {
    ok: false,
    hint:
      Capacitor.getPlatform() === 'web'
        ? 'Thermal printing needs the native app. Use Share slip or switch to A4.'
        : 'Pair a Bluetooth printer in Settings or use a Sunmi device.',
  };
}

export async function printTestReceipt(options: PrintReceiptOptions): Promise<PrintResult> {
  const lines = [
    'DIN COUTURE ERP',
    'Test Print',
    new Date().toLocaleString('en-PK'),
    `Mode: ${options.mode}`,
    `Paper: ${options.paperSize}`,
    '',
    'OK',
  ];
  return printReceiptLines(lines, options);
}

export async function printHtmlDocument(html: string, title: string): Promise<PrintResult> {
  try {
    const w = window.open('', '_blank', 'width=400,height=600');
    if (!w) {
      return { ok: false, hint: 'Allow pop-ups to print, or use Share.' };
    }
    w.document.write(html);
    w.document.title = title;
    w.document.close();
    w.focus();
    w.print();
    return { ok: true, backend: 'browser' };
  } catch (e) {
    return { ok: false, hint: e instanceof Error ? e.message : 'Print failed' };
  }
}

function buildReceiptHtml(lines: string[]): string {
  const body = lines.map((l) => `<div>${escapeHtml(l)}</div>`).join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>
    body{font-family:monospace;font-size:12px;padding:16px;max-width:80mm;margin:0 auto;}
    @media print{body{max-width:100%;}}
  </style></head><body>${body}</body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
