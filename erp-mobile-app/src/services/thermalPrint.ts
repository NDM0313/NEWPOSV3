/**
 * Thermal / ESC-POS printing — extension point for Bluetooth printers on device builds.
 * Without a native plugin, attempts return `ok: false` and callers should fall back to Share slip / PDF.
 */

import { Capacitor } from '@capacitor/core';

export interface ThermalPrintResult {
  ok: boolean;
  hint?: string;
}

/** Minimal ESC/POS: initialize + text + feed + cut (when supported). */
export function encodeEscPosUtf8(lines: string[]): Uint8Array {
  const ESC = 0x1b;
  const GS = 0x1d;
  const parts: number[] = [ESC, 0x40, ESC, 0x74, 0x10];
  for (const line of lines) {
    const enc = new TextEncoder();
    parts.push(...Array.from(enc.encode(line + '\n')));
  }
  parts.push(0x0a, 0x0a, GS, 0x56, 0x41, 0x00);
  return new Uint8Array(parts);
}

export function formatPlainReceiptLines(params: {
  title: string;
  transactionNo?: string | null;
  partyName?: string | null;
  amount?: number | null;
  date?: string | null;
  branch?: string | null;
}): string[] {
  const lines: string[] = [params.title, ''];
  if (params.transactionNo) lines.push(`No: ${params.transactionNo}`);
  if (params.date) lines.push(`Date: ${new Date(params.date).toLocaleString('en-PK')}`);
  if (params.branch) lines.push(`Branch: ${params.branch}`);
  if (params.partyName) lines.push(`Party: ${params.partyName}`);
  if (params.amount != null) lines.push('', `Amount: Rs. ${Number(params.amount).toLocaleString('en-PK')}`);
  lines.push('', 'Thank you.');
  return lines;
}

/**
 * Send raw bytes to a Bluetooth thermal printer. Requires a Capacitor plugin that exposes
 * write(bytes) to a paired device — register when you add e.g. Sunmi or ESC/POS Bluetooth package.
 */
export async function printEscPosBuffer(_data: Uint8Array): Promise<ThermalPrintResult> {
  const platform = Capacitor.getPlatform();
  if (platform === 'web') {
    return {
      ok: false,
      hint: 'Bluetooth printing runs in the native app. Use Share slip from this screen in the browser.',
    };
  }

  const bridge = (window as unknown as { ThermalPrinter?: { write?: (b: Uint8Array) => Promise<void> } })
    .ThermalPrinter;
  if (bridge?.write) {
    try {
      await bridge.write(_data);
      return { ok: true };
    } catch (e) {
      return { ok: false, hint: e instanceof Error ? e.message : 'Printer write failed.' };
    }
  }

  return {
    ok: false,
    hint:
      'No Bluetooth printer bridge registered. Pair a device in Settings, add a Capacitor ESC/POS plugin, or use Share slip.',
  };
}

export async function printThermalReceiptLines(lines: string[]): Promise<ThermalPrintResult> {
  const buf = encodeEscPosUtf8(lines);
  return printEscPosBuffer(buf);
}
