/**
 * Barcode scanning service using @capacitor-mlkit/barcode-scanning (optional).
 * On native: opens camera, scans, returns code. On web: returns error (no camera plugin).
 * For web/dev the package is aliased to mlkit-stub in vite.config so the build does not require it.
 * For Capacitor native build: set VITE_TARGET=capacitor so the real package is used.
 */

export type BarcodeScanResult = { code: string; format?: string } | null;

export interface BarcodeServiceStatus {
  supported: boolean;
  permissionGranted: boolean | null;
  error?: string;
}

/** Check if native barcode scanning is available (Capacitor with plugin). */
export async function isBarcodeScanSupported(): Promise<boolean> {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform()) return false;
    await import('@capacitor-mlkit/barcode-scanning');
    return true;
  } catch {
    return false;
  }
}

/** Check current camera permission status. */
export async function checkCameraPermission(): Promise<BarcodeServiceStatus> {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform()) {
      return { supported: false, permissionGranted: null, error: 'Barcode scanning is only available in the native app.' };
    }
    const { BarcodeScanner } = await import('@capacitor-mlkit/barcode-scanning');
    const status = await BarcodeScanner.checkPermissions();
    const granted = status.camera === 'granted';
    return { supported: true, permissionGranted: granted };
  } catch (e) {
    return {
      supported: false,
      permissionGranted: null,
      error: e instanceof Error ? e.message : 'Barcode scanner not available.',
    };
  }
}

/** Request camera permission. */
export async function requestCameraPermission(): Promise<BarcodeServiceStatus> {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform()) {
      return { supported: false, permissionGranted: null, error: 'Barcode scanning is only available in the native app.' };
    }
    const { BarcodeScanner } = await import('@capacitor-mlkit/barcode-scanning');
    const status = await BarcodeScanner.requestPermissions();
    const granted = status.camera === 'granted';
    return { supported: true, permissionGranted: granted };
  } catch (e) {
    return {
      supported: false,
      permissionGranted: null,
      error: e instanceof Error ? e.message : 'Permission request failed.',
    };
  }
}

/**
 * Start barcode scan. Opens camera UI and returns first barcode scanned.
 * Returns null if cancelled or not supported.
 */
export async function scanBarcode(): Promise<BarcodeScanResult> {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform()) {
      return null;
    }
    const { BarcodeScanner } = await import('@capacitor-mlkit/barcode-scanning');
    const status = await BarcodeScanner.checkPermissions();
    if (status.camera !== 'granted') {
      const requested = await BarcodeScanner.requestPermissions();
      if (requested.camera !== 'granted') return null;
    }
    const result = await BarcodeScanner.scan();
    const barcodes = (result as { barcodes?: Array<{ rawValue?: string; displayValue?: string; format?: string }> })?.barcodes;
    if (barcodes?.length && barcodes[0]) {
      const first = barcodes[0];
      const code = (first.rawValue ?? first.displayValue ?? '').trim();
      return code ? { code, format: first.format } : null;
    }
    return null;
  } catch {
    return null;
  }
}
