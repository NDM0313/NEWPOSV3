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

/** True when running inside Capacitor iOS/Android shell. */
export async function isNativeBarcodePlatform(): Promise<boolean> {
  try {
    const { Capacitor } = await import('@capacitor/core');
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

async function loadBarcodeScanner() {
  const { BarcodeScanner } = await import('@capacitor-mlkit/barcode-scanning');
  return BarcodeScanner;
}

/** Check if native barcode scanning is available (Capacitor with ML Kit plugin). */
export async function isBarcodeScanSupported(): Promise<boolean> {
  try {
    const native = await isNativeBarcodePlatform();
    if (!native) return false;
    const BarcodeScanner = await loadBarcodeScanner();
    await BarcodeScanner.checkPermissions();
    return true;
  } catch {
    return false;
  }
}

/** Check current camera permission status. */
export async function checkCameraPermission(): Promise<BarcodeServiceStatus> {
  try {
    const native = await isNativeBarcodePlatform();
    if (!native) {
      return { supported: false, permissionGranted: null, error: 'Barcode scanning is only available in the native app.' };
    }
    const BarcodeScanner = await loadBarcodeScanner();
    const status = await BarcodeScanner.checkPermissions();
    const granted = status.camera === 'granted';
    return { supported: true, permissionGranted: granted };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Barcode scanner not available.';
    const pluginMissing = /not implemented|plugin|unavailable|native/i.test(msg);
    return {
      supported: false,
      permissionGranted: null,
      error: pluginMissing
        ? 'Barcode scanner plugin missing — rebuild the app after cap sync.'
        : msg,
    };
  }
}

/** Request camera permission. */
export async function requestCameraPermission(): Promise<BarcodeServiceStatus> {
  try {
    const native = await isNativeBarcodePlatform();
    if (!native) {
      return { supported: false, permissionGranted: null, error: 'Barcode scanning is only available in the native app.' };
    }
    const BarcodeScanner = await loadBarcodeScanner();
    const status = await BarcodeScanner.requestPermissions();
    const granted = status.camera === 'granted';
    if (!granted) {
      return { supported: true, permissionGranted: false, error: 'Camera permission denied.' };
    }
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
 * Returns null if cancelled. Throws on plugin/permission errors.
 */
export async function scanBarcode(): Promise<BarcodeScanResult> {
  const native = await isNativeBarcodePlatform();
  if (!native) {
    throw new Error('Barcode scanning is only available in the native app.');
  }

  let BarcodeScanner;
  try {
    BarcodeScanner = await loadBarcodeScanner();
  } catch (e) {
    throw new Error(
      e instanceof Error ? e.message : 'Barcode scanner plugin not available. Rebuild after cap sync.',
    );
  }

  const status = await BarcodeScanner.checkPermissions();
  if (status.camera !== 'granted') {
    const requested = await BarcodeScanner.requestPermissions();
    if (requested.camera !== 'granted') {
      throw new Error('Camera permission denied. Enable camera access in Settings.');
    }
  }

  try {
    const result = await BarcodeScanner.scan();
    const barcodes = (result as { barcodes?: Array<{ rawValue?: string; displayValue?: string; format?: string }> })
      ?.barcodes;
    if (barcodes?.length && barcodes[0]) {
      const first = barcodes[0];
      const code = (first.rawValue ?? first.displayValue ?? '').trim();
      return code ? { code, format: first.format } : null;
    }
    return null;
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : 'Scan failed.');
  }
}
