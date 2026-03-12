/**
 * Type declaration for optional @capacitor-mlkit/barcode-scanning.
 * When the package is not installed, Vite alias resolves to mlkit-stub.ts.
 */
declare module '@capacitor-mlkit/barcode-scanning' {
  export const BarcodeScanner: {
    checkPermissions(): Promise<{ camera: string }>;
    requestPermissions(): Promise<{ camera: string }>;
    scan(): Promise<{ barcodes: Array<{ rawValue?: string; displayValue?: string; format?: string }> }>;
  };
}
