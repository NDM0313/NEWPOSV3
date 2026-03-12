/**
 * Stub for @capacitor-mlkit/barcode-scanning when the package is not installed (e.g. web dev).
 * Prevents Vite from failing to resolve the optional native dependency.
 * In Capacitor native builds, use real package by building with VITE_USE_MLKIT=1 and having the package installed.
 */
export const BarcodeScanner = {
  async checkPermissions(): Promise<{ camera: string }> {
    return { camera: 'denied' };
  },
  async requestPermissions(): Promise<{ camera: string }> {
    return { camera: 'denied' };
  },
  async scan(): Promise<{ barcodes: unknown[] }> {
    return { barcodes: [] };
  },
};
