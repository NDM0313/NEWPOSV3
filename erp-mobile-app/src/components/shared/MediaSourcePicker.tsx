import { useCallback, useRef, useState, type ReactNode } from 'react';
import { Capacitor } from '@capacitor/core';
import { acceptAllowsCamera, capturePhotoWithNativeCamera } from '../../lib/mediaPick';
import { beginMediaCapture, endMediaCapture } from '../../lib/mediaCaptureSession';
import { MediaSourceActionSheet } from './MediaSourceActionSheet';

export interface MediaSourcePickerProps {
  accept: string;
  multiple?: boolean;
  /** Show camera option when accept includes images. Default: derived from accept. */
  allowCamera?: boolean;
  disabled?: boolean;
  onFiles: (files: File[]) => void;
  onError?: (message: string) => void;
  sheetTitle?: string;
  children: (open: () => void) => ReactNode;
}

/**
 * Camera vs gallery sheet. Native APK uses @capacitor/camera for Take photo;
 * browser/PWA uses file input with capture=environment. Gallery uses standard file input.
 */
export function MediaSourcePicker({
  accept,
  multiple = false,
  allowCamera,
  disabled = false,
  onFiles,
  onError,
  sheetTitle,
  children,
}: MediaSourcePickerProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraWebRef = useRef<HTMLInputElement>(null);

  const showCamera = allowCamera ?? acceptAllowsCamera(accept);
  const useNativeCamera = Capacitor.isNativePlatform();

  const emitFiles = useCallback(
    (list: File[]) => {
      if (list.length > 0) onFiles(list);
    },
    [onFiles],
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    endMediaCapture();
    const selected = e.target.files;
    if (selected?.length) emitFiles(Array.from(selected));
    e.target.value = '';
  };

  const armPickerEndOnFocus = () => {
    const endOnce = () => {
      endMediaCapture();
      window.removeEventListener('focus', endOnce);
    };
    window.addEventListener('focus', endOnce);
    window.setTimeout(endOnce, 90_000);
  };

  const openGallery = () => {
    if (disabled) return;
    beginMediaCapture();
    armPickerEndOnFocus();
    galleryRef.current?.click();
  };

  const openCamera = () => {
    if (disabled) return;
    beginMediaCapture();
    void (async () => {
      try {
        if (useNativeCamera) {
          const file = await capturePhotoWithNativeCamera();
          if (file) {
            emitFiles([file]);
            return;
          }
          onError?.('No photo captured. Try again or choose from gallery.');
          return;
        }
        armPickerEndOnFocus();
        cameraWebRef.current?.click();
      } catch (err) {
        onError?.(err instanceof Error ? err.message : 'Could not open camera.');
      } finally {
        endMediaCapture();
      }
    })();
  };

  const openPicker = () => {
    if (disabled) return;
    if (!showCamera) {
      openGallery();
      return;
    }
    setSheetOpen(true);
  };

  return (
    <>
      {children(openPicker)}
      <MediaSourceActionSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onCamera={openCamera}
        onGallery={openGallery}
        showCamera={showCamera}
        title={sheetTitle}
      />
      <input
        ref={galleryRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        disabled={disabled}
        onChange={handleInputChange}
      />
      {showCamera && !useNativeCamera && (
        <input
          ref={cameraWebRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          disabled={disabled}
          onChange={handleInputChange}
        />
      )}
    </>
  );
}
