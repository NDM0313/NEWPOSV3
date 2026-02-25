/**
 * Standard barcode scanner using browser BarcodeDetector API (Chrome/Android).
 * When not supported, shows a message to use keyboard wedge or type in search.
 */

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

declare global {
  interface Window {
    BarcodeDetector?: new (options?: { formats?: string[] }) => {
      detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue: string; format: string }>>;
    };
  }
}

interface BarcodeCameraModalProps {
  open: boolean;
  onClose: () => void;
  onDetected: (barcode: string) => void;
}

const SUPPORTED = typeof window !== 'undefined' && 'BarcodeDetector' in window;

export function BarcodeCameraModal({ open, onClose, onDetected }: BarcodeCameraModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (!SUPPORTED) {
      setError('Camera scan not supported in this browser. Use Settings → Barcode scanner → Keyboard wedge, or type barcode in the search box.');
      return;
    }
    let cancelled = false;
    const video = videoRef.current;
    if (!video) return;

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        video.srcObject = stream;
        await video.play();
        setScanning(true);
      } catch (e) {
        if (!cancelled) setError('Camera access denied or unavailable.');
      }
    };
    startCamera();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      setScanning(false);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !SUPPORTED || !scanning || error || !videoRef.current || !streamRef.current) return;
    const video = videoRef.current;
    const detector = new window.BarcodeDetector!({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'] });
    let lastValue = '';

    const detect = async () => {
      if (!video.videoWidth || !streamRef.current) {
        rafRef.current = requestAnimationFrame(detect);
        return;
      }
      try {
        const barcodes = await detector.detect(video);
        const b = barcodes[0];
        if (b?.rawValue && b.rawValue !== lastValue) {
          lastValue = b.rawValue;
          onDetected(b.rawValue);
          onClose();
          return;
        }
      } catch {
        // ignore single-frame errors
      }
      rafRef.current = requestAnimationFrame(detect);
    };
    rafRef.current = requestAnimationFrame(detect);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [open, SUPPORTED, scanning, error, onDetected, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] bg-black flex flex-col">
      <div className="flex items-center justify-between p-4 bg-[#1F2937] border-b border-[#374151]">
        <span className="text-white font-medium">Scan barcode</span>
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-[#374151] text-white"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      {error ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <p className="text-[#9CA3AF] mb-4">{error}</p>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-[#3B82F6] text-white rounded-lg font-medium"
          >
            OK
          </button>
        </div>
      ) : (
        <div className="flex-1 relative min-h-0">
          <video
            ref={videoRef}
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 border-4 border-[#3B82F6]/50 rounded-lg m-8 pointer-events-none" />
          <p className="absolute bottom-8 left-0 right-0 text-center text-white text-sm drop-shadow">
            Point camera at barcode
          </p>
        </div>
      )}
    </div>
  );
}
