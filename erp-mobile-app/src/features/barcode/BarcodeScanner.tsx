/**
 * Barcode scanner UI: button to open native scan, or permission/error state.
 * Use in POS: on scan → get product by barcode → add to cart.
 */

import { useEffect } from 'react';
import { ScanLine, Loader2, AlertCircle } from 'lucide-react';
import { useBarcodeScanner } from './useBarcodeScanner';

export interface BarcodeScannerProps {
  /** Called when a barcode was successfully scanned. */
  onScan: (code: string) => void;
  /** Optional label for the scan button. */
  buttonLabel?: string;
  /** Optional class for the button. */
  className?: string;
  /** If true, run checkStatus on mount. */
  checkOnMount?: boolean;
}

export function BarcodeScanner({ onScan, buttonLabel = 'Scan barcode', className = '', checkOnMount = true }: BarcodeScannerProps) {
  const {
    supported,
    permissionGranted,
    error,
    loading,
    checkStatus,
    requestPermission,
    startScan,
  } = useBarcodeScanner();

  useEffect(() => {
    if (checkOnMount) checkStatus();
  }, [checkOnMount, checkStatus]);

  const handlePress = async () => {
    if (supported === false || permissionGranted === false) {
      await requestPermission();
      if (permissionGranted === false) return;
    }
    await startScan(onScan);
  };

  if (loading && supported === null) {
    return (
      <button
        type="button"
        disabled
        className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#374151] text-[#9CA3AF] ${className}`}
      >
        <Loader2 className="w-5 h-5 animate-spin" />
        <span>Checking scanner…</span>
      </button>
    );
  }

  if (error && supported === false) {
    return (
      <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#374151]/80 text-[#9CA3AF] text-sm ${className}`}>
        <AlertCircle className="w-5 h-5 flex-shrink-0" />
        <span>{error}</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handlePress}
      disabled={loading}
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#10B981] hover:bg-[#059669] text-white font-medium disabled:opacity-70 ${className}`}
    >
      {loading ? (
        <Loader2 className="w-5 h-5 animate-spin" />
      ) : (
        <ScanLine className="w-5 h-5" />
      )}
      <span>{buttonLabel}</span>
    </button>
  );
}
