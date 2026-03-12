/**
 * Hook for barcode scanning: permission state and trigger scan.
 * Use in POS or any screen that needs "scan → get product".
 */

import { useState, useCallback } from 'react';
import {
  isBarcodeScanSupported,
  checkCameraPermission,
  requestCameraPermission,
  scanBarcode,
  type BarcodeScanResult,
  type BarcodeServiceStatus,
} from './barcodeService';

export interface UseBarcodeScannerResult {
  /** Whether native scanner is available. */
  supported: boolean | null;
  /** Camera permission granted. */
  permissionGranted: boolean | null;
  /** Error message if support check or permission failed. */
  error: string | null;
  /** Loading: checking support or scanning. */
  loading: boolean;
  /** Last scanned code (for display). */
  lastScannedCode: string | null;
  /** Check support and permission (e.g. on mount). */
  checkStatus: () => Promise<void>;
  /** Request camera permission. */
  requestPermission: () => Promise<void>;
  /** Start scan; returns code or null. Calls onScan(code) when code is found. */
  startScan: (onScan: (code: string) => void) => Promise<BarcodeScanResult>;
}

export function useBarcodeScanner(): UseBarcodeScannerResult {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);

  const checkStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const ok = await isBarcodeScanSupported();
      setSupported(ok);
      if (ok) {
        const status = await checkCameraPermission();
        setPermissionGranted(status.permissionGranted ?? false);
        if (status.error) setError(status.error);
      } else {
        setPermissionGranted(null);
      }
    } catch (e) {
      setSupported(false);
      setPermissionGranted(null);
      setError(e instanceof Error ? e.message : 'Scanner unavailable');
    } finally {
      setLoading(false);
    }
  }, []);

  const requestPermission = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const status = await requestCameraPermission();
      setSupported(status.supported);
      setPermissionGranted(status.permissionGranted ?? false);
      if (status.error) setError(status.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Permission failed');
    } finally {
      setLoading(false);
    }
  }, []);

  const startScan = useCallback(async (onScan: (code: string) => void): Promise<BarcodeScanResult> => {
    setLoading(true);
    setError(null);
    try {
      const result = await scanBarcode();
      if (result?.code) {
        setLastScannedCode(result.code);
        onScan(result.code);
        return result;
      }
      return null;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Scan failed');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    supported,
    permissionGranted,
    error,
    loading,
    lastScannedCode,
    checkStatus,
    requestPermission,
    startScan,
  };
}
