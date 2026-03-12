export { BarcodeScanner } from './BarcodeScanner';
export { useBarcodeScanner } from './useBarcodeScanner';
export {
  isBarcodeScanSupported,
  checkCameraPermission,
  requestCameraPermission,
  scanBarcode,
} from './barcodeService';
export type { BarcodeScanResult, BarcodeServiceStatus } from './barcodeService';
export type { UseBarcodeScannerResult } from './useBarcodeScanner';
export type { BarcodeScannerProps } from './BarcodeScanner';
