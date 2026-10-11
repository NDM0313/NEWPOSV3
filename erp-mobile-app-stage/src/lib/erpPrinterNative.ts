/**
 * Native Android printer bridge (Sunmi built-in + Bluetooth SPP).
 * Implemented in ErpPrinterPlugin.java; no-op on web.
 */

import { Capacitor, registerPlugin } from '@capacitor/core';

export type PrinterBackend = 'sunmi' | 'bluetooth' | 'browser' | 'none';

export interface PrinterCapabilities {
  sunmi: boolean;
  bluetooth: boolean;
  platform: string;
}

export interface BluetoothDeviceInfo {
  name: string;
  address: string;
}

export interface ErpPrinterPlugin {
  getCapabilities(): Promise<PrinterCapabilities>;
  printRaw(options: { data: string }): Promise<{ ok: boolean }>;
  listPairedBluetooth(): Promise<{ devices: BluetoothDeviceInfo[] }>;
  printBluetooth(options: { address: string; data: string }): Promise<{ ok: boolean }>;
}

const ErpPrinter = registerPlugin<ErpPrinterPlugin>('ErpPrinter', {
  web: () => ({
    async getCapabilities() {
      return { sunmi: false, bluetooth: false, platform: 'web' };
    },
    async printRaw() {
      return { ok: false };
    },
    async listPairedBluetooth() {
      return { devices: [] };
    },
    async printBluetooth() {
      return { ok: false };
    },
  }),
});

export async function getNativePrinterCapabilities(): Promise<PrinterCapabilities> {
  if (!Capacitor.isNativePlatform()) {
    return { sunmi: false, bluetooth: false, platform: 'web' };
  }
  ensureLegacyBridge();
  try {
    return await ErpPrinter.getCapabilities();
  } catch {
    return { sunmi: false, bluetooth: false, platform: Capacitor.getPlatform() };
  }
}

export async function nativePrintRaw(bytes: Uint8Array): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  ensureLegacyBridge();
  const b64 = uint8ToBase64(bytes);
  try {
    const res = await ErpPrinter.printRaw({ data: b64 });
    return !!res.ok;
  } catch {
    return false;
  }
}

export async function nativePrintBluetooth(address: string, bytes: Uint8Array): Promise<boolean> {
  if (!Capacitor.isNativePlatform() || !address) return false;
  try {
    const res = await ErpPrinter.printBluetooth({ address, data: uint8ToBase64(bytes) });
    return !!res.ok;
  } catch {
    return false;
  }
}

export async function listPairedBluetoothDevices(): Promise<BluetoothDeviceInfo[]> {
  if (!Capacitor.isNativePlatform()) return [];
  try {
    const res = await ErpPrinter.listPairedBluetooth();
    return res.devices ?? [];
  } catch {
    return [];
  }
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Legacy bridge used by older thermalPrint paths. */
let legacyBridgeRegistered = false;
export function registerLegacyThermalBridge(): void {
  if (legacyBridgeRegistered || typeof window === 'undefined') return;
  legacyBridgeRegistered = true;
  const w = window as Window & {
    ThermalPrinter?: { write?: (b: Uint8Array) => Promise<void> };
  };
  if (w.ThermalPrinter?.write) return;
  w.ThermalPrinter = {
    write: async (data: Uint8Array) => {
      const ok = await nativePrintRaw(data);
      if (!ok) throw new Error('Native print failed');
    },
  };
}

function ensureLegacyBridge(): void {
  registerLegacyThermalBridge();
}
